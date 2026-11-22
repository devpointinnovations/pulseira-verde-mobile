import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Hospital } from "lucide-react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";
import { formatarDuracao, formatarNota } from "../utils/format";
import { avaliacaoSuficiente } from "../utils/indicadores";
import CSRatingStars from "./CSRatingStars";

export const TIPO_LABEL = {
  PUBLICO: "Público",
  PRIVADO: "Privado",
  FILANTROPICO: "Filantrópico",
};

export const CATEGORIA_LABEL = {
  HOSPITAL: "Hospital",
  UPA: "UPA",
  UBS: "UBS",
  OUTRO: "Outro",
};

/**
 * Card de hospital (lista/ranking) — card inteiro clicável.
 *
 * Navegação revisada: aceita `onCheckin`/`checkinLoading`/`checkinAtivo` para exibir um
 * botão compacto de check-in manual no próprio card (sem abrir o detalhe). O controle
 * fica fora do Pressable que abre o detalhe para evitar duas navegações no mesmo toque.
 *
 * `distancia` (texto já formatado, ex.: "1,2 km") é opcional — F-07, critério 3: o card
 * do mapa mostra a distância quando há GPS. Só o mapa passa a prop; a lista de
 * hospitais e o ranking ainda não (critério 4 da F-07, em aberto). Sem GPS a tela não
 * passa nada e a linha simplesmente não existe (nunca "N/D").
 */
function CSHospitalCard({
  hospital,
  onPress,
  onCheckin,
  checkinLoading,
  checkinAtivo,
  checkinDesabilitado = false,
  distancia = null,
}) {
  // ARQ-05: o card devolve o proprio `hospital` ao chamador. Antes, a tela precisava
  // criar `onPress={() => abrirDetalhe(item)}` por item, o que gerava uma prop nova a
  // cada render e anularia qualquer memoizacao. Compativel com quem ainda passa uma
  // arrow sem parametro -- o argumento e simplesmente ignorado.
  const aoTocar = useCallback(() => onPress?.(hospital), [onPress, hospital]);
  const aoTocarCheckin = useCallback(() => onCheckin?.(hospital), [onCheckin, hospital]);

  const indicadores = hospital?.indicadores;
  const temIndicadores = avaliacaoSuficiente(indicadores);
  const tipoLabel = TIPO_LABEL[hospital?.tipo] || hospital?.tipo || "Hospital";
  const categoriaLabel = CATEGORIA_LABEL[hospital?.categoria] || hospital?.categoria;
  const tipoUnidade =
    typeof hospital?.tipoUnidade === "string" && hospital.tipoUnidade.trim()
      ? hospital.tipoUnidade
      : null;

  // "Hospital geral · Público · 1,2 km de você": unidade, natureza e distância numa linha.
  const subtitulo = [tipoUnidade || categoriaLabel, tipoLabel, distancia && `${distancia} de você`]
    .filter(Boolean)
    .join(" · ");
  const espera = temIndicadores && indicadores.tempoMedianoMinutos != null
    ? formatarDuracao(indicadores.tempoMedianoMinutos)
    : null;

  return (
    <View style={[styles.card, checkinAtivo && styles.cardAtivo]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${hospital?.nome}, ${categoriaLabel || tipoLabel}`}
        onPress={aoTocar}
        style={({ pressed }) => [styles.detailsButton, pressed && styles.pressed]}
      >
        <View style={styles.avatar}>
          <Hospital size={24} color={colors.onPrimaryContainer} />
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {hospital?.nome}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitulo}
          </Text>
          {temIndicadores ? (
            <View style={styles.ratingRow}>
              <CSRatingStars nota={indicadores.notaMedia} size={13} />
              <Text style={styles.ratingValue}>{formatarNota(indicadores.notaMedia)}</Text>
              <Text style={styles.ratingCount}>{indicadores.nAvaliacoes} avaliações</Text>
            </View>
          ) : (
            <Text style={[styles.ratingCount, styles.semAvaliacao]}>Ainda sem avaliações suficientes</Text>
          )}
        </View>

        {espera ? (
          <View style={styles.espera} accessibilityLabel={`Tempo médio de espera: ${espera}`}>
            <Clock size={14} color={colors.onPrimaryContainer} />
            <Text style={styles.esperaValor}>{espera}</Text>
            <Text style={styles.esperaRotulo}>espera</Text>
          </View>
        ) : null}
      </Pressable>
      {onCheckin && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            checkinAtivo
              ? `${hospital?.nome} — ver check-in ativo`
              : `Fazer check-in em ${hospital?.nome}`
          }
          disabled={checkinLoading || checkinDesabilitado}
          onPress={aoTocarCheckin}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [
            styles.checkinButton,
            checkinAtivo && styles.checkinButtonActive,
            pressed && styles.checkinButtonPressed,
            (checkinLoading || checkinDesabilitado) && styles.checkinButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.checkinText,
              checkinAtivo && styles.checkinTextActive,
            ]}
          >
            {textoDoCheckin(checkinLoading, checkinAtivo)}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function textoDoCheckin(enviando, ativo) {
  if (enviando) {
    return "Enviando...";
  }
  return ativo ? "Em visita — ver" : "Check-in";
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: 14,
  },
  cardAtivo: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
  },
  pressed: {
    opacity: 0.85,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
    marginTop: 1,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
  },
  ratingValue: {
    ...typography.numeric,
    fontSize: 13,
    color: colors.onSurface,
  },
  ratingCount: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  semAvaliacao: {
    marginTop: 5,
  },
  espera: {
    minWidth: 60,
    paddingHorizontal: spacing.s2,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
  },
  esperaValor: {
    ...typography.numeric,
    fontSize: 15,
    color: colors.onPrimaryContainer,
  },
  esperaRotulo: {
    fontSize: 11,
    color: colors.onPrimaryContainer,
  },
  checkinButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    marginTop: spacing.s3,
    marginLeft: 56,
  },
  checkinButtonActive: {
    backgroundColor: colors.primaryContainer,
  },
  checkinButtonPressed: {
    opacity: 0.8,
  },
  checkinButtonDisabled: {
    opacity: 0.6,
  },
  checkinText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  checkinTextActive: {
    color: colors.onPrimaryContainer,
  },
});

// ARQ-05: memoizado. Listas de hospitais re-renderizavam todos os cards a cada
// mudanca de estado da tela (busca, filtro, visita ativa). Com o contrato de
// callback acima estabilizado, o memo passa a acertar.
export default React.memo(CSHospitalCard);
