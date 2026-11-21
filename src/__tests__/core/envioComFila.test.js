/**
 * Offline total (21/11/2026): escrita que vai para a fila offline quando não sai do aparelho.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { enviarOuGuardar, reenviarRequisicao, TIPO_REQUISICAO } from "../../core/api/envioComFila";
import { apiRequest } from "../../core/api/apiClient";
import { itensDaFila } from "../../config/filaOffline";
import { ErroDeTimeout, ErroSemInternet } from "../../config/http";
import { ApiError } from "../../core/api/apiError";

jest.mock("../../core/api/apiClient", () => ({ apiRequest: jest.fn() }));

describe("envioComFila", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it("com rede, envia e devolve a resposta sem tocar na fila", async () => {
    apiRequest.mockResolvedValue({ id: "f1" });

    await expect(
      enviarOuGuardar("/api/v1/feedbacks", { method: "POST", body: { nota: 5 }, repetivel: true }, "feedback:v1")
    ).resolves.toEqual({ id: "f1" });

    expect(apiRequest).toHaveBeenCalledWith("/api/v1/feedbacks", {
      method: "POST",
      body: { nota: 5 },
      idempotente: true,
    });
    expect(await itensDaFila()).toEqual([]);
  });

  it("sem internet, guarda o pedido e avisa a tela com um erro enfileirado", async () => {
    apiRequest.mockRejectedValue(new ErroSemInternet());

    const erro = await enviarOuGuardar("/api/v1/hospitais/sugestoes", { method: "POST", body: { nome: "X" } }, "sugestao:1").catch(
      (e) => e
    );

    expect(erro.enfileirado).toBe(true);
    expect(erro.item).toMatchObject({ chave: "sugestao:1", tipo: TIPO_REQUISICAO });
    const [item] = await itensDaFila();
    expect(item.corpo).toEqual({ path: "/api/v1/hospitais/sugestoes", method: "POST", body: { nome: "X" }, repetivel: false });
  });

  it("pedido que pode ter saído sem resposta só é guardado quando o servidor aceita a repetição", async () => {
    apiRequest.mockRejectedValue(new ErroDeTimeout("u", 20000));

    await expect(enviarOuGuardar("/x", { method: "POST", body: {} }, "sugestao:2")).rejects.toBeInstanceOf(ErroDeTimeout);
    expect(await itensDaFila()).toEqual([]);

    const erro = await enviarOuGuardar("/x", { method: "PUT", body: {}, repetivel: true }, "consentimento:a").catch((e) => e);
    expect(erro.enfileirado).toBe(true);
    expect(await itensDaFila()).toHaveLength(1);
  });

  it("recusa do servidor (4xx) não vai para a fila", async () => {
    apiRequest.mockRejectedValue(new ApiError("inválido", 400));

    await expect(enviarOuGuardar("/x", { method: "PUT", body: {}, repetivel: true }, "c")).rejects.toMatchObject({ status: 400 });
    expect(await itensDaFila()).toEqual([]);
  });

  it("reenviarRequisicao repete o pedido guardado", async () => {
    apiRequest.mockResolvedValue(null);

    await reenviarRequisicao({ corpo: { path: "/x", method: "PUT", body: { a: 1 }, repetivel: true } });

    expect(apiRequest).toHaveBeenCalledWith("/x", { method: "PUT", body: { a: 1 }, idempotente: true });
  });
});
