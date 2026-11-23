import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Clock, Hospital } from "lucide-react-native";
import { colors, radii, spacing, typography, fontes } from "../theme/tokens";
import { formatarDuracao, formatarNota } from "../utils/format";
import { avaliacaoSuficiente } from "../utils/indicadores";
import { normalizeText } from "../utils/normalize";
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

/** Tipo da unidade maior que isto não é um tipo ("Hospital geral", "UPA 24h"): é o nome. */
const TAMANHO_MAXIMO_DO_TIPO = 30;

/**
 * Alguns registros do CNES trazem o nome completo no tipo da unidade ("Ambulatório de
 * Diversidade de Gênero – Asa Sul"), e o card repetia o nome na linha de baixo.
 */
function tipoQueRepeteONome(tipoUnidade, nome) {
  const tipo = normalizeText(tipoUnidade);
  const nomeNormalizado = normalizeText(nome);
  return tipo.length > TAMANHO_MAXIMO_DO_TIPO || (Boolean(nomeNormalizado) && tipo.includes(nomeNormalizado));
}

/**
 * Card de hospital do layout novo (Início, mapa): ícone, nome, "Hospital geral · 1,2 km",
 * estrelas com nota e avaliações, e o tempo de espera à direita. O card inteiro abre o
 * detalhe; o check-in manual fica no detalhe ("Estou aqui agora"), como no design aprovado.
 *
 * `distancia` (texto já formatado, ex.: "1,2 km") só aparece com GPS; sem ele a linha mostra
 * só o tipo, nunca "N/D". `emVisita` destaca o card e troca a distância por "você está aqui".
 */
function CSHospitalCard({ hospital, onPress, emVisita = false, distancia = null }) {
  // ARQ-05: o card devolve o proprio `hospital` ao chamador, para a tela passar um callback
  // estável e o React.memo abaixo acertar.
  const aoTocar = useCallback(() => onPress?.(hospital), [onPress, hospital]);

  const indicadores = hospital?.indicadores;
  const temIndicadores = avaliacaoSuficiente(indicadores);
  const tipoLabel = TIPO_LABEL[hospital?.tipo] || hospital?.tipo || "Hospital";
  const categoriaLabel = CATEGORIA_LABEL[hospital?.categoria] || hospital?.categoria;
  const tipoUnidade =
    typeof hospital?.tipoUnidade === "string" &&
    hospital.tipoUnidade.trim() &&
    !tipoQueRepeteONome(hospital.tipoUnidade, hospital?.nome)
      ? hospital.tipoUnidade.trim()
      : null;

  const subtitulo = [tipoUnidade || categoriaLabel || tipoLabel, emVisita ? "você está aqui" : distancia]
    .filter(Boolean)
    .join(" · ");
  const espera = temIndicadores && indicadores.tempoMedianoMinutos != null
    ? formatarDuracao(indicadores.tempoMedianoMinutos)
    : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hospital?.nome}, ${subtitulo}`}
      onPress={aoTocar}
      style={({ pressed }) => [styles.card, emVisita && styles.cardAtivo, pressed && styles.pressed]}
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
            <Text style={[styles.ratingCount, styles.ratingCountLinha]} numberOfLines={1}>
              {indicadores.nAvaliacoes} avaliações
            </Text>
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
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
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
    fontFamily: fontes.texto,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: "700",
    color: colors.onSurface,
  },
  subtitle: {
    fontFamily: fontes.texto,
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
    fontFamily: fontes.texto,
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceVariant,
  },
  ratingCountLinha: {
    flexShrink: 1,
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
    fontFamily: fontes.texto,
    fontSize: 11,
    color: colors.onPrimaryContainer,
  },
});

// ARQ-05: memoizado. Listas de hospitais re-renderizavam todos os cards a cada
// mudanca de estado da tela (busca, filtro, visita ativa). Com o contrato de
// callback acima estabilizado, o memo passa a acertar.
export default React.memo(CSHospitalCard);
