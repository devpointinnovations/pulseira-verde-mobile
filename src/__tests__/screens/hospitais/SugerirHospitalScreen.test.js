/**
 * Sugestão de hospital (E1-05): com e sem internet (offline total, 21/11/2026).
 */
import React from "react";
import { Alert } from "react-native";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import SugerirHospitalScreen from "../../../screens/hospitais/view/SugerirHospitalScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";

jest.mock("../../../screens/hospitais/service/HospitalService");

function preencherEEnviar() {
  const navigation = { goBack: jest.fn() };
  renderComProviders(<SugerirHospitalScreen navigation={navigation} />);
  fireEvent.changeText(screen.getByPlaceholderText("Ex.: Hospital Municipal"), "Hospital Novo");
  fireEvent.changeText(screen.getByPlaceholderText("Rua, número"), "Rua 1");
  fireEvent.changeText(screen.getByPlaceholderText("São Paulo"), "Brasília");
  fireEvent.changeText(screen.getByPlaceholderText("SP"), "df");
  fireEvent.press(screen.getByText("Enviar sugestão"));
  return navigation;
}

describe("SugerirHospitalScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    Alert.alert.mockRestore();
  });

  test("com internet envia a sugestão com a UF em maiúsculas", async () => {
    HospitalService.sugerir.mockResolvedValue({ id: "s1" });

    preencherEEnviar();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith("Sugestão enviada", expect.any(String), expect.any(Array)));
    expect(HospitalService.sugerir).toHaveBeenCalledWith(
      expect.objectContaining({ nome: "Hospital Novo", endereco: { logradouro: "Rua 1", cidade: "Brasília", uf: "DF" } })
    );
  });

  test("sem internet avisa que a sugestão ficou guardada e volta ao tocar OK", async () => {
    HospitalService.sugerir.mockRejectedValue(Object.assign(new Error("sem internet"), { enfileirado: true }));

    const navigation = preencherEEnviar();

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [titulo, texto, botoes] = Alert.alert.mock.calls[0];
    expect(titulo).toBe("Sugestão guardada");
    expect(texto).toMatch(/será enviada assim que a conexão voltar/);
    botoes[0].onPress();
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
