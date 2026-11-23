import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LocateFixed, Plus } from "lucide-react-native";
import { Camera, MapView, MarkerView } from "../../../utils/mapkit";
import { MAP_STYLE } from "../../../utils/mapStyle";
import { centroDoHospital } from "../../../utils/geojson";
import { avaliacaoSuficiente } from "../../../utils/indicadores";
import { formatarNota } from "../../../utils/format";
import { colors, fontes, shadows } from "../../../theme/tokens";

/** Pins no mapa do Início: os hospitais mais perto, para o mapa continuar leve. */
export const PINS_NO_MAPA = 12;

/** Sem GPS, o mapa abre sobre Brasília, onde está o catálogo atual. */
const CENTRO_SEM_GPS = { latitude: -15.7939, longitude: -47.8828 };
const ZOOM_SEM_GPS = 11;
const ZOOM_COM_GPS = 12.5;

/**
 * Mapa do topo do Início (layout novo): os hospitais mais perto com a nota num pin, o
 * de melhor nota em verde, e a posição da pessoa. É só uma vista: o mapa não recebe
 * toques (BUG-04, toque atrasado num mapa destruído trava o app), e tocar nele ou no botão
 * de localização abre o mapa completo, que já trata a navegação com segurança.
 */
function MapaPertoDeVoce({ hospitais, posicao, onAbrirMapa, altura }) {
  const pins = useMemo(
    () =>
      hospitais
        .slice(0, PINS_NO_MAPA)
        .map((hospital) => ({ hospital, centro: centroDoHospital(hospital) }))
        .filter(({ centro }) => centro),
    [hospitais]
  );
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

  return (
    <View style={[styles.area, { height: altura }]} testID="mapa-inicio">
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <MapView style={StyleSheet.absoluteFill} styleURL={MAP_STYLE}>
          <Camera
            centerCoordinate={[centro.longitude, centro.latitude]}
            zoomLevel={posicao ? ZOOM_COM_GPS : ZOOM_SEM_GPS}
          />
          {pins.map(({ hospital, centro: ponto }) => {
            const destaque = hospital.id === melhorId;
            const nota = avaliacaoSuficiente(hospital.indicadores) ? formatarNota(hospital.indicadores.notaMedia) : null;
            return (
              <MarkerView key={hospital.id} coordinate={[ponto.longitude, ponto.latitude]}>
                <View style={[styles.pin, destaque && styles.pinDestaque]}>
                  <Plus size={16} strokeWidth={3} color={destaque ? colors.onPrimary : colors.primary} />
                  {nota ? <Text style={[styles.pinNota, destaque && styles.pinNotaDestaque]}>{nota}</Text> : null}
                </View>
              </MarkerView>
            );
          })}
          {posicao ? (
            <MarkerView coordinate={[posicao.longitude, posicao.latitude]}>
              <View style={styles.voceHalo}>
                <View style={styles.vocePonto} />
              </View>
            </MarkerView>
          ) : null}
        </MapView>
      </View>

      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onAbrirMapa}
        accessibilityRole="button"
        accessibilityLabel="Abrir o mapa dos hospitais"
      />
      <Pressable
        style={styles.localizar}
        onPress={onAbrirMapa}
        accessibilityRole="button"
        accessibilityLabel="Abrir o mapa na sua localização"
        hitSlop={8}
      >
        <LocateFixed size={24} color={colors.primary} />
      </Pressable>
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
  localizar: {
    position: "absolute",
    right: 16,
    bottom: 40,
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainerLowest,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.cloud1,
  },
});

export default React.memo(MapaPertoDeVoce);
