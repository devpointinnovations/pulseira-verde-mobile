import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../core/query/queryKeys";
import { listarPendencias } from "../service/FeedbackNotificationService";

/**
 * Quantas visitas ainda esperam avaliação (o número na aba Visitas do layout novo). Só a
 * contagem vai para o cache, nunca a lista com os hospitais visitados. O cartão "Falta
 * avaliar" invalida a chave ao recarregar; a releitura periódica cobre o resto (pendência
 * criada pelo geofencing ou vencida em 24h).
 */
export function useQuantidadeFeedbacksPendentes() {
  const { data } = useQuery({
    queryKey: queryKeys.visitas.feedbacksPendentes(),
    queryFn: async () => (await listarPendencias()).length,
    refetchInterval: 60 * 1000,
  });
  return data ?? 0;
}
