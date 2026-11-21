import AsyncStorage from "@react-native-async-storage/async-storage";
import { dehydrate, hydrate } from "@tanstack/react-query";
import { queryKeys } from "./queryKeys";

const CHAVE = "@saude_monitor:cacheConsultas";

/** Espera entre a última mudança do cache e a gravação: uma rajada de respostas grava uma vez. */
export const INTERVALO_GRAVACAO_MS = 1000;

/**
 * Guardado no aparelho: o que veio do servidor (ranking, detalhe, notas, histórico). Fica de
 * fora o que já tem o seu armazenamento: a cópia do catálogo (`CatalogoLocal`) e a visita
 * ativa, que o geofencing acompanha e não pode voltar velha de um cache.
 */
function deveGuardar(consulta) {
  const [dominio, parte] = consulta.queryKey;
  return (
    consulta.state.status === "success" &&
    dominio !== queryKeys.visitas.all[0] &&
    !(dominio === queryKeys.hospitais.all[0] && parte === queryKeys.hospitais.catalogoLocal()[1])
  );
}

/**
 * Offline total (21/11/2026): devolve ao cache do TanStack Query o que foi gravado na última
 * vez em que o app abriu, para as telas abrirem sem rede. O dado volta com a data em que foi
 * buscado, então com rede ele é buscado de novo como qualquer dado velho.
 */
export async function restaurarCache(cliente) {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE);
    if (bruto) {
      hydrate(cliente, JSON.parse(bruto));
    }
  } catch {
    // Cópia corrompida ou ilegível: o app segue com o cache vazio, como antes.
  }
}

/**
 * Grava o cache no aparelho a cada mudança. Dado pessoal removido no logout
 * (`removerDadosPessoais`) sai da cópia na gravação seguinte.
 *
 * @returns {() => void} para de gravar.
 */
export function persistirCache(cliente, intervaloMs = INTERVALO_GRAVACAO_MS) {
  let agendada = null;

  const gravar = () => {
    agendada = null;
    const estado = dehydrate(cliente, { shouldDehydrateQuery: deveGuardar });
    AsyncStorage.setItem(CHAVE, JSON.stringify(estado)).catch(() => {});
  };

  const cancelar = cliente.getQueryCache().subscribe(() => {
    agendada ??= setTimeout(gravar, intervaloMs);
  });

  return () => {
    cancelar();
    clearTimeout(agendada);
  };
}
