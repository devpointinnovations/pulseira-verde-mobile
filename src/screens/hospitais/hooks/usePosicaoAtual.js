import { useEffect, useState } from "react";
import * as Location from "expo-location";

/**
 * Posição do aparelho para o Início ("Perto de você"): a última conhecida, na hora, e depois
 * uma leitura nova. Só lê com a permissão já dada; quem pede é a apresentação e o Perfil.
 * Sem permissão ou sem GPS, fica `null` e a tela mostra a lista sem distância.
 *
 * @returns {{ latitude: number, longitude: number } | null}
 */
export function usePosicaoAtual() {
  const [posicao, setPosicao] = useState(null);

  useEffect(() => {
    let montado = true;
    const guardar = (leitura) => {
      if (montado && leitura?.coords) {
        setPosicao({ latitude: leitura.coords.latitude, longitude: leitura.coords.longitude });
      }
    };

    (async () => {
      try {
        const { granted } = await Location.getForegroundPermissionsAsync();
        if (!granted) {
          return;
        }
        guardar(await Location.getLastKnownPositionAsync());
        guardar(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      } catch {
        // GPS desligado ou leitura negada: a lista segue sem distância.
      }
    })();

    return () => {
      montado = false;
    };
  }, []);

  return posicao;
}
