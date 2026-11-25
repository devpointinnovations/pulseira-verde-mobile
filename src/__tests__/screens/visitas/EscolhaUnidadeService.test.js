/**
 * Escolha de unidade com geofences sobrepostos (E2-04/RN-05): avisos por notificação local e
 * a aplicação da escolha (opção A, desempate; opção B, troca).
 */
import * as Notifications from "expo-notifications";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import {
  TIPO_DESEMPATE,
  TIPO_TROCA,
  avisarDesempate,
  avisarTroca,
  escolherUnidade,
} from "../../../screens/visitas/service/EscolhaUnidadeService";

jest.mock("../../../screens/visitas/service/VisitaService", () => ({
  __esModule: true,
  default: { checkin: jest.fn(), trocarHospital: jest.fn() },
}));

const mockPedirPermissao = jest.fn();
jest.mock("../../../screens/feedback/service/FeedbackNotificationService", () => ({
  __esModule: true,
  pedirPermissaoNotificacao: (...args) => mockPedirPermissao(...args),
}));

const mockInvalidarVisitaAtiva = jest.fn(() => Promise.resolve());
jest.mock("../../../core/query/queryClient", () => ({
  __esModule: true,
  invalidarVisitaAtiva: (...args) => mockInvalidarVisitaAtiva(...args),
}));

jest.mock("../../../config/monitoramento", () => ({ __esModule: true, registrarErro: jest.fn() }));

const POSICAO = { type: "Point", coordinates: [-48.07, -15.89] };
const CANDIDATOS = [
  { hospitalId: "h1", nome: "Hospital A", distanciaMetros: 10 },
  { hospitalId: "h2", nome: "Hospital B", distanciaMetros: 10.4 },
];

describe("EscolhaUnidadeService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPedirPermissao.mockResolvedValue(true);
  });

  test("avisarDesempate agenda uma notificação imediata com as opções, a posição e a chegada", async () => {
    await avisarDesempate({ candidatos: CANDIDATOS, posicao: POSICAO, entrada: "2026-11-24T22:00:00.000Z" });

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const { identifier, content, trigger } = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(identifier).toBe("escolha-unidade");
    expect(trigger).toBeNull();
    expect(content.title).toBe("Em qual unidade você está?");
    expect(content.data.escolhaUnidade).toEqual({
      tipo: TIPO_DESEMPATE,
      // Só o que o seletor usa: id e nome, sem a distância.
      opcoes: [
        { hospitalId: "h1", nome: "Hospital A" },
        { hospitalId: "h2", nome: "Hospital B" },
      ],
      posicao: POSICAO,
      entrada: "2026-11-24T22:00:00.000Z",
    });
  });

  test("avisarTroca leva a visita e as alternativas", async () => {
    await avisarTroca({ visitaId: "v1", alternativas: [CANDIDATOS[1]] });

    const { content } = Notifications.scheduleNotificationAsync.mock.calls[0][0];
    expect(content.title).toBe("Registramos sua visita");
    expect(content.data.escolhaUnidade).toEqual({
      tipo: TIPO_TROCA,
      opcoes: [{ hospitalId: "h2", nome: "Hospital B" }],
      visitaId: "v1",
    });
  });

  test("sem permissão de notificação não agenda nada nem falha", async () => {
    mockPedirPermissao.mockResolvedValue(false);

    await expect(avisarTroca({ visitaId: "v1", alternativas: [CANDIDATOS[1]] })).resolves.toBeUndefined();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  test("falha ao agendar é engolida: o geofencing não pode cair por causa do aviso", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    Notifications.scheduleNotificationAsync.mockRejectedValueOnce(new Error("sem canal"));

    await expect(avisarDesempate({ candidatos: CANDIDATOS, posicao: POSICAO, entrada: "x" })).resolves.toBeUndefined();
  });

  test("escolher no desempate faz o check-in automático com a escolha, a posição e a chegada", async () => {
    VisitaService.checkin.mockResolvedValue({ id: "v1", hospitalId: "h2" });

    await escolherUnidade(
      { tipo: TIPO_DESEMPATE, opcoes: [], posicao: POSICAO, entrada: "2026-11-24T22:00:00.000Z" },
      "h2"
    );

    expect(VisitaService.checkin).toHaveBeenCalledWith({
      hospitalId: "h2",
      origem: "GEOFENCE",
      posicao: POSICAO,
      ocorridoEm: "2026-11-24T22:00:00.000Z",
      escolhidoNoDesempate: true,
    });
    expect(mockInvalidarVisitaAtiva).toHaveBeenCalledTimes(1);
  });

  test("escolher na troca chama a troca da visita e recarrega a visita ativa", async () => {
    VisitaService.trocarHospital.mockResolvedValue({ id: "v1", hospitalId: "h2" });

    const resposta = await escolherUnidade({ tipo: TIPO_TROCA, opcoes: [], visitaId: "v1" }, "h2");

    expect(VisitaService.trocarHospital).toHaveBeenCalledWith("v1", "h2");
    expect(VisitaService.checkin).not.toHaveBeenCalled();
    expect(resposta).toEqual({ id: "v1", hospitalId: "h2" });
    expect(mockInvalidarVisitaAtiva).toHaveBeenCalledTimes(1);
  });

  test("erro do servidor sobe e a visita ativa não é recarregada", async () => {
    VisitaService.trocarHospital.mockRejectedValue(Object.assign(new Error("encerrada"), { status: 409 }));

    await expect(escolherUnidade({ tipo: TIPO_TROCA, opcoes: [], visitaId: "v1" }, "h2")).rejects.toThrow("encerrada");
    expect(mockInvalidarVisitaAtiva).not.toHaveBeenCalled();
  });
});
