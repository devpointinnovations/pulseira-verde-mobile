import { ErroDeConexao, ErroEnfileirado, ErroSemInternet } from "../../config/http";
import { enfileirar } from "../../config/filaOffline";
import { apiRequest } from "./apiClient";

/** Tipo dos itens da fila offline que são uma requisição comum (fora check-in e checkout). */
export const TIPO_REQUISICAO = "requisicao";

function semResposta(erro) {
  return erro instanceof ErroDeConexao || (Number.isInteger(erro?.status) && erro.status >= 500);
}

/**
 * Escrita que funciona sem internet (offline total, 21/11/2026): tenta enviar e, se o pedido
 * não sai do aparelho, guarda na fila offline (`config/filaOffline.js`), que o
 * `SincronizacaoOffline` reenvia quando a rede volta, na ordem em que os eventos aconteceram.
 *
 * `repetivel`: o servidor aceita receber o mesmo pedido duas vezes (PUT, ou POST que ele
 * deduplica, como o feedback por visita). Só então o pedido também vai para a fila quando pode
 * ter saído sem resposta (timeout, 5xx); sem isso, só quando nem chegou a sair.
 *
 * A `chave` identifica o fato: guardar de novo a mesma chave troca o item em vez de empilhar.
 *
 * @throws {ErroEnfileirado} o pedido foi guardado (`item` vai junto).
 */
export async function enviarOuGuardar(path, { method, body, repetivel = false }, chave) {
  try {
    return await apiRequest(path, { method, body, idempotente: repetivel });
  } catch (erro) {
    if (!(erro instanceof ErroSemInternet) && !(repetivel && semResposta(erro))) {
      throw erro;
    }
    const item = await enfileirar({ chave, tipo: TIPO_REQUISICAO, corpo: { path, method, body, repetivel } });
    throw Object.assign(new ErroEnfileirado(), { item });
  }
}

/**
 * Reenvia um item guardado por `enviarOuGuardar`. Usado só pelo `SincronizacaoOffline`.
 * shortcut: um pedido não repetível (sugestão de hospital) que sai na volta da rede sem resposta
 * fica na fila e pode chegar duas vezes; a equipe revisa as sugestões. Trocar por chave de
 * idempotência no backend se aparecer duplicata.
 */
export function reenviarRequisicao(item) {
  const { path, method, body, repetivel } = item.corpo || {};
  return apiRequest(path, { method, body, idempotente: repetivel });
}
