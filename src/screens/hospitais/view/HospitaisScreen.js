import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { MapPinOff, Search, Timer, User as UserIcon } from "lucide-react-native";
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

/** O mapa ocupa este tanto da altura da tela; a folha "Perto de você" sobe por cima dele. */
const FRACAO_DO_MAPA = 0.4;

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
  const { height: alturaDaTela } = useWindowDimensions();
  const alturaDoMapa = Math.round(alturaDaTela * FRACAO_DO_MAPA);

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

  const abrirDetalhe = useCallback(
    (hospital) => {
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    },
    [navigation]
  );
  const abrirMapa = useCallback(() => navigation.navigate("MapaTela"), [navigation]);
  const abrirPerfil = useCallback(() => navigation.navigate("Perfil"), [navigation]);

  // O mapa só existe com a aba à vista: sai ao abrir outra tela (um mapa a menos na memória
  // enquanto o mapa completo ou o detalhe estão abertos) e volta ao reabrir.
  const [mapaVisivel, setMapaVisivel] = useState(true);
  useEffect(() => {
    const removerFoco = navigation?.addListener?.("focus", () => setMapaVisivel(true));
    const removerSaida = navigation?.addListener?.("blur", () => setMapaVisivel(false));
    return () => {
      removerFoco?.();
      removerSaida?.();
    };
  }, [navigation]);

  // ARQ-05: memoizado; inline, cada render criaria um `onPress` novo por card e anularia o
  // React.memo do CSHospitalCard.
  const renderItem = useCallback(
    ({ item }) => (
      <CSHospitalCard
        hospital={item.hospital}
        onPress={abrirDetalhe}
        emVisita={visitaAtiva?.hospitalId === item.hospital.id}
        distancia={formatarDistancia(item.metros)}
      />
    ),
    [abrirDetalhe, visitaAtiva]
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

  return (
    <View style={styles.tela}>
      {mapaVisivel ? (
        <MapaPertoDeVoce
          hospitais={hospitaisDoMapa}
          posicao={posicao}
          onAbrirMapa={abrirMapa}
          altura={alturaDoMapa}
        />
      ) : (
        <View style={[styles.mapaAusente, { height: alturaDoMapa }]} />
      )}

      <View style={[styles.busca, { top: insets.top + spacing.s3 }]}>
        <Search size={22} color={colors.onSurfaceVariant} />
        <TextInput
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar hospital ou UPA"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Buscar hospital ou UPA"
          style={styles.buscaCampo}
          returnKeyType="search"
        />
        <AvatarDaBusca onPress={abrirPerfil} />
      </View>

      <View style={styles.folha}>
        <View style={styles.alca} />

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
            refreshControl={
              <RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={colors.primary} />
            }
          />
        )}
      </View>
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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    paddingLeft: spacing.s4,
    paddingRight: 6,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.cloud1,
  },
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
  folha: {
    flex: 1,
    marginTop: -28,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  alca: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
    marginTop: spacing.s3,
  },
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
