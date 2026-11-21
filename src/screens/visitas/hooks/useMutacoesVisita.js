import { Alert } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidarVisitaAtiva } from "../../../core/query/queryClient";
import { queryKeys } from "../../../core/query/queryKeys";
import { useSessao } from "../../../core/stores/sessaoStore";
import VisitaService from "../service/VisitaService";
import { obterPosicaoParaCheckinManual } from "../service/PosicaoAparelho";
import { agendarFeedback } from "../../feedback/service/FeedbackNotificationService";
import { duracaoMinutosDesde } from "../../../utils/format";
import { avisarSemConexao } from "../../../utils/alertas";

/**
 * Grava a visita que o servidor acabou de confirmar só na chave da visita ativa deste
 * usuário (nunca em `visitas.all`, que guardaria `{ visita }` em qualquer outra query
 * do domínio) e pede a confirmação ao servidor. O `VisitaAtivaSync` reage na hora:
 * liga ou desliga o heartbeat e avisa o geofencing.
 */
function useConfirmarVisitaAtiva() {
  const cliente = useQueryClient();
  const usuarioId = useSessao((estado) => estado.usuario?.id ?? null);

  return (visita) => {
    cliente.setQueryData(queryKeys.visitas.ativa(usuarioId), { visita });
    void invalidarVisitaAtiva(cliente);
  };
}

/**
 * Check-in manual pelo card de Hospitais (E2-06). A tela trata os erros: o 409 de
 * geofences empatadas (E2-04) e o check-in guardado na fila offline (OPS-05).
 *
 * Leva a posição do aparelho quando a permissão já existe: sem ela a visita é aceita,
 * mas não entra no indicador público (SEG-01).
 */
export function useCheckinManual() {
  const confirmar = useConfirmarVisitaAtiva();

  return useMutation({
    mutationFn: async ({ hospitalId }) =>
      VisitaService.checkin({ hospitalId, origem: "MANUAL", posicao: await obterPosicaoParaCheckinManual() }),
    onSuccess: (resposta) => confirmar({ ...resposta, origem: "MANUAL" }),
  });
}

/** Checkout manual ("Não estou aqui") no detalhe do hospital (E2-02). */
export function useCheckoutManual() {
  const confirmar = useConfirmarVisitaAtiva();

  return useMutation({
    mutationFn: (visitaId) => VisitaService.checkout(visitaId, { encerramentoManual: true }),
    onSuccess: () => confirmar(null),
  });
}

/**
 * "Não estou aqui" de uma visita manual, do jeito que o detalhe do hospital e a tela da
 * visita em andamento fazem: checkout, convite de feedback (E3-01) e, sem conexão, a saída
 * guardada na fila (OPS-05) já vale na tela. Devolve `true` quando a saída ficou registrada.
 *
 * `duracaoMinutos` decide se a visita foi longa o bastante para convidar (RN-01/RN-07):
 * online vem da resposta do checkout; offline é calculada a partir da entrada.
 */
export function useEncerrarVisitaManual({ visita, hospitalNome, definirLocal }) {
  const { mutateAsync, isPending } = useCheckoutManual();

  const encerrar = async () => {
    if (visita?.origem !== "MANUAL") return false;

    const convidar = (duracaoMinutos) => {
      agendarFeedback({
        visitaId: visita.id,
        hospitalId: visita.hospitalId,
        hospitalNome,
        saidaEm: new Date().toISOString(),
        duracaoMinutos,
      }).catch((erro) => {
        // A saída já está registrada; perder a pendência de avaliação não justifica
        // alertar o usuário, mas a falha (ex.: disco cheio) não pode sumir em silêncio.
        // eslint-disable-next-line no-console
        console.warn("useEncerrarVisitaManual: falha ao agendar o feedback", erro?.message);
      });
    };

    try {
      // A mutação grava "sem visita" na query compartilhada: o heartbeat para já.
      const resposta = await mutateAsync(visita.id);
      convidar(resposta?.duracaoMinutos);
      return true;
    } catch (e) {
      if (e.enfileirado) {
        // O cronômetro não pode seguir contando uma visita que o usuário já encerrou.
        // Janela residual documentada em `preservarSeSemConexao` (utils/alertas.js).
        convidar(duracaoMinutosDesde(visita.entrada));
        definirLocal(null);
        avisarSemConexao(e.message);
        return true;
      }
      Alert.alert("Check-out", e.message || "Não foi possível finalizar o check-out. Tente novamente.");
      return false;
    }
  };

  return { encerrar, enviando: isPending };
}
