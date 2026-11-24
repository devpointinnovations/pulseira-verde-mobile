/**
 * Mapa do topo do Início (layout novo): pins com a nota, o de melhor nota em destaque, a
 * posição da pessoa e a câmera que sai de Brasília quando o GPS responde.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import MapaPertoDeVoce, { PINS_NO_MAPA } from "../../../screens/hospitais/view/MapaPertoDeVoce";
import { colors } from "../../../theme/tokens";

const mockCameras = [];
const mockCameraApi = { setCamera: jest.fn(), fitBounds: jest.fn() };
jest.mock("../../../utils/mapkit", () => {
  const { forwardRef, useImperativeHandle } = require("react");
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;
  return {
    __esModule: true,
    MapView: stub,
    Camera: forwardRef(function Camera(props, ref) {
      mockCameras.push(props);
      useImperativeHandle(ref, () => mockCameraApi);
      return null;
    }),
    MarkerView: ({ children, coordinate, testID }) => <View testID={testID ?? `marcador-${coordinate.join(",")}`}>{children}</View>,
  };
});

function hospital(id, nota, nAvaliacoes = 10, localizacao = { latitude: -15.7, longitude: -47.8 }) {
  return { id, nome: id, localizacao, indicadores: { notaMedia: nota, nAvaliacoes } };
}

function corDoPin(textoDaNota) {
  return StyleSheet.flatten(screen.getByText(textoDaNota).parent.parent.props.style).backgroundColor;
}

describe("MapaPertoDeVoce", () => {
  beforeEach(() => {
    mockCameras.length = 0;
    jest.clearAllMocks();
  });

  test("mostra a nota nos pins e destaca o de melhor nota", () => {
    render(
      <MapaPertoDeVoce
        hospitais={[hospital("h1", 3.5), hospital("h2", 4.6), hospital("h3", 4.9, 2)]}
        posicao={null}
        altura={300}
      />
    );

    expect(screen.getByText("3,5")).toBeTruthy();
    expect(screen.getByText("4,6")).toBeTruthy();
    // Poucas avaliações: o pin aparece sem nota e não concorre ao destaque.
    expect(screen.queryByText("4,9")).toBeNull();
    expect(corDoPin("4,6")).toBe(colors.primary);
    expect(corDoPin("3,5")).toBe(colors.surfaceContainerLowest);
  });

  test("limita os pins e deixa de fora hospital sem coordenada", () => {
    const muitos = Array.from({ length: PINS_NO_MAPA + 3 }, (_, i) =>
      hospital(`h${i}`, 4, 10, { latitude: -15 - i / 100, longitude: -47 })
    );
    muitos[0] = { id: "sem-lugar", nome: "Sem lugar", indicadores: null };

    render(<MapaPertoDeVoce hospitais={muitos} posicao={null} altura={300} />);

    expect(screen.getAllByTestId(/^(marcador|pin-hospital)-/)).toHaveLength(PINS_NO_MAPA - 1);
  });

  test("sem GPS a câmera abre sobre Brasília; com GPS vai até a pessoa e marca a posição", () => {
    const props = { hospitais: [], altura: 300 };
    const { rerender } = render(<MapaPertoDeVoce {...props} posicao={null} />);
    expect(mockCameras.at(-1)).toMatchObject({ centerCoordinate: [-47.8828, -15.7939], zoomLevel: 11 });
    expect(screen.queryAllByTestId(/^marcador-/)).toHaveLength(0);

    rerender(<MapaPertoDeVoce {...props} posicao={{ latitude: -15.8, longitude: -47.9 }} />);
    expect(mockCameras.at(-1)).toMatchObject({ centerCoordinate: [-47.9, -15.8], zoomLevel: 12.5 });
    expect(screen.getByTestId("marcador--47.9,-15.8")).toBeTruthy();
  });

  test("tocar no pin seleciona o hospital; o pin selecionado fica em destaque", () => {
    const aoSelecionar = jest.fn();
    const alfa = hospital("alfa", 4);
    const beta = hospital("beta", 3);
    const { rerender } = render(
      <MapaPertoDeVoce hospitais={[alfa, beta]} posicao={null} aoSelecionar={aoSelecionar} altura={600} />
    );

    fireEvent(screen.getByLabelText("Ver beta no mapa"), "responderRelease");
    expect(aoSelecionar).toHaveBeenCalledWith(beta);
    expect(screen.getByLabelText("Ver beta no mapa").props.accessibilityState).toEqual({ selected: false });

    rerender(
      <MapaPertoDeVoce hospitais={[alfa, beta]} selecionado={beta} posicao={null} aoSelecionar={aoSelecionar} altura={600} />
    );
    expect(screen.getByLabelText("Ver beta no mapa").props.accessibilityState).toEqual({ selected: true });
    expect(corDoPin("3,0")).toBe(colors.primary);
  });

  test("tocar no pin sem `aoSelecionar` não quebra", () => {
    render(<MapaPertoDeVoce hospitais={[hospital("alfa", 4)]} posicao={null} altura={600} />);

    expect(() => fireEvent(screen.getByLabelText("Ver alfa no mapa"), "responderRelease")).not.toThrow();
  });

  test("o hospital selecionado ganha pin mesmo fora dos mais perto", () => {
    const muitos = Array.from({ length: PINS_NO_MAPA + 3 }, (_, i) => hospital(`h${i}`, 4));
    const longe = muitos.at(-1);

    render(<MapaPertoDeVoce hospitais={muitos} selecionado={longe} posicao={null} altura={600} />);

    expect(screen.getAllByTestId(/^pin-hospital-/)).toHaveLength(PINS_NO_MAPA + 1);
    expect(screen.getByTestId(`pin-hospital-${longe.id}`)).toBeTruthy();
  });

  test("com GPS, selecionar enquadra a pessoa e o hospital com as margens pedidas", () => {
    const alfa = hospital("alfa", 4, 10, { latitude: -15.7, longitude: -47.8 });
    render(
      <MapaPertoDeVoce
        hospitais={[alfa]}
        selecionado={alfa}
        posicao={{ latitude: -15.8, longitude: -47.9 }}
        margemSuperior={100}
        margemInferior={300}
        altura={800}
      />
    );

    expect(mockCameraApi.fitBounds).toHaveBeenCalledTimes(1);
    const [nordeste, sudoeste, padding, duracao] = mockCameraApi.fitBounds.mock.calls[0];
    expect(nordeste[0]).toBeCloseTo(-47.8);
    expect(nordeste[1]).toBeCloseTo(-15.7);
    expect(sudoeste[0]).toBeCloseTo(-47.9);
    expect(sudoeste[1]).toBeCloseTo(-15.8);
    expect(padding).toEqual({ top: 100, right: 48, bottom: 300, left: 48 });
    expect(duracao).toBe(600);
  });

  test("sem GPS, selecionar centraliza no hospital em zoom de bairro", () => {
    const alfa = hospital("alfa", 4, 10, { latitude: -15.7, longitude: -47.8 });

    render(<MapaPertoDeVoce hospitais={[alfa]} selecionado={alfa} posicao={null} altura={800} />);

    expect(mockCameraApi.fitBounds).not.toHaveBeenCalled();
    expect(mockCameraApi.setCamera).toHaveBeenCalledWith({
      centerCoordinate: [-47.8, -15.7],
      zoomLevel: 14,
      animationDuration: 600,
    });
  });

  test("hospital sem coordenada selecionado não mexe na câmera", () => {
    const semLugar = { id: "sem", nome: "Sem", indicadores: null };

    render(<MapaPertoDeVoce hospitais={[semLugar]} selecionado={semLugar} posicao={null} altura={800} />);

    expect(mockCameraApi.fitBounds).not.toHaveBeenCalled();
    expect(mockCameraApi.setCamera).not.toHaveBeenCalled();
  });

  test("um novo sinal de recentrar leva a câmera à pessoa, ou a Brasília sem GPS", () => {
    const props = { hospitais: [], altura: 800, margemSuperior: 120, margemInferior: 340 };
    const { rerender } = render(
      <MapaPertoDeVoce {...props} posicao={{ latitude: -15.8, longitude: -47.9 }} sinalDeRecentrar={0} />
    );
    expect(mockCameraApi.setCamera).not.toHaveBeenCalled();

    rerender(<MapaPertoDeVoce {...props} posicao={{ latitude: -15.8, longitude: -47.9 }} sinalDeRecentrar={1} />);
    expect(mockCameraApi.setCamera).toHaveBeenLastCalledWith({
      centerCoordinate: [-47.9, -15.8],
      zoomLevel: 12.5,
      animationDuration: 600,
      // A pessoa fica na faixa visível entre a busca e a folha, não atrás dela.
      padding: { top: 120, right: 0, bottom: 340, left: 0 },
    });

    rerender(<MapaPertoDeVoce {...props} posicao={null} sinalDeRecentrar={2} />);
    expect(mockCameraApi.setCamera).toHaveBeenLastCalledWith({
      centerCoordinate: [-47.8828, -15.7939],
      zoomLevel: 11,
      animationDuration: 600,
      padding: { top: 120, right: 0, bottom: 340, left: 0 },
    });
  });
});
