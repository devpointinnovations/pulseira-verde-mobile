import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import { Camera, MapView, MarkerView } from "../../../utils/mapkit";
import { MAP_STYLE } from "../../../utils/mapStyle";
import { calcularLimitesDoEnquadramento, centroDoHospital } from "../../../utils/geojson";
import { avaliacaoSuficiente } from "../../../utils/indicadores";
import { formatarNota } from "../../../utils/format";
import { colors, fontes, shadows } from "../../../theme/tokens";

/** Pins no mapa do Início: os hospitais mais perto, para o mapa continuar leve. */
export const PINS_NO_MAPA = 12;

/** Sem GPS, o mapa abre sobre Brasília, onde está o catálogo atual. */
const CENTRO_SEM_GPS = { latitude: -15.7939, longitude: -47.8828 };
const ZOOM_SEM_GPS = 11;
const ZOOM_COM_GPS = 12.5;
/** Sem GPS, o hospital selecionado fica sozinho no enquadramento: zoom de bairro. */
const ZOOM_DO_SELECIONADO = 14;
const MARGEM_LATERAL = 48;
const DURACAO_DA_CAMERA_MS = 600;

/**
 * Mapa do Início: os hospitais mais perto com a nota num pin, o de melhor nota em verde, o
 * hospital selecionado em destaque e a posição da pessoa. Tocar num pin seleciona o hospital
 * (`aoSelecionar`) e a câmera enquadra a pessoa e o hospital, deixando livres a busca no topo
 * (`margemSuperior`) e o cartão com a folha embaixo (`margemInferior`). Quem navega é a tela,
 * que desmonta o mapa antes (BUG-04, toque atrasado num mapa destruído trava o app).
 * `sinalDeRecentrar` muda a cada pedido para voltar a câmera à pessoa.
 */
function MapaPertoDeVoce({
  hospitais,
  selecionado = null,
  posicao,
  aoSelecionar,
  sinalDeRecentrar = 0,
  margemSuperior = 0,
  margemInferior = 0,
  altura,
}) {
  const cameraRef = useRef(null);
  const posicaoRef = useRef(posicao);
  useEffect(() => {
    posicaoRef.current = posicao;
  }, [posicao]);

  const pins = useMemo(() => {
    const doMapa = hospitais.slice(0, PINS_NO_MAPA);
    // O selecionado sempre aparece, mesmo fora dos mais perto (a busca o traz de longe).
    const lista = selecionado && !doMapa.some((h) => h.id === selecionado.id) ? [...doMapa, selecionado] : doMapa;
    return lista.map((hospital) => ({ hospital, centro: centroDoHospital(hospital) })).filter(({ centro }) => centro);
  }, [hospitais, selecionado]);
  const melhorId = useMemo(() => {
    let melhor = null;
    for (const { hospital } of pins) {
      if (avaliacaoSuficiente(hospital.indicadores) && hospital.indicadores.notaMedia > (melhor?.nota ?? -1)) {
        melhor = { id: hospital.id, nota: hospital.indicadores.notaMedia };
      }
    }
    return melhor?.id ?? null;
  }, [pins]);

  // A câmera nasce sobre Brasília e vai até a pessoa quando o GPS responde (a `Camera`
  // acompanha a mudança de centro).
  const centro = posicao ?? CENTRO_SEM_GPS;

  // Selecionar enquadra pessoa e hospital; sem GPS, só o hospital. A posição entra por ref
  // para o GPS atualizar sem mover a câmera de novo. Hospital sem coordenada não move nada.
  const ponto = selecionado ? centroDoHospital(selecionado) : null;
  const selecionadoId = selecionado?.id;
  useEffect(() => {
    if (!ponto) {
      return;
    }
    const pessoa = posicaoRef.current;
    if (!pessoa) {
      cameraRef.current?.setCamera({
        centerCoordinate: [ponto.longitude, ponto.latitude],
        zoomLevel: ZOOM_DO_SELECIONADO,
        animationDuration: DURACAO_DA_CAMERA_MS,
      });
      return;
    }
    const [nordeste, sudoeste] = calcularLimitesDoEnquadramento([ponto, pessoa]);
    cameraRef.current?.fitBounds(
      nordeste,
      sudoeste,
      { top: margemSuperior, right: MARGEM_LATERAL, bottom: margemInferior, left: MARGEM_LATERAL },
      DURACAO_DA_CAMERA_MS
    );
    // Só quando troca o hospital: mudar a margem (arrastar a folha) não reenquadra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionadoId]);

  // O botão de localização volta a câmera para a pessoa (ou para Brasília, sem GPS). O centro
  // do mapa fica atrás da folha; o padding o leva ao meio da faixa livre entre a busca e a folha.
  useEffect(() => {
    if (!sinalDeRecentrar) {
      return;
    }
    cameraRef.current?.setCamera({
      centerCoordinate: [centro.longitude, centro.latitude],
      zoomLevel: posicaoRef.current ? ZOOM_COM_GPS : ZOOM_SEM_GPS,
      animationDuration: DURACAO_DA_CAMERA_MS,
      padding: { top: margemSuperior, right: 0, bottom: margemInferior, left: 0 },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinalDeRecentrar]);

  return (
    <View style={[styles.area, { height: altura }]} testID="mapa-inicio">
      <MapView style={StyleSheet.absoluteFill} styleURL={MAP_STYLE}>
        <Camera
          ref={cameraRef}
          centerCoordinate={[centro.longitude, centro.latitude]}
          zoomLevel={posicao ? ZOOM_COM_GPS : ZOOM_SEM_GPS}
        />
        {pins.map(({ hospital, centro: ponto_ }) => {
          const destaque = hospital.id === melhorId;
          const marcado = hospital.id === selecionado?.id;
          const nota = avaliacaoSuficiente(hospital.indicadores) ? formatarNota(hospital.indicadores.notaMedia) : null;
          const cheio = destaque || marcado;
          return (
            <MarkerView
              key={hospital.id}
              testID={`pin-hospital-${hospital.id}`}
              coordinate={[ponto_.longitude, ponto_.latitude]}
            >
              <View
                style={[styles.pin, cheio && styles.pinDestaque, marcado && styles.pinSelecionado]}
                accessibilityRole="button"
                accessibilityLabel={`Ver ${hospital.nome} no mapa`}
                accessibilityState={{ selected: marcado }}
                onStartShouldSetResponder={() => true}
                onResponderRelease={() => aoSelecionar?.(hospital)}
              >
                <Plus size={16} strokeWidth={3} color={cheio ? colors.onPrimary : colors.primary} />
                {nota ? <Text style={[styles.pinNota, cheio && styles.pinNotaDestaque]}>{nota}</Text> : null}
              </View>
            </MarkerView>
          );
        })}
        {posicao ? (
          <MarkerView coordinate={[posicao.longitude, posicao.latitude]}>
            <View style={styles.voceHalo} pointerEvents="none">
              <View style={styles.vocePonto} />
            </View>
          </MarkerView>
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    overflow: "hidden",
    backgroundColor: colors.surfaceContainer,
  },
  pin: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceContainerLowest,
    ...shadows.cloud1,
  },
  pinDestaque: {
    backgroundColor: colors.primary,
  },
  pinNota: {
    fontFamily: fontes.texto,
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurface,
  },
  pinSelecionado: {
    transform: [{ scale: 1.25 }],
    ...shadows.cloud2,
  },
  pinNotaDestaque: {
    color: colors.onPrimary,
  },
  voceHalo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(26, 115, 232, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vocePonto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#1A73E8",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
});

export default React.memo(MapaPertoDeVoce);
