import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ChevronDown, MapPinCheck, WifiOff } from "lucide-react-native";
import { CSButton, CSEmptyState, CSIconButton } from "../../../components";
import { colors, radii, spacing, typography, fontes } from "../../../theme/tokens";
import { useHospital } from "../../hospitais/hooks/useHospitais";
import { useEncerrarVisitaManual } from "../hooks/useMutacoesVisita";
import { useVisitaAtivaDaTela } from "../hooks/useVisitaAtivaDaTela";
import { duracaoMinutosDesde } from "../../../utils/format";

const AVISOS = [
  {
    icone: MapPinCheck,
    titulo: "Você não precisa fazer nada",
    texto: "O app encerra a visita sozinho quando você sair do hospital.",
  },
  {
    icone: Bell,
    titulo: "Depois, uma pergunta rápida",
    texto: "Na saída avisamos para você contar como foi. Leva 1 minuto.",
  },
  {
    icone: WifiOff,
    titulo: "Funciona sem internet",
    texto: "Se o sinal cair, guardamos tudo e enviamos depois.",
  },
];

function horaDe(iso) {
  const data = new Date(iso);
  return Number.isNaN(data.getTime())
    ? null
    : data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Visita em andamento (layout novo): minutos desde a chegada e o que acontece a seguir.
 * Aberta pelo aviso no topo do Início. "Não estou neste hospital" só aparece no check-in
 * manual, como no detalhe: a visita automática é encerrada pelo geofence (PO, 21/10/2026).
 */
export default function VisitaEmAndamentoScreen({ navigation }) {
  const { visita, definirLocal } = useVisitaAtivaDaTela();
  const { data: hospital } = useHospital(visita?.hospitalId);
  const [agora, setAgora] = useState(() => Date.now());
  const { encerrar, enviando } = useEncerrarVisitaManual({
    visita,
    hospitalNome: hospital?.nome,
    definirLocal,
  });

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const voltar = () => navigation.goBack();

  if (!visita) {
    return (
      <SafeAreaView style={styles.safe}>
        <CSEmptyState
          icon={MapPinCheck}
          title="Nenhuma visita em andamento"
          message="Quando você chegar a um hospital, a visita aparece aqui."
          actionLabel="Voltar"
          onAction={voltar}
        />
      </SafeAreaView>
    );
  }

  const minutos = duracaoMinutosDesde(visita.entrada, agora) ?? 0;
  const chegada = horaDe(visita.entrada);

  const naoEstouAqui = async () => {
    if (await encerrar()) voltar();
  };

  return (
    <View style={styles.safe}>
      <SafeAreaView edges={["top"]} style={styles.topo}>
        <View style={styles.barra}>
          <CSIconButton icon={ChevronDown} onPress={voltar} accessibilityLabel="Fechar" color={colors.onPrimary} />
          <Text style={styles.barraTitulo}>Visita em andamento</Text>
          <View style={styles.barraEspaco} />
        </View>
        <View style={styles.anel} accessibilityLabel={`${minutos} minutos de visita`}>
          <Text style={styles.minutos}>{minutos}</Text>
          <Text style={styles.minutosRotulo}>minutos</Text>
        </View>
        <Text style={styles.hospital}>{hospital?.nome || "Hospital"}</Text>
        {chegada ? <Text style={styles.chegada}>Chegada percebida às {chegada}</Text> : null}
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.lista}>
        {AVISOS.map(({ icone: Icone, titulo, texto }) => (
          <View key={titulo} style={styles.aviso}>
            <Icone size={24} color={colors.primary} />
            <View style={styles.avisoTextos}>
              <Text style={styles.avisoTitulo}>{titulo}</Text>
              <Text style={styles.avisoTexto}>{texto}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {visita.origem === "MANUAL" ? (
        <SafeAreaView edges={["bottom"]} style={styles.rodape}>
          <CSButton
            label="Não estou neste hospital"
            variant="secondary"
            onPress={naoEstouAqui}
            loading={enviando}
            disabled={enviando}
          />
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  topo: {
    backgroundColor: colors.primary,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
    alignItems: "center",
    paddingBottom: spacing.s6,
  },
  barra: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    paddingHorizontal: spacing.s2,
  },
  barraTitulo: { ...typography.titleLg, color: colors.onPrimary, flex: 1, textAlign: "center" },
  barraEspaco: { width: 48 },
  anel: {
    width: 176,
    height: 176,
    borderRadius: 88,
    borderWidth: 8,
    borderColor: "rgba(255,255,255,0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: spacing.s5,
  },
  minutos: { fontFamily: fontes.texto, fontSize: 56, lineHeight: 64, fontWeight: "800", color: colors.onPrimary },
  minutosRotulo: { ...typography.bodyLg, color: colors.onPrimary },
  hospital: {
    ...typography.headlineSm,
    color: colors.onPrimary,
    textAlign: "center",
    paddingHorizontal: spacing.s4,
  },
  chegada: { ...typography.bodyMd, color: colors.onPrimary, opacity: 0.9, marginTop: spacing.s1 },
  lista: { padding: spacing.s4 },
  aviso: {
    flexDirection: "row",
    gap: spacing.s4,
    paddingVertical: spacing.s4,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
  },
  avisoTextos: { flex: 1 },
  avisoTitulo: { ...typography.titleMd, color: colors.onSurface },
  avisoTexto: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  rodape: { padding: spacing.s4, borderTopWidth: 1, borderTopColor: colors.outlineVariant },
});
