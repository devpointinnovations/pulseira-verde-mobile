/**
 * Visita em andamento (layout novo): minutos, hora da chegada e "Não estou neste hospital".
 */
import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, screen } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import VisitaEmAndamentoScreen from "../../../screens/visitas/view/VisitaEmAndamentoScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { agendarFeedback } from "../../../screens/feedback/service/FeedbackNotificationService";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackNotificationService");
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const NAVEGACAO = { goBack: jest.fn() };
const ENTRADA = new Date(Date.now() - 42 * 60000);

function visita(origem) {
  return { id: "v1", hospitalId: "h1", origem, entrada: ENTRADA.toISOString() };
}

function renderizar() {
  return renderComProviders(<VisitaEmAndamentoScreen navigation={NAVEGACAO} />);
}

describe("VisitaEmAndamentoScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue({ id: "h1", nome: "Hospital Central" });
    agendarFeedback.mockResolvedValue(null);
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("mostra os minutos, o hospital e a hora da chegada", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: visita("AUTOMATICO") });

    renderizar();

    expect(await screen.findByText("Hospital Central")).toBeTruthy();
    expect(screen.getByLabelText("42 minutos de visita")).toBeTruthy();
    const hora = ENTRADA.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    expect(screen.getByText(`Chegada percebida às ${hora}`)).toBeTruthy();
    expect(screen.getByText("Funciona sem internet")).toBeTruthy();
  });

  test("visita automática não oferece 'Não estou neste hospital' (o geofence encerra)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: visita("AUTOMATICO") });

    renderizar();
    await screen.findByText("Hospital Central");

    expect(screen.queryByText("Não estou neste hospital")).toBeNull();
  });

  test("visita manual: 'Não estou neste hospital' faz o checkout, convida para o feedback e volta", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: visita("MANUAL") });
    VisitaService.checkout.mockImplementation(async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
      return { id: "v1", duracaoMinutos: 42 };
    });

    renderizar();
    await screen.findByText("Hospital Central");
    await act(async () => {
      fireEvent.press(screen.getByText("Não estou neste hospital"));
    });

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", { encerramentoManual: true });
    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", hospitalNome: "Hospital Central", duracaoMinutos: 42 })
    );
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });

  test("checkout recusado mostra o erro e fica na tela", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: visita("MANUAL") });
    VisitaService.checkout.mockRejectedValue(new Error("Falha ao finalizar."));

    renderizar();
    await screen.findByText("Hospital Central");
    await act(async () => {
      fireEvent.press(screen.getByText("Não estou neste hospital"));
    });

    expect(Alert.alert).toHaveBeenCalledWith("Check-out", "Falha ao finalizar.");
    expect(NAVEGACAO.goBack).not.toHaveBeenCalled();
  });

  test("sem visita ativa, avisa e oferece voltar", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });

    renderizar();
    fireEvent.press(await screen.findByText("Voltar"));

    expect(screen.getByText("Nenhuma visita em andamento")).toBeTruthy();
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });
});
