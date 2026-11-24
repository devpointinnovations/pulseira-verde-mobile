import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native";
import { colors, shadows } from "../../../theme/tokens";
import {
  alturaDaParada,
  degrauDaParada,
  paradaAoSoltar,
  proximaParada,
} from "../../../utils/folhaDeAlturas";

/** Movimento menor que isto, em px, é toque na alça e não arraste. */
const LIMITE_DO_TOQUE = 6;
const DURACAO_MS = 300;

/**
 * Folha de baixo do Início com três alturas e arraste de verdade. A alça é a área de arraste; um toque nela passa à próxima altura, e as ações
 * de acessibilidade "aumentar" e "diminuir" fazem o mesmo para quem não arrasta.
 * Usa o `PanResponder` do próprio React Native: o conteúdo da folha não anima junto, só a altura.
 */
export default function FolhaDeHospitais({ parada, aoMudarParada, alturaUtil, children }) {
  const [altura] = useState(() => new Animated.Value(alturaDaParada(parada, alturaUtil)));
  // Altura em que o dedo tocou a alça; muda sem render, por isso fica num objeto estável.
  const [toque] = useState(() => ({ altura: 0 }));

  const ir = useCallback(
    (alvo) => {
      Animated.timing(altura, {
        toValue: alturaDaParada(alvo, alturaUtil),
        duration: DURACAO_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      aoMudarParada(alvo);
    },
    [altura, alturaUtil, aoMudarParada]
  );

  // Mudança vinda de fora (selecionar um hospital recolhe a folha) ou rotação da tela.
  useEffect(() => {
    Animated.timing(altura, {
      toValue: alturaDaParada(parada, alturaUtil),
      duration: DURACAO_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [altura, parada, alturaUtil]);

  const limites = useMemo(
    () => [alturaDaParada("recolhida", alturaUtil), alturaDaParada("expandida", alturaUtil)],
    [alturaUtil]
  );

  const gesto = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          altura.stopAnimation((valor) => {
            toque.altura = valor;
          });
        },
        onPanResponderMove: (_, estado) => {
          const [minimo, maximo] = limites;
          altura.setValue(Math.min(maximo, Math.max(minimo, toque.altura - estado.dy)));
        },
        onPanResponderRelease: (_, estado) => {
          if (Math.abs(estado.dy) < LIMITE_DO_TOQUE && Math.abs(estado.dx) < LIMITE_DO_TOQUE) {
            ir(proximaParada(parada));
            return;
          }
          ir(paradaAoSoltar(toque.altura - estado.dy, estado.vy, alturaUtil));
        },
        onPanResponderTerminate: () => ir(parada),
      }),
    [altura, alturaUtil, ir, limites, parada, toque]
  );

  const aoAcionar = useCallback(
    (evento) => {
      const passo = evento.nativeEvent.actionName === "increment" ? 1 : -1;
      ir(degrauDaParada(parada, passo));
    },
    [ir, parada]
  );

  return (
    <Animated.View style={[styles.folha, { height: altura }]} testID="folha-hospitais">
      <View
        {...gesto.panHandlers}
        testID="alca-da-folha"
        style={styles.areaDaAlca}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Altura da lista de hospitais"
        accessibilityHint="Arraste, ou toque duas vezes, para mostrar mais ou menos da lista"
        accessibilityValue={{ text: parada }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={aoAcionar}
      >
        <View style={styles.alca} />
      </View>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  folha: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    ...shadows.cloud1,
  },
  areaDaAlca: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 14,
  },
  alca: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
});
