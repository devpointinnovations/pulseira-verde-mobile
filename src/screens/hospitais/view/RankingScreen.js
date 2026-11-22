import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Info, Trophy } from "lucide-react-native";
import {
  CSHeader,
  CSEmptyState,
  CSLoadingList,
  CSChip,
} from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import { useRankingHospitais } from "../hooks/useHospitais";
import { useAcoesListaPaginada } from "../../../core/query/useAcoesListaPaginada";
import { CATEGORIA_LABEL, TIPO_LABEL } from "../../../components/CSHospitalCard";
import { avaliacaoSuficiente } from "../../../utils/indicadores";
import { formatarDuracao, formatarNota } from "../../../utils/format";

const ORDENS = [
  { value: "NOTA", label: "Melhor nota" },
  { value: "TEMPO", label: "Menor espera" },
];

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

/** Linha do ranking (layout novo): posição, nome, tipo, nota e espera. */
const LinhaRanking = React.memo(function LinhaRanking({ hospital, posicao, onPress }) {
  const indicadores = avaliacaoSuficiente(hospital.indicadores) ? hospital.indicadores : null;
  const tipoLabel = TIPO_LABEL[hospital.tipo] || hospital.tipo || "Hospital";
  const categoriaLabel = CATEGORIA_LABEL[hospital.categoria] || hospital.categoria;
  const unidade = typeof hospital.tipoUnidade === "string" && hospital.tipoUnidade.trim() ? hospital.tipoUnidade : null;
  const espera = indicadores?.tempoMedianoMinutos != null ? formatarDuracao(indicadores.tempoMedianoMinutos) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hospital.nome}, ${categoriaLabel || tipoLabel}`}
      onPress={() => onPress(hospital)}
      style={({ pressed }) => [styles.linha, pressed && styles.linhaPressionada]}
    >
      <View style={[styles.posicao, posicao === 1 && styles.posicaoPrimeiro]}>
        <Text style={[styles.posicaoTexto, posicao === 1 && styles.posicaoTextoPrimeiro]}>{posicao}º</Text>
      </View>
      <View style={styles.linhaTextos}>
        <Text style={styles.nome} numberOfLines={1}>
          {hospital.nome}
        </Text>
        <Text style={styles.subtitulo} numberOfLines={1}>
          {[unidade || categoriaLabel, tipoLabel].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <View style={styles.valores}>
        <Text style={styles.nota}>{indicadores ? formatarNota(indicadores.notaMedia) : "—"}</Text>
        {espera ? <Text style={styles.espera}>{espera}</Text> : null}
      </View>
    </Pressable>
  );
});

/**
 * Ranking público de hospitais (E4-05).
 *
 * Consome `GET /api/v1/hospitais/ranking`, que já devolve a lista ordenada
 * globalmente (nota desc ou tempo asc) com os hospitais sem amostra suficiente
 * (RN-15) ao final. A tela não reordena nada no cliente: apenas troca `ordem`/`tipo`
 * e pagina de forma incremental conforme o usuário rola (`useRankingHospitais`).
 */
export default function RankingScreen({ navigation }) {
  const [ordem, setOrdem] = useState("NOTA");
  const [tipo, setTipo] = useState("");

  // Cada critério (ordem/tipo) é uma chave própria: a posição no ranking é global, então
  // trocar o critério recomeça da primeira página, e uma página pedida sob o critério
  // anterior é descartada pela biblioteca (antes: `geracaoRef` e `buscandoMaisRef`).
  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useRankingHospitais({ ordem, tipo });
  const dados = data ?? [];
  const erro = error && !data ? error.message || "Não foi possível carregar o ranking." : null;

  const { atualizando, atualizar, carregarMais } = useAcoesListaPaginada({
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  });

  const abrirDetalhe = useCallback(
    (hospital) => {
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    },
    [navigation]
  );

  // ARQ-05: renderItem memoizado; a linha recebe o próprio hospital no toque.
  const renderItem = useCallback(
    ({ item, index }) => <LinhaRanking hospital={item} posicao={index + 1} onPress={abrirDetalhe} />,
    [abrirDetalhe]
  );

  // Mesma correcao do ListEmptyComponent aplicada na HospitaisScreen.
  const renderVazio = useCallback(() => {
    if (erro) {
      return (
        <CSEmptyState
          icon={Trophy}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
        />
      );
    }

    return (
      <CSEmptyState
        icon={Trophy}
        title="Ranking ainda em formação"
        message="Assim que os hospitais tiverem avaliações suficientes, eles aparecem aqui."
      />
    );
  }, [erro, refetch]);

  const legenda =
    ordem === "NOTA"
      ? "Ordenado pela nota média das avaliações."
      : "Ordenado pelo menor tempo mediano de atendimento.";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {(navigation?.getState?.()?.index ?? 0) > 0 ? <CSHeader title="" onBack={() => navigation.goBack()} /> : null}
      <Text style={styles.titulo} accessibilityRole="header">
        Ranking
      </Text>

      <View style={styles.filtros}>
        <View style={styles.segmentos} accessibilityRole="tablist">
          {ORDENS.map((o) => (
            <Pressable
              key={o.value}
              accessibilityRole="tab"
              accessibilityLabel={`Ordenar por ${o.label.toLowerCase()}`}
              accessibilityState={{ selected: ordem === o.value }}
              onPress={() => setOrdem(o.value)}
              style={[styles.segmento, ordem === o.value && styles.segmentoAtivo]}
            >
              <Text style={[styles.segmentoTexto, ordem === o.value && styles.segmentoTextoAtivo]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {TIPO_FILTROS.map((f) => (
            <CSChip
              key={f.value || "todos"}
              label={f.label}
              accessibilityLabel={`Filtrar por ${f.label.toLowerCase()}`}
              selected={tipo === f.value}
              onPress={() => setTipo(f.value)}
            />
          ))}
        </ScrollView>
      </View>

      {isPending ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderVazio}
          ListFooterComponent={
            <>
              {isFetchingNextPage ? (
                <ActivityIndicator
                  style={styles.rodape}
                  color={colors.primary}
                  accessibilityLabel="Carregando mais hospitais"
                />
              ) : null}
              {dados.length > 0 ? (
                <View style={styles.legendaLinha}>
                  <Info size={18} color={colors.onSurfaceVariant} />
                  <Text style={styles.legenda}>{legenda}</Text>
                </View>
              ) : null}
            </>
          }
          onEndReachedThreshold={0.4}
          onEndReached={carregarMais}
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
  titulo: {
    ...typography.displayMd,
    color: colors.onSurface,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s3,
  },
  filtros: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s3,
    gap: spacing.s3,
  },
  segmentos: {
    flexDirection: "row",
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 16,
    padding: 4,
  },
  segmento: { flex: 1, alignItems: "center", paddingVertical: spacing.s3, borderRadius: 12 },
  segmentoAtivo: { backgroundColor: colors.surfaceContainerLowest },
  segmentoTexto: { ...typography.titleMd, color: colors.onSurfaceVariant },
  segmentoTextoAtivo: { color: colors.onSurface },
  chipsRow: {
    flexDirection: "row",
    gap: spacing.s2,
  },
  legendaLinha: { flexDirection: "row", gap: spacing.s2, paddingTop: spacing.s4 },
  legenda: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    flexGrow: 1,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    padding: spacing.s4,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    marginTop: -1,
  },
  linhaPressionada: { backgroundColor: colors.surfaceContainerHigh },
  posicao: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceContainerHigh,
  },
  posicaoPrimeiro: { backgroundColor: colors.ratingFilled },
  posicaoTexto: { ...typography.titleMd, color: colors.onSurface },
  posicaoTextoPrimeiro: { color: colors.onPrimary },
  linhaTextos: { flex: 1 },
  nome: { ...typography.titleMd, color: colors.onSurface, fontWeight: "700" },
  subtitulo: { ...typography.bodyMd, color: colors.onSurfaceVariant },
  valores: { alignItems: "flex-end" },
  nota: { ...typography.headlineSm, color: colors.onSurface, fontWeight: "800" },
  espera: { ...typography.bodySm, color: colors.onSurfaceVariant },
  rodape: { paddingVertical: spacing.s4 },
});
