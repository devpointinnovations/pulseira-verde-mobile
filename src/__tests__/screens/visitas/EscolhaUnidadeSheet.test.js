/** Seletor da escolha de unidade (E2-04/RN-05), aberto pelo toque na notificação. */
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import EscolhaUnidadeSheet from "../../../screens/visitas/view/EscolhaUnidadeSheet";
import { TIPO_DESEMPATE, TIPO_TROCA, escolherUnidade } from "../../../screens/visitas/service/EscolhaUnidadeService";

jest.mock("../../../screens/visitas/service/EscolhaUnidadeService", () => ({
  __esModule: true,
  TIPO_DESEMPATE: "desempate",
  TIPO_TROCA: "troca",
  escolherUnidade: jest.fn(),
}));

const OPCOES = [
  { hospitalId: "h1", nome: "Hospital A" },
  { hospitalId: "h2", nome: "Hospital B" },
];

describe("EscolhaUnidadeSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("fechado quando não há escolha pendente", () => {
    const { queryByText } = render(<EscolhaUnidadeSheet escolha={null} onClose={jest.fn()} />);

    expect(queryByText("Hospital A")).toBeNull();
  });

  test("no desempate lista todas as unidades e aplica a tocada", async () => {
    escolherUnidade.mockResolvedValue({});
    const onClose = jest.fn();
    const escolha = { tipo: TIPO_DESEMPATE, opcoes: OPCOES, posicao: {}, entrada: "x" };
    const { getByText } = render(<EscolhaUnidadeSheet escolha={escolha} onClose={onClose} />);

    expect(getByText("Em qual unidade você está?")).toBeTruthy();
    fireEvent.press(getByText("Hospital B"));

    await waitFor(() => expect(escolherUnidade).toHaveBeenCalledWith(escolha, "h2"));
    expect(onClose).toHaveBeenCalled();
  });

  test("na troca o título é outro", () => {
    const { getByText } = render(
      <EscolhaUnidadeSheet escolha={{ tipo: TIPO_TROCA, opcoes: [OPCOES[1]], visitaId: "v1" }} onClose={jest.fn()} />
    );

    expect(getByText("Trocar a unidade da visita")).toBeTruthy();
  });

  test("erro do servidor é mostrado em alerta", async () => {
    escolherUnidade.mockRejectedValue(new Error("Visita já encerrada."));
    const { getByText } = render(
      <EscolhaUnidadeSheet escolha={{ tipo: TIPO_TROCA, opcoes: OPCOES, visitaId: "v1" }} onClose={jest.fn()} />
    );

    fireEvent.press(getByText("Hospital A"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Escolher unidade", "Visita já encerrada."));
  });

  test("check-in guardado offline é avisado como pendente, não como falha", async () => {
    escolherUnidade.mockRejectedValue(Object.assign(new Error("Guardado."), { enfileirado: true }));
    const { getByText } = render(
      <EscolhaUnidadeSheet escolha={{ tipo: TIPO_DESEMPATE, opcoes: OPCOES, posicao: {}, entrada: "x" }} onClose={jest.fn()} />
    );

    fireEvent.press(getByText("Hospital A"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Sem conexão", "Guardado."));
  });
});
