/**
 * Folha do Início com três alturas: o arraste (PanResponder), o toque na alça e as ações de
 * acessibilidade. O `PanResponder` não recebe toques reais no Jest; os testes chamam os
 * callbacks que a folha registrou, com o estado de gesto que o React Native entregaria.
 */
import React from "react";
import { PanResponder, Text } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FolhaDeHospitais from "../../../screens/hospitais/view/FolhaDeHospitais";

const ALTURA_UTIL = 1000;
let gesto;

function renderizar(parada = "meio") {
  const aoMudarParada = jest.fn();
  render(
    <FolhaDeHospitais parada={parada} aoMudarParada={aoMudarParada} alturaUtil={ALTURA_UTIL}>
      <Text>conteúdo</Text>
    </FolhaDeHospitais>
  );
  return aoMudarParada;
}

describe("FolhaDeHospitais", () => {
  beforeEach(() => {
    const criar = PanResponder.create.bind(PanResponder);
    jest.spyOn(PanResponder, "create").mockImplementation((config) => {
      gesto = config;
      return criar(config);
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test("mostra o conteúdo sob a alça e informa a altura atual", () => {
    renderizar("recolhida");

    expect(screen.getByText("conteúdo")).toBeTruthy();
    expect(screen.getByTestId("alca-da-folha").props.accessibilityValue).toEqual({ text: "recolhida" });
  });

  test("a alça aceita o gesto desde o primeiro toque", () => {
    renderizar();

    expect(gesto.onStartShouldSetPanResponder()).toBe(true);
  });

  test("um toque curto na alça passa à parada seguinte", () => {
    const aoMudarParada = renderizar("meio");

    act(() => {
      gesto.onPanResponderGrant();
      gesto.onPanResponderRelease(null, { dx: 1, dy: 2, vy: 0 });
    });

    expect(aoMudarParada).toHaveBeenCalledWith("expandida");
  });

  test("arrastar para cima até perto do topo expande a folha", () => {
    const aoMudarParada = renderizar("meio");

    act(() => {
      gesto.onPanResponderGrant();
      gesto.onPanResponderMove(null, { dx: 0, dy: -300 });
      gesto.onPanResponderRelease(null, { dx: 0, dy: -300, vy: -0.5 });
    });

    expect(aoMudarParada).toHaveBeenCalledWith("expandida");
  });

  test("arrastar para baixo recolhe a folha, e o gesto nunca passa dos limites", () => {
    const aoMudarParada = renderizar("meio");

    act(() => {
      gesto.onPanResponderGrant();
      gesto.onPanResponderMove(null, { dx: 0, dy: 900 });
      gesto.onPanResponderRelease(null, { dx: 0, dy: 900, vy: 1 });
    });

    expect(aoMudarParada).toHaveBeenCalledWith("recolhida");
  });

  test("soltar perto da própria altura devolve a folha à parada em que estava", () => {
    const aoMudarParada = renderizar("meio");

    act(() => {
      gesto.onPanResponderGrant();
      gesto.onPanResponderMove(null, { dx: 0, dy: -40 });
      gesto.onPanResponderRelease(null, { dx: 0, dy: -40, vy: 0 });
    });

    expect(aoMudarParada).toHaveBeenCalledWith("meio");
  });

  test("gesto interrompido pelo sistema volta à parada atual", () => {
    const aoMudarParada = renderizar("meio");

    act(() => gesto.onPanResponderTerminate());

    expect(aoMudarParada).toHaveBeenCalledWith("meio");
  });

  test("as ações de acessibilidade sobem e descem um degrau", () => {
    const aoMudarParada = renderizar("meio");
    const alca = screen.getByTestId("alca-da-folha");

    fireEvent(alca, "accessibilityAction", { nativeEvent: { actionName: "increment" } });
    fireEvent(alca, "accessibilityAction", { nativeEvent: { actionName: "decrement" } });

    expect(aoMudarParada).toHaveBeenNthCalledWith(1, "expandida");
    expect(aoMudarParada).toHaveBeenNthCalledWith(2, "recolhida");
  });
});
