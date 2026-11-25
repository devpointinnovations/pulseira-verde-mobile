import * as Notifications from "expo-notifications";
import VisitaService from "./VisitaService";
import { invalidarVisitaAtiva } from "../../../core/query/queryClient";
import { pedirPermissaoNotificacao } from "../../feedback/service/FeedbackNotificationService";
import { registrarErro } from "../../../config/monitoramento";

/**
 * Escolha de unidade quando geofences se sobrepõem (E2-04/RN-05). O check-in automático roda
 * em segundo plano, sem tela: quando precisa da pessoa, avisa por notificação local e o toque
 * abre o seletor (`EscolhaUnidadeSheet`).
 *
 * - `desempate` (opção A): o servidor não conseguiu escolher (diferença ≤ 10 m) e não criou a
 *   visita; a escolha registra a entrada com a posição e o horário reais da chegada.
 * - `troca` (opção B): a visita foi criada na unidade mais próxima, e a pessoa pode trocá-la
 *   por outra cujo geofence também continha o local.
 */
export const TIPO_DESEMPATE = "desempate";
export const TIPO_TROCA = "troca";

// Um aviso por vez: o Enter de cada unidade sobreposta dispara a mesma situação, e o segundo
// aviso substitui o primeiro em vez de empilhar.
const IDENTIFICADOR_AVISO = "escolha-unidade";

async function avisar(titulo, corpo, escolhaUnidade) {
  try {
    if (!(await pedirPermissaoNotificacao())) {
      return;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: IDENTIFICADOR_AVISO,
      content: { title: titulo, body: corpo, data: { escolhaUnidade } },
      trigger: null,
    });
  } catch (erro) {
    // Sem o aviso a pessoa ainda escolhe pelo detalhe do hospital; não vale derrubar o geofencing.
    // eslint-disable-next-line no-console
    console.warn("EscolhaUnidadeService: falha ao avisar", erro?.message);
    registrarErro(erro, "geofencing.escolhaUnidade");
  }
}

const paraOpcoes = (lista) => lista.map(({ hospitalId, nome }) => ({ hospitalId, nome }));

/** Opção A: o servidor devolveu `candidatos` num 409 e `posicao`/`entrada` são os da chegada. */
export function avisarDesempate({ candidatos, posicao, entrada }) {
  return avisar(
    "Em qual unidade você está?",
    "Há mais de uma unidade neste local. Toque para escolher e registrar sua visita.",
    { tipo: TIPO_DESEMPATE, opcoes: paraOpcoes(candidatos), posicao, entrada }
  );
}

/** Opção B: `alternativas` vêm da resposta do check-in que criou a visita. */
export function avisarTroca({ visitaId, alternativas }) {
  return avisar(
    "Registramos sua visita",
    "Usamos a unidade mais próxima. Não é aqui? Toque para trocar.",
    { tipo: TIPO_TROCA, opcoes: paraOpcoes(alternativas), visitaId }
  );
}

/**
 * Aplica a escolha da pessoa. Devolve a resposta do servidor; erros (inclusive o check-in
 * guardado offline, `enfileirado`) sobem para o seletor mostrar. Com a visita nova ou trocada,
 * a visita ativa é recarregada: o `VisitaAtivaSync` liga o heartbeat e avisa o geofencing.
 */
export async function escolherUnidade(escolha, hospitalId) {
  const resposta =
    escolha.tipo === TIPO_TROCA
      ? await VisitaService.trocarHospital(escolha.visitaId, hospitalId)
      : await VisitaService.checkin({
          hospitalId,
          origem: "GEOFENCE",
          posicao: escolha.posicao,
          ocorridoEm: escolha.entrada,
          escolhidoNoDesempate: true,
        });
  void invalidarVisitaAtiva();
  return resposta;
}
