import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { LocateFixed, Maximize2, MapPinOff, Search, Timer, User as UserIcon, X } from "lucide-react-native";
import { CSHospitalCard, CSEmptyState, CSLoadingList, CSChip } from "../../../components";
import { colors, spacing, typography, fontes, shadows } from "../../../theme/tokens";
import {
  recarregarListaDeHospitais,
  useHospital,
  useListaDeHospitais,
} from "../hooks/useHospitais";
import { usePosicaoAtual } from "../hooks/usePosicaoAtual";
import { useVisitaAtivaDaTela } from "../../visitas/hooks/useVisitaAtivaDaTela";
import { useSessao } from "../../../core/stores/sessaoStore";
import { duracaoMinutosDesde } from "../../../utils/format";
import { centroDoHospital } from "../../../utils/geojson";
import { formatarDistancia, haversineMetros } from "../../../utils/distancia";
import { alturaDaParada } from "../../../utils/folhaDeAlturas";
import FolhaDeHospitais from "./FolhaDeHospitais";
import MapaPertoDeVoce from "./MapaPertoDeVoce";

/** Chips do design: tipo da unidade ou o raio de 5 km (este depende do GPS). */
const FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "5KM", label: "Até 5 km" },
];
const FILTRO_5KM = "5KM";
const RAIO_PERTO_METROS = 5000;

/** Sugestões sob o campo de busca. */
const MAXIMO_DE_SUGESTOES = 5;
/** Altura do cartão do hospital selecionado (card + botões), para a câmera deixar a área livre. */
const ALTURA_DO_CARTAO = 190;
/** Antes de a tela medir a si mesma, usa a altura de uma tela comum. */
const ALTURA_UTIL_INICIAL = 700;

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

/** Inicial do nome no avatar da busca; sem conta, o ícone de pessoa. */
function AvatarDaBusca({ onPress }) {
  const usuario = useSessao((estado) => estado.usuario);
  const nome = (usuario?.nome || usuario?.fullName || "").trim();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir o perfil"
      onPress={onPress}
      hitSlop={6}
      style={styles.avatar}
    >
      {nome ? (
        <Text style={styles.avatarLetra}>{nome.charAt(0).toUpperCase()}</Text>
      ) : (
        <UserIcon size={20} color={colors.onPrimaryContainer} />
      )}
    </Pressable>
  );
}

/**
 * Início do layout novo (E1-03): mapa no topo com a busca e os pins de nota, e a folha
 * "Perto de você" por cima, com o aviso da visita, os filtros e a lista. Com GPS, a lista
 * vai do mais perto ao mais longe e cada card mostra a distância; sem GPS, segue a ordem do
 * catálogo. O check-in manual fica no detalhe ("Estou aqui agora"), como no design aprovado.
 */
