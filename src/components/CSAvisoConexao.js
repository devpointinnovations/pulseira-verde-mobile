import React, { useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View } from "react-native";
import { onlineManager } from "@tanstack/react-query";
import { CloudUpload, WifiOff } from "lucide-react-native";
import { observarFila, tamanhoDaFila } from "../config/filaOffline";
import { colors, spacing, typography } from "../theme/tokens";

const estaOnline = () => onlineManager.isOnline();
const observarRede = (avisar) => onlineManager.subscribe(avisar);

function descrever(online, pendentes) {
  const envios = pendentes === 1 ? "1 registro aguardando envio" : `${pendentes} registros aguardando envio`;
  if (online) {
    return `Enviando: ${envios}.`;
  }
  return pendentes > 0
    ? `Sem internet. ${envios}, que sai sozinho quando a conexão voltar.`
    : "Sem internet. Mostrando o que está guardado no celular.";
}

/**
 * Aviso acima da tab bar (offline total, 21/11/2026): diz que o app está sem internet e
 * quantos registros (visita, avaliação, sugestão, consentimento) esperam na fila offline.
 * Some sozinho quando há rede e a fila esvaziou.
 */
export default function CSAvisoConexao() {
  const online = useSyncExternalStore(observarRede, estaOnline);
  const [pendentes, setPendentes] = useState(0);

  useEffect(() => {
    let ativo = true;
    tamanhoDaFila()
      .then((total) => ativo && setPendentes(total))
      .catch(() => {});
    const parar = observarFila(setPendentes);
    return () => {
      ativo = false;
      parar();
    };
  }, []);

  if (online && pendentes === 0) {
    return null;
  }

  const Icone = online ? CloudUpload : WifiOff;
  return (
    <View style={styles.aviso} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Icone size={16} color={colors.onWarning} importantForAccessibility="no" accessibilityElementsHidden />
      <Text style={styles.texto}>{descrever(online, pendentes)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    backgroundColor: colors.warningBg,
  },
  texto: { ...typography.bodySm, color: colors.onWarning, flex: 1 },
});
