/**
 * Contrato do CSHospitalCard (layout novo): o card inteiro abre o detalhe, mostra o tipo e
 * a distância numa linha e não tem mais o botão de check-in (decisão do PO de 23/11/2026,
 * seguindo o design aprovado: o check-in manual fica no detalhe, "Estou aqui agora").
 *
 * O ARQ-05 mudou o contrato do `onPress`: ele recebe o próprio `hospital` de volta, para a
 * tela passar uma função memoizada. Se alguém reverter para `onPress()` sem argumento, o
 * Início navega para `undefined.id` e o app quebra no toque.
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import CSHospitalCard from "../../components/CSHospitalCard";

const hospital = {
  id: "h1",
  nome: "Hospital de Base",
  tipo: "PUBLICO",
  categoria: "HOSPITAL",
  indicadores: { notaMedia: 4.2, nAvaliacoes: 12, tempoMedianoMinutos: 45 },
};

describe("CSHospitalCard", () => {
  test("devolve o hospital ao chamador no toque do card (contrato do ARQ-05)", () => {
    const onPress = jest.fn();
    render(<CSHospitalCard hospital={hospital} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText("Hospital de Base, Hospital"));

    expect(onPress).toHaveBeenCalledWith(hospital);
  });

  test("não tem botão de check-in: o check-in manual fica no detalhe", () => {
    render(<CSHospitalCard hospital={hospital} onPress={jest.fn()} />);

    expect(screen.queryByText("Check-in")).toBeNull();
  });

  test("mostra a nota, as avaliações e a espera com espaço antes do 'min'", () => {
    render(<CSHospitalCard hospital={hospital} />);

    expect(screen.getByText("4,2")).toBeTruthy();
    expect(screen.getByText("12 avaliações")).toBeTruthy();
    expect(screen.getByText("45 min")).toBeTruthy();
  });

  test("com amostra abaixo do mínimo, mostra o aviso em vez de inventar uma média", () => {
    const hospitalSemAmostra = {
      ...hospital,
      indicadores: { notaMedia: 4.2, nAvaliacoes: 3, tempoMedianoMinutos: 45 },
    };
    render(<CSHospitalCard hospital={hospitalSemAmostra} />);

    expect(screen.getByText("Ainda sem avaliações suficientes")).toBeTruthy();
    expect(screen.queryByText("3 avaliações")).toBeNull();
  });

  test("com `distancia`, a linha fica 'tipo · distância', como no design", () => {
    render(<CSHospitalCard hospital={{ ...hospital, tipoUnidade: "Hospital geral" }} distancia="1,2 km" />);

    expect(screen.getByText("Hospital geral · 1,2 km")).toBeTruthy();
  });

  test("sem `distancia`, não mostra linha de distância — nunca um 'N/D'", () => {
    render(<CSHospitalCard hospital={hospital} />);

    expect(screen.getByText("Hospital")).toBeTruthy();
    expect(screen.queryByText(/N\/D/)).toBeNull();
  });

  test("em visita neste hospital, a distância dá lugar a 'você está aqui'", () => {
    render(<CSHospitalCard hospital={hospital} distancia="1,2 km" emVisita />);

    expect(screen.getByText("Hospital · você está aqui")).toBeTruthy();
  });

  test("tipo da unidade que repete o nome (CNES) não é mostrado; o tipo curto é", () => {
    const { rerender } = render(
      <CSHospitalCard
        hospital={{
          ...hospital,
          nome: "Ambulatório de Diversidade de Gênero",
          tipoUnidade: "Ambulatório de Diversidade de Gênero – Asa Sul",
        }}
      />
    );
    expect(screen.getByText("Hospital")).toBeTruthy();

    rerender(<CSHospitalCard hospital={{ ...hospital, nome: "Caps Ad Brasília", tipoUnidade: "CAPS" }} />);
    expect(screen.getByText("CAPS")).toBeTruthy();
  });
});
