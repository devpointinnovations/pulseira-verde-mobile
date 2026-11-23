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
jest.mock("../../../utils/mapkit", () => {
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;
  return {
    __esModule: true,
    MapView: stub,
    Camera: (props) => {
      mockCameras.push(props);
      return null;
    },
    MarkerView: ({ children, coordinate }) => <View testID={`marcador-${coordinate.join(",")}`}>{children}</View>,
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
  });

  test("mostra a nota nos pins e destaca o de melhor nota", () => {
    render(
      <MapaPertoDeVoce
        hospitais={[hospital("h1", 3.5), hospital("h2", 4.6), hospital("h3", 4.9, 2)]}
        posicao={null}
        onAbrirMapa={jest.fn()}
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

    render(<MapaPertoDeVoce hospitais={muitos} posicao={null} onAbrirMapa={jest.fn()} altura={300} />);

    expect(screen.getAllByTestId(/^marcador-/)).toHaveLength(PINS_NO_MAPA - 1);
  });

  test("sem GPS a câmera abre sobre Brasília; com GPS vai até a pessoa e marca a posição", () => {
    const props = { hospitais: [], onAbrirMapa: jest.fn(), altura: 300 };
    const { rerender } = render(<MapaPertoDeVoce {...props} posicao={null} />);
    expect(mockCameras.at(-1)).toMatchObject({ centerCoordinate: [-47.8828, -15.7939], zoomLevel: 11 });
    expect(screen.queryAllByTestId(/^marcador-/)).toHaveLength(0);

    rerender(<MapaPertoDeVoce {...props} posicao={{ latitude: -15.8, longitude: -47.9 }} />);
    expect(mockCameras.at(-1)).toMatchObject({ centerCoordinate: [-47.9, -15.8], zoomLevel: 12.5 });
    expect(screen.getByTestId("marcador--47.9,-15.8")).toBeTruthy();
  });

  test("tocar no mapa ou no botão de localização abre o mapa completo", () => {
    const onAbrirMapa = jest.fn();
    render(<MapaPertoDeVoce hospitais={[]} posicao={null} onAbrirMapa={onAbrirMapa} altura={300} />);

    fireEvent.press(screen.getByLabelText("Abrir o mapa dos hospitais"));
    fireEvent.press(screen.getByLabelText("Abrir o mapa na sua localização"));

    expect(onAbrirMapa).toHaveBeenCalledTimes(2);
  });
});
