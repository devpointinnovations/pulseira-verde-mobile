import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Mail,
  MapPin,
  MapPinCheck,
  Minus,
  Navigation,
  Phone,
  Share2,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import {
  CSButton,
  CSHeader,
  CSEmptyState,
  CSLoading,
  CSRatingStars,
} from "../../../components";
import { colors, radii, spacing, typography, fontes } from "../../../theme/tokens";
import { CATEGORIA_LABEL, TIPO_LABEL } from "../../../components/CSHospitalCard";
import { useHospital, useIndicadoresHospital } from "../hooks/useHospitais";
import { useEncerrarVisitaManual } from "../../visitas/hooks/useMutacoesVisita";
import { useCheckinNoHospital } from "../../visitas/hooks/useCheckinNoHospital";
import { useVisitaAtivaDaTela } from "../../visitas/hooks/useVisitaAtivaDaTela";
import { calcularCentroide, geojsonParaCoordenadas } from "../../../utils/geojson";
import { formatarData, formatarNota, formatarPeriodo } from "../../../utils/format";
import { avaliacaoSuficiente, descreverTendencia } from "../../../utils/indicadores";

function textoOuNulo(valor) {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

/** Rota no app de mapas do aparelho: pelas coordenadas quando existem, senão pelo endereço. */
function urlComoChegar(hospital) {
  const doGeofence = hospital.geofence ? calcularCentroide(geojsonParaCoordenadas(hospital.geofence)) : null;
  const loc = doGeofence || hospital.localizacao;
  const destino =
    loc && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)
      ? `${loc.latitude},${loc.longitude}`
      : [hospital.nome, hospital.endereco?.logradouro, hospital.endereco?.cidade].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}`;
}

function Etiqueta({ texto, destaque = false }) {
  return (
    <View style={[styles.etiqueta, destaque && styles.etiquetaDestaque]}>
      <Text style={[styles.etiquetaTexto, destaque && styles.etiquetaTextoDestaque]}>{texto}</Text>
    </View>
  );
}

const ICONE_TENDENCIA = { SUBINDO: TrendingUp, ESTAVEL: Minus, CAINDO: TrendingDown };

/**
 * Tendência simples da nota (E4-06): seta, frase e o selo "Preliminar" quando há poucas
 * avaliações. O leitor de tela lê a frase inteira, com o selo, como um item só.
 */
function Tendencia({ tendencia }) {
  const Icone = ICONE_TENDENCIA[tendencia.sentido];
  const rotulo = tendencia.preliminar
    ? `${tendencia.frase}. Preliminar: ainda há poucas avaliações.`
    : `${tendencia.frase}.`;
  return (
    <View accessible accessibilityLabel={rotulo} testID="tendencia-nota" style={styles.tendencia}>
      <Icone size={18} color={colors.onSurfaceVariant} />
      <Text style={styles.tendenciaTexto}>{tendencia.frase}</Text>
      {tendencia.preliminar ? <Etiqueta texto="Preliminar" /> : null}
    </View>
  );
}

function Acao({ icone: Icone, rotulo, onPress }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.acao}>
      <Icone size={22} color={colors.primary} />
      <Text style={styles.acaoTexto}>{rotulo}</Text>
    </Pressable>
  );
}

/**
 * Detalhe público do hospital (layout novo): etiquetas, nota, tempo de espera, ações de
 * contato e "Estou aqui agora" (check-in manual com as regras da lista do Início).
 */
export default function HospitalDetalheScreen({ navigation, route }) {
  const { id } = route.params || {};

  // Dados e indicadores em consultas separadas, compartilhadas com a lista (destaque do
  // check-in ativo) pela mesma chave. Os indicadores enriquecidos vêm do endpoint
  // dedicado (§3.5 / E4-01..E4-04); se falharem (ex.: agregado ainda materializando),
  // a tela usa os embutidos no detalhe.
  const consultaHospital = useHospital(id);
  const consultaIndicadores = useIndicadoresHospital(id);
  const hospital = consultaHospital.data ?? null;
  const indicadores = consultaIndicadores.data ?? null;
  // Espera os indicadores só quando o hospital veio: sem ele a tela já é de erro.
  const carregando =
    Boolean(id) &&
    (consultaHospital.isPending || (consultaHospital.isSuccess && consultaIndicadores.isPending));
  // Uma atualização que falha com o hospital já na tela (ex.: volta ao app sem
  // conexão) não troca a tela pelo erro.
  const erro =
    consultaHospital.error && !hospital
      ? consultaHospital.error.message || "Não foi possível carregar o hospital."
      : null;

  const carregar = () => {
    void consultaHospital.refetch();
    void consultaIndicadores.refetch();
  };

  // Visita ativa deste hospital: o temporizador hh:mm:ss aparece para qualquer origem
  // (teste de campo da rc.6, 21/10/2026). O "Não estou aqui" fica só no check-in manual:
  // a visita automática é encerrada pelo geofence (decisão do PO em 21/10/2026). Visita
  // de outro hospital nunca aparece aqui. Sem conexão não é "sem visita ativa".
  const { visita: visitaAtiva, definirLocal: definirVisitaLocal } = useVisitaAtivaDaTela();
  const visitaDoHospital = visitaAtiva?.hospitalId === id ? visitaAtiva : null;
  const visitaManual = visitaDoHospital?.origem === "MANUAL" ? visitaDoHospital : null;
  const [agora, setAgora] = useState(() => Date.now());
  const { encerrar: encerrarVisitaManual, enviando: enviandoCheckout } = useEncerrarVisitaManual({
    visita: visitaManual,
    hospitalNome: hospital?.nome,
    definirLocal: definirVisitaLocal,
  });
  // O check-in aceito aparece aqui mesmo: o cartão da visita substitui o botão.
  const { checkin, enviandoId } = useCheckinNoHospital({
    visitaAtiva,
    definirLocal: definirVisitaLocal,
    aoEntrar: () => {},
  });

  // Temporizador hh:mm:ss atualizado a cada segundo enquanto houver visita ativa aqui.
  useEffect(() => {
    if (!visitaDoHospital) {
      return undefined;
    }
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visitaDoHospital]);

  // IMPORTANTE: precisa ficar antes dos `return` condicionais abaixo (Regras de Hooks):
  // o número de hooks variando entre "carregando" e "dados prontos" derrubava o app com
  // "Rendered more hooks than during the previous render".
  const temporizadorTexto = useMemo(() => {
    if (!visitaDoHospital?.entrada) return "00:00:00";
    const decorrido = Math.max(0, Math.floor((agora - new Date(visitaDoHospital.entrada).getTime()) / 1000));
    const h = Math.floor(decorrido / 3600);
    const m = Math.floor((decorrido % 3600) / 60);
    const s = decorrido % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [visitaDoHospital, agora]);

  if (carregando) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <CSLoading width="90%" height={20} />
          <CSLoading width="60%" height={14} />
          <CSLoading width="100%" height={180} radius={radii.xl} />
        </View>
      </SafeAreaView>
    );
  }

  if (erro || !hospital) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="Hospital" onBack={() => navigation.goBack()} />
        <CSEmptyState
          icon={MapPin}
          title="Não foi possível carregar"
          message={erro || "Hospital não encontrado."}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      </SafeAreaView>
    );
  }

  const dadosIndicadores = indicadores || hospital.indicadores;
  // Critério compartilhado com CSHospitalCard (utils/indicadores.js): sem isso o
  // mesmo hospital podia mostrar "sem avaliações suficientes" na lista mas nota real
  // no detalhe.
  const temIndicadores = avaliacaoSuficiente(dadosIndicadores);
  const espera = dadosIndicadores?.tempoMedianoMinutos;
  const periodo = temIndicadores ? formatarPeriodo(dadosIndicadores.periodo) : null;
  const tendencia = descreverTendencia(dadosIndicadores);

  const tipoUnidade = textoOuNulo(hospital.tipoUnidade);
  const horarioTexto = textoOuNulo(hospital.horarioFuncionamento);
  const telefone = textoOuNulo(hospital.contato?.telefone);
  const email = textoOuNulo(hospital.contato?.email);
  const endereco = [hospital.endereco?.logradouro, hospital.endereco?.cidade].filter(Boolean).join(", ");

  const compartilhar = () => {
    const nota = temIndicadores ? `, nota ${formatarNota(dadosIndicadores.notaMedia)}` : "";
    void Share.share({ message: `${hospital.nome}${nota}. Veja a nota e o tempo de espera no Pulseira Verde.` }).catch(
      () => {}
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader
        title=""
        onBack={() => navigation.goBack()}
        rightAction={
          <Pressable accessibilityRole="button" accessibilityLabel="Compartilhar" onPress={compartilhar} hitSlop={12}>
            <Share2 size={22} color={colors.onSurfaceVariant} />
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.etiquetas}>
          <Etiqueta texto={tipoUnidade || CATEGORIA_LABEL[hospital.categoria] || hospital.categoria} />
          <Etiqueta texto={TIPO_LABEL[hospital.tipo] || hospital.tipo} />
          {horarioTexto ? <Etiqueta texto={horarioTexto} destaque /> : null}
          {hospital.ativo === false ? <Etiqueta texto="Inativo" /> : null}
        </View>

        <View>
          <Text style={styles.nome} accessibilityRole="header">
            {hospital.nome}
          </Text>
          {endereco ? (
            <View style={styles.enderecoLinha}>
              <MapPin size={18} color={colors.onSurfaceVariant} />
              <Text style={styles.endereco}>
                {endereco}
                {hospital.endereco?.uf ? ` — ${hospital.endereco.uf}` : ""}
              </Text>
            </View>
          ) : null}
        </View>

        {visitaDoHospital ? (
          <View style={styles.visita}>
            <Text style={styles.visitaTitulo}>
              {visitaManual ? "Check-in manual ativo" : "Check-in automático ativo"}
            </Text>
            <Text accessibilityLabel={`Tempo de permanência ${temporizadorTexto}`} style={styles.temporizador}>
              {temporizadorTexto}
            </Text>
            <Text style={styles.visitaRotulo}>tempo de permanência</Text>
            {visitaManual ? (
              <CSButton
                label="Não estou aqui"
                onPress={encerrarVisitaManual}
                loading={enviandoCheckout}
                disabled={enviandoCheckout}
                variant="secondary"
                style={styles.checkoutButton}
              />
            ) : null}
          </View>
        ) : null}

        {temIndicadores ? (
          <View style={styles.metricas}>
            <View style={[styles.metrica, styles.metricaNota]}>
              <Text style={styles.notaValor}>{formatarNota(dadosIndicadores.notaMedia)}</Text>
              <CSRatingStars nota={dadosIndicadores.notaMedia} size={18} />
              <Text style={styles.metricaRotulo}>{dadosIndicadores.nAvaliacoes} avaliações</Text>
            </View>
            {espera != null ? (
              <View style={[styles.metrica, styles.metricaEspera]}>
                <Text style={styles.esperaValor}>
                  {espera}
                  <Text style={styles.esperaUnidade}> min</Text>
                </Text>
                <Text style={styles.esperaRotulo}>tempo médio de espera</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.semIndicadores}>Ainda sem avaliações suficientes</Text>
        )}

        {tendencia ? <Tendencia tendencia={tendencia} /> : null}

        {temIndicadores ? (
          <View>
            {dadosIndicadores.nVisitas != null ? (
              <Text style={styles.transparencia}>
                com base em {dadosIndicadores.nVisitas} atendimentos no período
              </Text>
            ) : null}
            {periodo ? <Text style={styles.transparencia}>Período: {periodo}</Text> : null}
            {dadosIndicadores.atualizadoEm ? (
              <Text style={styles.transparencia}>Atualizado em {formatarData(dadosIndicadores.atualizadoEm)}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.acoes}>
          <Acao icone={Navigation} rotulo="Como chegar" onPress={() => Linking.openURL(urlComoChegar(hospital))} />
          {telefone ? (
            <Acao
              icone={Phone}
              rotulo="Ligar"
              onPress={() => Linking.openURL(`tel:${telefone.replace(/[^\d+]/g, "")}`)}
            />
          ) : null}
          {email ? <Acao icone={Mail} rotulo="E-mail" onPress={() => Linking.openURL(`mailto:${email}`)} /> : null}
        </View>
      </ScrollView>

      {visitaDoHospital ? null : (
        <SafeAreaView edges={["bottom"]} style={styles.rodape}>
          <CSButton
            label="Estou aqui agora"
            icon={MapPinCheck}
            onPress={() => checkin(hospital)}
            loading={enviandoId === hospital.id}
            disabled={enviandoId !== null}
          />
          <Text style={styles.rodapeTexto}>Com a localização ligada, isso acontece sozinho.</Text>
        </SafeAreaView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scrollContent: {
    padding: spacing.s4,
    paddingTop: 0,
    gap: spacing.s4,
    paddingBottom: spacing.s8,
  },
  loadingContainer: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
  etiquetas: { flexDirection: "row", flexWrap: "wrap", gap: spacing.s2 },
  etiqueta: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s1,
  },
  etiquetaDestaque: { backgroundColor: colors.primaryContainer },
  etiquetaTexto: { ...typography.labelLg, color: colors.onSurfaceVariant },
  etiquetaTextoDestaque: { color: colors.onPrimaryContainer },
  nome: { ...typography.displayMd, color: colors.onSurface },
  enderecoLinha: { flexDirection: "row", alignItems: "center", gap: spacing.s2, marginTop: spacing.s1 },
  endereco: { ...typography.bodyLg, color: colors.onSurfaceVariant, flex: 1 },
  visita: {
    backgroundColor: colors.primaryContainer,
    borderRadius: 18,
    padding: spacing.s4,
    alignItems: "center",
  },
  visitaTitulo: { ...typography.titleMd, color: colors.onPrimaryContainer },
  temporizador: {
    fontFamily: fontes.texto,
    fontSize: 40,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.onPrimaryContainer,
    marginTop: spacing.s1,
  },
  visitaRotulo: { ...typography.bodySm, color: colors.onPrimaryContainer },
  checkoutButton: { marginTop: spacing.s3, alignSelf: "stretch" },
  metricas: { flexDirection: "row", gap: spacing.s3 },
  metrica: { flex: 1, borderRadius: 18, padding: spacing.s4, gap: spacing.s1, minHeight: 128 },
  metricaNota: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.outlineVariant },
  metricaEspera: { backgroundColor: colors.primaryContainer, justifyContent: "space-between" },
  notaValor: { fontFamily: fontes.texto, fontSize: 40, lineHeight: 46, fontWeight: "800", color: colors.onSurface },
  metricaRotulo: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  esperaValor: { fontFamily: fontes.texto, fontSize: 40, lineHeight: 46, fontWeight: "800", color: colors.onPrimaryContainer },
  esperaUnidade: { ...typography.titleLg, color: colors.onPrimaryContainer },
  esperaRotulo: { ...typography.bodyMd, color: colors.onPrimaryContainer },
  tendencia: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: spacing.s2 },
  tendenciaTexto: { ...typography.bodyMd, color: colors.onSurface, flexShrink: 1 },
  transparencia: { ...typography.bodySm, color: colors.onSurfaceVariant },
  semIndicadores: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  acoes: { flexDirection: "row", gap: spacing.s3 },
  acao: {
    flex: 1,
    alignItems: "center",
    gap: spacing.s1,
    paddingVertical: spacing.s4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  acaoTexto: { ...typography.labelLg, color: colors.onSurface },
  rodape: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s3,
    gap: spacing.s2,
    borderTopWidth: 1,
    borderTopColor: colors.outlineVariant,
    backgroundColor: colors.surface,
  },
  rodapeTexto: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: "center", paddingBottom: spacing.s2 },
});
