import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Clock, Hospital, MapPin, MessageCircleHeart, ShieldCheck, Star } from "lucide-react-native";
import CSButton from "../../../components/CSButton";
import { colors, radii, spacing, typography } from "../../../theme/tokens";
import { concluirOnboarding } from "../service/OnboardingService";
import { iniciarGeofencing } from "../../visitas/service/GeofencingTaskService";
import { solicitarPermissaoNotificacao } from "../../../services/NotificacaoPermissao";
import PerfilService from "../../perfil/service/PerfilService";

/**
 * Pedido de localização: o mesmo do geofencing (primeiro plano, explicação e "o tempo todo").
 * A decisão vai para o registro de consentimento (E5-05), como no Perfil.
 */
async function pedirLocalizacao() {
  await iniciarGeofencing();
  const status = await PerfilService.permissaoLocalizacao();
  await PerfilService.atualizarConsentimento({ localizacao: status === "granted" });
}

async function pedirAvisos() {
  const autorizado = await solicitarPermissaoNotificacao();
  await PerfilService.atualizarConsentimento({ notificacoes: autorizado });
}

const ETAPAS = [
  {
    Icone: Hospital,
    destaques: [
      { Icone: Star, texto: "4,7", estilo: "topo" },
      { Icone: Clock, texto: "40 min de espera", estilo: "base" },
    ],
    titulo: "Saiba qual hospital atende melhor perto de você",
    texto: "Veja a nota e o tempo de espera de cada hospital, contados por quem passou por lá.",
    principal: "Continuar",
  },
  {
    Icone: MapPin,
    destaques: [{ Icone: Clock, texto: "Chegou às 14:02", estilo: "base" }],
    titulo: "O app percebe quando você chega ao hospital",
    texto:
      "Com a localização ligada, ele conta o tempo da sua visita sozinho. Você não precisa abrir nem apertar nada.",
    porque: "Só usamos sua localização perto de hospitais. Ela nunca é publicada.",
    principal: "Permitir localização",
    acao: pedirLocalizacao,
    secundaria: "Agora não",
  },
  {
    Icone: MessageCircleHeart,
    destaques: [{ Icone: Bell, texto: "Como foi a visita?", estilo: "base" }],
    titulo: "Na saída, conte como foi em 1 minuto",
    texto: "Avisamos quando a visita terminar. Sua avaliação é anônima e ajuda outras pessoas a escolher.",
    principal: "Ativar avisos",
    acao: pedirAvisos,
    secundaria: "Começar sem avisos",
  },
];

/**
 * Apresentação do novo layout (3 telas): o que o app mostra, o pedido de localização e o
 * pedido de avisos, cada um com o motivo antes da pergunta do sistema. Aparece uma vez;
 * "Pular" e as respostas negativas levam ao app do mesmo jeito.
 */
export default function OnboardingScreen({ navigation }) {
  const [indice, setIndice] = useState(0);
  const [processando, setProcessando] = useState(false);
  const etapa = ETAPAS[indice];
  const ultima = indice === ETAPAS.length - 1;

  const concluir = async () => {
    await concluirOnboarding();
    // Aberta pelo "Como funciona" do Perfil, volta para lá; na primeira abertura, vai às abas.
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.reset({ index: 0, routes: [{ name: "Tabs" }] });
    }
  };

  const avancar = () => {
    if (ultima) {
      void concluir();
    } else {
      setIndice(indice + 1);
    }
  };

  const confirmar = async () => {
    setProcessando(true);
    try {
      await etapa.acao?.();
    } catch {
      // Permissão negada ou registro sem rede: a pessoa segue, e o Perfil permite mudar depois.
    } finally {
      setProcessando(false);
    }
    avancar();
  };

  const { Icone } = etapa;
  return (
    <SafeAreaView style={styles.tela}>
      <Pressable
        style={styles.pular}
        onPress={() => void concluir()}
        accessibilityRole="button"
        accessibilityLabel="Pular apresentação"
        hitSlop={12}
      >
        <Text style={styles.pularTexto}>Pular</Text>
      </Pressable>

      <View style={styles.arte} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.anel, styles.anelExterno]} />
        <View style={[styles.anel, styles.anelMedio]} />
        <View style={[styles.anel, styles.anelInterno]} />
        <View style={styles.simbolo}>
          <Icone size={44} color={colors.onPrimary} />
        </View>
        {etapa.destaques.map(({ Icone: IconeDestaque, texto, estilo }) => (
          <View key={texto} style={[styles.destaque, estilo === "topo" ? styles.destaqueTopo : styles.destaqueBase]}>
            <IconeDestaque
              size={14}
              color={IconeDestaque === Star ? colors.ratingFilled : colors.onSurface}
              fill={IconeDestaque === Star ? colors.ratingFilled : "transparent"}
            />
            <Text style={styles.destaqueTexto}>{texto}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.titulo} accessibilityRole="header">
        {etapa.titulo}
      </Text>
      <Text style={styles.texto}>{etapa.texto}</Text>
      {etapa.porque ? (
        <View style={styles.porque}>
          <ShieldCheck size={18} color={colors.primary} />
          <Text style={styles.porqueTexto}>{etapa.porque}</Text>
        </View>
      ) : null}

      <View style={styles.rodape}>
        <View style={styles.pontos} accessibilityLabel={`Tela ${indice + 1} de ${ETAPAS.length}`}>
          {ETAPAS.map((item, i) => (
            <View key={item.titulo} style={[styles.ponto, i === indice && styles.pontoAtivo]} />
          ))}
        </View>
        <CSButton label={etapa.principal} onPress={etapa.acao ? () => void confirmar() : avancar} loading={processando} />
        {etapa.secundaria ? (
          <CSButton label={etapa.secundaria} variant="tertiary" onPress={avancar} disabled={processando} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.s6,
    paddingBottom: spacing.s6,
  },
  pular: { alignSelf: "flex-end", paddingVertical: spacing.s3, minHeight: 44, justifyContent: "center" },
  pularTexto: { ...typography.labelLg, fontSize: 15, color: colors.onSurfaceVariant },
  arte: { height: 300, alignItems: "center", justifyContent: "center", marginBottom: spacing.s3 },
  anel: { position: "absolute", borderRadius: radii.full, backgroundColor: colors.primaryContainer },
  anelExterno: { width: 280, height: 280, opacity: 0.35 },
  anelMedio: { width: 210, height: 210, opacity: 0.6 },
  anelInterno: { width: 140, height: 140 },
  simbolo: {
    width: 96,
    height: 96,
    borderRadius: radii.xxl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 28,
    elevation: 8,
  },
  destaque: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  destaqueTopo: { top: 36, right: 8 },
  destaqueBase: { bottom: 40, left: 4 },
  destaqueTexto: { ...typography.bodyMd, color: colors.onSurface, fontWeight: "600" },
  titulo: { fontSize: 30, lineHeight: 36, fontWeight: "800", letterSpacing: -0.6, color: colors.onSurface, marginBottom: spacing.s3 },
  texto: { fontSize: 17, lineHeight: 26, color: colors.onSurfaceVariant },
  porque: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    backgroundColor: colors.surfaceContainerLowest,
  },
  porqueTexto: { ...typography.bodyMd, color: colors.onSurfaceVariant, flex: 1 },
  rodape: { marginTop: "auto", gap: spacing.s1 },
  pontos: { flexDirection: "row", gap: 6, marginBottom: 18 },
  ponto: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.outlineVariant },
  pontoAtivo: { width: 24, backgroundColor: colors.primary },
});