export default function HospitaisScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  // O mapa ocupa a tela toda; a folha "Perto de você" sobe por cima dele em três alturas.
  const [alturaUtil, setAlturaUtil] = useState(ALTURA_UTIL_INICIAL);
  const [parada, setParada] = useState("meio");
  const [selecionadoId, setSelecionadoId] = useState(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [sinalDeRecentrar, setSinalDeRecentrar] = useState(0);

  const [busca, setBusca] = useState("");
  // Termo que de fato filtra a lista, 400 ms depois da última tecla: sem isso, cada letra
  // digitada refaria o filtro e a ordenação do catálogo inteiro.
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [filtro, setFiltro] = useState("");
  const pertoDeMim = filtro === FILTRO_5KM;

  useEffect(() => {
    const espera = setTimeout(() => setBuscaAplicada(busca), 400);
    return () => clearTimeout(espera);
  }, [busca]);

  // A lista sai da cópia do catálogo guardada no aparelho, filtrada aqui, sem ir ao servidor
  // (pedido do PO de 22/10/2026). Nota e tempo vêm numa resposta só, válida por 5 minutos.
  const { catalogo, indicadores, hospitais: dados } = useListaDeHospitais({
    busca: buscaAplicada,
    tipo: pertoDeMim ? "" : filtro,
  });
  const recarregarCatalogo = catalogo.refetch;
  const erro =
    catalogo.error && !catalogo.data
      ? catalogo.error.message || "Não foi possível carregar os hospitais."
      : null;
  const semIndicadores = Boolean(indicadores.error) && Boolean(catalogo.data);

  const posicao = usePosicaoAtual();

  // Distância de cada hospital até a pessoa; com GPS, do mais perto ao mais longe.
  const comDistancia = useMemo(() => {
    if (!posicao) {
      return dados.map((hospital) => ({ hospital, metros: null }));
    }
    return dados
      .map((hospital) => ({ hospital, metros: haversineMetros(posicao, centroDoHospital(hospital)) }))
      .sort((a, b) => (a.metros ?? Infinity) - (b.metros ?? Infinity));
  }, [dados, posicao]);

  const cliente = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);
  const atualizar = useCallback(() => {
    setAtualizando(true);
    void recarregarListaDeHospitais(cliente).finally(() => setAtualizando(false));
  }, [cliente]);

  // Visita ativa compartilhada com o observador global, recarregada ao focar a aba. Sem
  // conexão não é "sem visita ativa".
  const { visita: visitaAtiva } = useVisitaAtivaDaTela();

  // Pedido do PO (10/09/2026): o hospital da visita ativa aparece no topo, sem precisar
  // procurá-lo. Buscado à parte e compartilhado com o detalhe pela mesma chave; uma falha
  // (ex.: sem conexão) só tira o destaque.
  const { data: hospitalDoCheckin } = useHospital(visitaAtiva?.hospitalId);
  const hospitalCheckinAtivo = visitaAtiva?.hospitalId ? hospitalDoCheckin ?? null : null;

  const itens = useMemo(() => {
    const visiveis = pertoDeMim
      ? comDistancia.filter(({ metros }) => metros !== null && metros <= RAIO_PERTO_METROS)
      : comDistancia;
    if (!hospitalCheckinAtivo) {
      return visiveis;
    }
    const semODuplicado = visiveis.filter(({ hospital }) => hospital.id !== hospitalCheckinAtivo.id);
    // O da cópia do catálogo traz os indicadores; o buscado à parte, só se não estiver nela.
    const doCatalogo = comDistancia.find(({ hospital }) => hospital.id === hospitalCheckinAtivo.id);
    return [doCatalogo ?? { hospital: hospitalCheckinAtivo, metros: null }, ...semODuplicado];
  }, [comDistancia, pertoDeMim, hospitalCheckinAtivo]);

  // Pins do mapa: os mais perto (com GPS) ou os primeiros do catálogo, com a nota do servidor.
  const hospitaisDoMapa = useMemo(() => comDistancia.map(({ hospital }) => hospital), [comDistancia]);

  // Hospital escolhido na lista, na busca ou num pin: o mapa o mostra e o cartão resume. Sai
  // da lista visível; se a busca o tirar dela, a seleção some em vez de mostrar dado velho.
  const selecionadoItem = useMemo(
    () => itens.find(({ hospital }) => hospital.id === selecionadoId) ?? null,
    [itens, selecionadoId]
  );
  const selecionado = selecionadoItem?.hospital ?? null;

  const selecionar = useCallback((hospital) => {
    setSelecionadoId(hospital.id);
    setParada("recolhida");
    setSugestoesAbertas(false);
  }, []);
  const limparSelecao = useCallback(() => {
    setSelecionadoId(null);
    setParada((atual) => (atual === "recolhida" ? "meio" : atual));
  }, []);
  const recentrar = useCallback(() => {
    limparSelecao();
    setSinalDeRecentrar((n) => n + 1);
  }, [limparSelecao]);

  // BUG-04: o mapa sai da árvore ANTES de navegar ao detalhe (o toque atrasado de um mapa
  // destruído travava o app); quem navega é o efeito seguinte, com o desmonte já confirmado.
  const [mapaVisivel, setMapaVisivel] = useState(true);
  const detalhePendente = useRef(null);
  const abrirDetalhe = useCallback((hospital) => {
    detalhePendente.current = hospital.id;
    setMapaVisivel(false);
  }, []);
  useEffect(() => {
    if (mapaVisivel || !detalhePendente.current) {
      return;
    }
    const id = detalhePendente.current;
    detalhePendente.current = null;
    navigation.navigate("HospitalDetalhe", { id });
  }, [mapaVisivel, navigation]);

  const abrirMapa = useCallback(() => navigation.navigate("MapaTela"), [navigation]);
  const abrirPerfil = useCallback(() => navigation.navigate("Perfil"), [navigation]);

  // O mapa só existe com a aba à vista: sai ao abrir outra tela (um mapa a menos na memória
  // enquanto o mapa completo ou o detalhe estão abertos) e volta ao reabrir.
  useEffect(() => {
    const removerFoco = navigation?.addListener?.("focus", () => setMapaVisivel(true));
    const removerSaida = navigation?.addListener?.("blur", () => setMapaVisivel(false));
    return () => {
      removerFoco?.();
      removerSaida?.();
    };
  }, [navigation]);

  // Sugestões só quando a lista já reflete o que foi digitado (o filtro espera 400 ms).
  const sugestoes = useMemo(
    () =>
      sugestoesAbertas && busca.trim() && busca === buscaAplicada
        ? itens.slice(0, MAXIMO_DE_SUGESTOES)
        : [],
    [sugestoesAbertas, busca, buscaAplicada, itens]
  );
  const digitar = useCallback((texto) => {
    setBusca(texto);
    setSugestoesAbertas(true);
  }, []);
  const limparBusca = useCallback(() => {
    setBusca("");
    setSugestoesAbertas(false);
  }, []);
  const escolherSugestao = useCallback(
    (hospital) => {
      setBusca(hospital.nome);
      selecionar(hospital);
    },
    [selecionar]
  );

  // ARQ-05: memoizado; inline, cada render criaria um `onPress` novo por card e anularia o
  // React.memo do CSHospitalCard.
  const renderItem = useCallback(
    ({ item }) => (
      <CSHospitalCard
        hospital={item.hospital}
        onPress={selecionar}
        emVisita={visitaAtiva?.hospitalId === item.hospital.id}
        distancia={formatarDistancia(item.metros)}
      />
    ),
    [selecionar, visitaAtiva]
  );

  // ARQ-05: o ListEmptyComponent é renderizado como elemento; identidade nova a cada render
  // remontaria o estado vazio a cada tecla.
  const renderVazio = useCallback(() => {
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

    if (pertoDeMim && !posicao) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Sem a sua localização"
          message="Ligue a localização para ver os hospitais a até 5 km de você."
        />
      );
    }

    if (busca.trim() || filtro) {
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
  }, [busca, filtro, pertoDeMim, posicao, erro, recarregarCatalogo, navigation]);

  const margemSuperior = insets.top + spacing.s3 + 56 + spacing.s4;
  const margemInferior = alturaDaParada("recolhida", alturaUtil) + ALTURA_DO_CARTAO + spacing.s4;
  const semLocalizacao = Boolean(selecionado) && !centroDoHospital(selecionado);
  const mostrarCartao = Boolean(selecionado) && parada !== "expandida";

  return (
    <View
      testID="tela-inicio"
      style={styles.tela}
      onLayout={(evento) => setAlturaUtil(Math.round(evento.nativeEvent.layout.height))}
    >
      {mapaVisivel ? (
        <MapaPertoDeVoce
          hospitais={hospitaisDoMapa}
          selecionado={selecionado}
          posicao={posicao}
          aoSelecionar={selecionar}
          sinalDeRecentrar={sinalDeRecentrar}
          margemSuperior={margemSuperior}
          margemInferior={margemInferior}
          altura={alturaUtil}
        />
      ) : (
        <View style={[styles.mapaAusente, { height: alturaUtil }]} />
      )}

      <View style={[styles.busca, { top: insets.top + spacing.s3 }]}>
        <View style={styles.buscaLinha}>
          <Search size={22} color={colors.onSurfaceVariant} />
          <TextInput
            value={busca}
            onChangeText={digitar}
            onSubmitEditing={() => sugestoes[0] && escolherSugestao(sugestoes[0].hospital)}
            placeholder="Buscar hospital ou UPA"
            placeholderTextColor={colors.onSurfaceVariant}
            accessibilityLabel="Buscar hospital ou UPA"
            style={styles.buscaCampo}
            returnKeyType="search"
          />
          {busca ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Limpar a busca"
              onPress={limparBusca}
              hitSlop={6}
              style={styles.limparBusca}
            >
              <X size={20} color={colors.onSurfaceVariant} />
            </Pressable>
          ) : (
            <AvatarDaBusca onPress={abrirPerfil} />
          )}
        </View>
        {sugestoes.length > 0 ? (
          <View testID="sugestoes-da-busca">
            {sugestoes.map(({ hospital, metros }) => (
              <Pressable
                key={hospital.id}
                accessibilityRole="button"
                accessibilityLabel={`Mostrar ${hospital.nome} no mapa`}
                onPress={() => escolherSugestao(hospital)}
                style={styles.sugestao}
              >
                <Text style={styles.sugestaoNome} numberOfLines={1}>
                  {hospital.nome}
                </Text>
                {metros === null ? null : <Text style={styles.sugestaoDistancia}>{formatarDistancia(metros)}</Text>}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={[styles.botoesDoMapa, { top: margemSuperior - spacing.s4 + 8 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Centralizar na minha posição"
          onPress={recentrar}
          style={styles.botaoDoMapa}
        >
          <LocateFixed size={24} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir o mapa completo"
          onPress={abrirMapa}
          style={styles.botaoDoMapa}
        >
          <Maximize2 size={22} color={colors.primary} />
        </Pressable>
      </View>

      {mostrarCartao ? (
        <View
          testID="cartao-do-hospital"
          style={[styles.cartao, { bottom: alturaDaParada(parada, alturaUtil) + spacing.s3 }]}
        >
          <CSHospitalCard
            hospital={selecionado}
            onPress={abrirDetalhe}
            distancia={formatarDistancia(selecionadoItem.metros)}
          />
          {semLocalizacao ? <Text style={styles.semLocalizacao}>Este hospital está sem localização no mapa.</Text> : null}
          <View style={styles.cartaoBotoes}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver detalhes de ${selecionado.nome}`}
              onPress={() => abrirDetalhe(selecionado)}
              style={styles.verDetalhes}
            >
              <Text style={styles.verDetalhesTexto}>Ver detalhes</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fechar o cartão do hospital"
              onPress={limparSelecao}
              style={styles.fecharCartao}
            >
              <X size={20} color={colors.onSurface} />
            </Pressable>
          </View>
        </View>
      ) : null}

      <FolhaDeHospitais parada={parada} aoMudarParada={setParada} alturaUtil={alturaUtil}>
        <View style={styles.cabecalho}>
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
            {FILTROS.map((f) => (
              <CSChip
                key={f.value || "todos"}
                label={f.label}
                selected={filtro === f.value}
                onPress={() => setFiltro(f.value)}
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

        <View style={styles.listaArea}>
          {catalogo.isPending ? (
            <CSLoadingList count={3} />
          ) : (
            <FlatList
              testID="lista-hospitais"
              data={itens}
              keyExtractor={(item) => item.hospital.id}
              renderItem={renderItem}
              ListEmptyComponent={renderVazio}
              contentContainerStyle={styles.listContent}
              // Só rola com a folha aberta: nas outras alturas o arraste é da folha.
              scrollEnabled={parada === "expandida"}
              refreshControl={
                <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={colors.primary} />
              }
            />
          )}
        </View>
      </FolhaDeHospitais>
    </View>
  );
}

const styles = StyleSheet.create({
  tela: { flex: 1, backgroundColor: colors.surface },
  mapaAusente: { backgroundColor: colors.surfaceContainer },
  busca: {
    position: "absolute",
    left: spacing.s4,
    right: spacing.s4,
    zIndex: 3,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: "hidden",
    ...shadows.cloud1,
  },
  buscaLinha: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    paddingLeft: spacing.s4,
    paddingRight: 6,
    height: 56,
  },
  limparBusca: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  sugestao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.s3,
    minHeight: 48,
    paddingHorizontal: spacing.s4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
  },
  sugestaoNome: { ...typography.bodyMd, flex: 1, color: colors.onSurface },
  sugestaoDistancia: { ...typography.bodySm, color: colors.onSurfaceVariant },
  botoesDoMapa: {
    position: "absolute",
    right: spacing.s4,
    gap: spacing.s2,
  },
  botaoDoMapa: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cloud1,
  },
  cartao: {
    position: "absolute",
    left: spacing.s4,
    right: spacing.s4,
    gap: spacing.s2,
    padding: spacing.s2,
    borderRadius: 22,
    backgroundColor: colors.surface,
    ...shadows.cloud2,
  },
  semLocalizacao: { ...typography.bodySm, color: colors.onSurfaceVariant, paddingHorizontal: spacing.s2 },
  cartaoBotoes: { flexDirection: "row", gap: spacing.s2 },
  verDetalhes: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  verDetalhesTexto: { ...typography.labelLg, color: colors.onPrimary },
  fecharCartao: {
    width: 48,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  listaArea: { flex: 1, minHeight: 0 },
  buscaCampo: {
    flex: 1,
    fontFamily: fontes.texto,
    fontSize: 16,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetra: { ...typography.titleMd, fontWeight: "700", color: colors.onPrimaryContainer },
  cabecalho: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s3,
    gap: spacing.s3,
  },
  tituloLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  avisoMinutos: { fontFamily: fontes.texto, fontSize: 28, lineHeight: 34, fontWeight: "800", color: colors.onPrimary },
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
