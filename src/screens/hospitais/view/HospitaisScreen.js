import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { Map as MapIcon, MapPinOff, Search, Timer } from "lucide-react-native";
import {
  CSHospitalCard,
  CSEmptyState,
  CSLoadingList,
  CSChip,
  CSTextField,
  CSIconButton,
} from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import {
  recarregarListaDeHospitais,
  useHospital,
  useListaDeHospitais,
} from "../hooks/useHospitais";
import { useCheckinNoHospital } from "../../visitas/hooks/useCheckinNoHospital";
import { useVisitaAtivaDaTela } from "../../visitas/hooks/useVisitaAtivaDaTela";
import { duracaoMinutosDesde } from "../../../utils/format";

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

/**
 * Aviso da visita em andamento no topo do Início (layout novo). Os minutos se atualizam
 * sozinhos; o toque abre a tela da visita.
 */
function AvisoVisita({ visita, hospitalNome, onPress }) {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const minutos = duracaoMinutosDesde(visita.entrada, agora);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Visita em andamento${hospitalNome ? ` em ${hospitalNome}` : ""}`}
      onPress={onPress}
      style={styles.aviso}
    >
      <View style={styles.avisoIcone}>
        <Timer size={22} color={colors.onPrimary} />
      </View>
      <View style={styles.avisoTextos}>
        <Text style={styles.avisoRotulo}>Visita em andamento</Text>
        <Text style={styles.avisoHospital} numberOfLines={1}>
          {hospitalNome || "Hospital"}
        </Text>
      </View>
      {minutos === undefined ? null : (
        <Text style={styles.avisoMinutos}>
          {minutos}
          <Text style={styles.avisoMin}> min</Text>
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Listagem pública de hospitais ativos (E1-03).
 *
 * Navegação revisada: cada card ganhou um botão compacto de check-in manual. Ao tocar
 * em "Check-in", o app registra a visita (origem MANUAL) e redireciona para o
 * `HospitalDetalhe`, que exibe o temporizador e o botão de checkout quando a visita
 * ativa é do modo manual. O corpo do card (fora do botão) continua abrindo o detalhe
 * como antes.
 */
export default function HospitaisScreen({ navigation }) {
  const [busca, setBusca] = useState("");
  // Termo que de fato filtra a lista, 400 ms depois da última tecla: sem isso, cada letra
  // digitada refaria o filtro e a ordenação do catálogo inteiro.
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [tipo, setTipo] = useState("");

  useEffect(() => {
    const espera = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(espera);
  }, [busca]);

  // A lista sai da cópia do catálogo guardada no aparelho, filtrada e ordenada aqui, sem
  // ir ao servidor (pedido do PO de 22/10/2026). O catálogo só é baixado de novo quando a
  // versão dele muda na configuração remota. Nota e tempo vêm numa resposta só, válida por
  // 5 minutos.
  const { catalogo, indicadores, hospitais: dados } = useListaDeHospitais({
    busca: buscaAplicada,
    tipo,
  });
  const recarregarCatalogo = catalogo.refetch;
  const erro =
    catalogo.error && !catalogo.data
      ? catalogo.error.message || "Não foi possível carregar os hospitais."
      : null;
  const semIndicadores = Boolean(indicadores.error) && Boolean(catalogo.data);

  const cliente = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);
  const atualizar = useCallback(() => {
    setAtualizando(true);
    void recarregarListaDeHospitais(cliente).finally(() => setAtualizando(false));
  }, [cliente]);

  // Visita ativa compartilhada com o observador global, recarregada ao focar a aba (e
  // ao voltar do detalhe) para refletir o botão de check-in de cada hospital (modo
  // anônimo via dispositivoId, §3.3). Sem conexão não é "sem visita ativa".
  const { visita: visitaAtiva, definirLocal: definirVisitaLocal } = useVisitaAtivaDaTela();

  // Pedido do PO (10/09/2026): o hospital do check-in ativo aparece no topo, sem
  // precisar procurá-lo na lista.
  // Buscado à parte e compartilhado com o detalhe pela mesma chave. Falha silenciosa
  // de propósito (ex.: sem conexão): a lista continua, só sem o destaque.
  const { data: hospitalDoCheckin } = useHospital(visitaAtiva?.hospitalId);
  const hospitalCheckinAtivo = visitaAtiva?.hospitalId ? hospitalDoCheckin ?? null : null;

  // Hospital do check-in ativo primeiro, sem duplicá-lo caso já esteja em `dados`.
  const dadosComDestaque = useMemo(() => {
    if (!hospitalCheckinAtivo) {
      return dados;
    }
    const semODuplicado = dados.filter((h) => h.id !== hospitalCheckinAtivo.id);
    return [hospitalCheckinAtivo, ...semODuplicado];
  }, [dados, hospitalCheckinAtivo]);

  const abrirDetalhe = useCallback(
    (hospital) => {
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    },
    [navigation]
  );

  // Mesmas regras do "Estou aqui agora" do detalhe; o check-in aceito abre o detalhe, que
  // mostra o tempo e o "Não estou aqui".
  const { checkin: fazerCheckin, enviandoId: checkinEnviandoId } = useCheckinNoHospital({
    visitaAtiva,
    definirLocal: definirVisitaLocal,
    aoEntrar: abrirDetalhe,
  });

  // ARQ-05: extraido do JSX e memoizado. Inline, ele criava uma funcao nova a cada
  // render da tela, e com ela um `onPress`/`onCheckin` novo por item -- o que anularia
  // o React.memo do CSHospitalCard por identidade de prop.
  const renderItem = useCallback(
    ({ item }) => (
      <CSHospitalCard
        hospital={item}
        onPress={abrirDetalhe}
        onCheckin={fazerCheckin}
        checkinLoading={checkinEnviandoId === item.id}
        checkinAtivo={visitaAtiva?.hospitalId === item.id}
        checkinDesabilitado={
          (checkinEnviandoId !== null && checkinEnviandoId !== item.id) ||
          (visitaAtiva !== null && visitaAtiva.hospitalId !== item.id)
        }
      />
    ),
    [abrirDetalhe, fazerCheckin, checkinEnviandoId, visitaAtiva]
  );

  // ARQ-05 / achado do code-review: o ListEmptyComponent e renderizado como
  // <ListEmptyComponent /> pelo VirtualizedList, entao identidade nova = TIPO novo de
  // elemento, e o React desmonta e remonta a subarvore inteira. Sem isto, cada tecla
  // digitada numa busca sem resultado reconstruia o estado vazio do zero.
  const renderVazio = useCallback(() => {
    const temFiltro = busca.trim() || tipo;

    if (erro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => recarregarCatalogo()}
        />
      );
    }

    if (temFiltro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Nenhum hospital encontrado"
          message="Tente ajustar a busca ou o filtro."
        />
      );
    }

    return (
      <CSEmptyState
        icon={MapPinOff}
        title="Nenhum hospital por aqui"
        message="Sugira um hospital que ainda não esteja cadastrado."
        actionLabel="Sugerir hospital"
        onAction={() => navigation.navigate("SugerirHospital")}
      />
    );
  }, [busca, tipo, erro, recarregarCatalogo, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.searchArea}>
        <View style={styles.buscaLinha}>
          <View style={styles.buscaCampo}>
            <CSTextField
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar hospital ou UPA"
              icon={Search}
            />
          </View>
          <CSIconButton
            icon={MapIcon}
            color={colors.primary}
            onPress={() => navigation.navigate("MapaTela")}
            accessibilityLabel="Ver hospitais no mapa"
          />
        </View>

        {visitaAtiva ? (
          <AvisoVisita
            visita={visitaAtiva}
            hospitalNome={hospitalCheckinAtivo?.nome}
            onPress={() => navigation.navigate("VisitaEmAndamento")}
          />
        ) : null}

        <View style={styles.tituloLinha}>
          <Text style={styles.titulo} accessibilityRole="header">
            Perto de você
          </Text>
          <Pressable accessibilityRole="link" onPress={() => navigation.navigate("Ranking")} hitSlop={12}>
            <Text style={styles.verRanking}>Ver ranking</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {TIPO_FILTROS.map((f) => (
            <CSChip
              key={f.value || "todos"}
              label={f.label}
              selected={tipo === f.value}
              onPress={() => setTipo(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {semIndicadores ? (
        // Sem o aviso, a falta de nota (ou uma nota de antes da queda) pareceria atual.
        <Text style={styles.avisoCopia} accessibilityRole="alert">
          Sem conexão com o servidor. Mostrando a lista guardada no aparelho, sem notas e
          tempos atualizados. Puxe para tentar de novo.
        </Text>
      ) : null}

      {catalogo.isPending ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          testID="lista-hospitais"
          data={dadosComDestaque}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderVazio}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={atualizar}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  searchArea: {
    padding: spacing.s4,
    gap: spacing.s3,
  },
  buscaLinha: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  buscaCampo: { flex: 1 },
  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.s1,
  },
  titulo: { ...typography.headlineMd, color: colors.onSurface },
  verRanking: { ...typography.labelLg, color: colors.primary },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.s2,
  },
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    backgroundColor: colors.primary,
    borderRadius: 18,
    padding: spacing.s4,
  },
  avisoIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  avisoTextos: { flex: 1 },
  avisoRotulo: { ...typography.bodySm, color: colors.onPrimary, opacity: 0.9 },
  avisoHospital: { ...typography.titleMd, color: colors.onPrimary, fontWeight: "700" },
  avisoMinutos: { fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.onPrimary },
  avisoMin: { ...typography.bodyMd, color: colors.onPrimary },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
    flexGrow: 1,
  },
  avisoCopia: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s3,
  },
});
