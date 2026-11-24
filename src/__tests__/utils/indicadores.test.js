import { avaliacaoSuficiente, descreverTendencia } from "../../utils/indicadores";

describe("avaliacaoSuficiente (RN-15)", () => {
  test("verdadeiro com nota, 5+ avaliações e indicadoresDisponiveis !== false", () => {
    expect(avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 5 })).toBe(true);
    expect(
      avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 10, indicadoresDisponiveis: true })
    ).toBe(true);
  });

  test("falso com menos de 5 avaliações, mesmo com nota presente", () => {
    // Caso limítrofe do PR #94/#95: nota real mas amostra pequena não deve aparecer.
    expect(avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 3 })).toBe(false);
  });

  test("falso quando indicadoresDisponiveis === false, mesmo com nota/contagem presentes", () => {
    expect(
      avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 10, indicadoresDisponiveis: false })
    ).toBe(false);
  });

  test("falso sem notaMedia", () => {
    expect(avaliacaoSuficiente({ notaMedia: null, nAvaliacoes: 10 })).toBe(false);
    expect(avaliacaoSuficiente({ nAvaliacoes: 10 })).toBe(false);
  });

  test("falso com indicadores ausente/undefined", () => {
    expect(avaliacaoSuficiente(undefined)).toBe(false);
    expect(avaliacaoSuficiente(null)).toBe(false);
  });
});

describe("descreverTendencia (E4-06)", () => {
  const BASE = { indicadoresDisponiveis: true, notaMedia: 4.2, nAvaliacoes: 12 };

  test("nota subindo vira frase com a variação em uma casa, sem sinal", () => {
    expect(
      descreverTendencia({ ...BASE, tendenciaNota: "SUBINDO", variacaoNota: 0.46, tendenciaPreliminar: false })
    ).toEqual({ sentido: "SUBINDO", frase: "Nota subiu 0,5 em relação aos 30 dias anteriores", preliminar: false });
  });

  test("nota caindo usa o módulo da variação", () => {
    expect(
      descreverTendencia({ ...BASE, tendenciaNota: "CAINDO", variacaoNota: -1.2, tendenciaPreliminar: true })
    ).toEqual({ sentido: "CAINDO", frase: "Nota caiu 1,2 em relação aos 30 dias anteriores", preliminar: true });
  });

  test("nota estável não mostra número", () => {
    expect(descreverTendencia({ ...BASE, tendenciaNota: "ESTAVEL", variacaoNota: 0.1 })).toEqual({
      sentido: "ESTAVEL",
      frase: "Nota estável em relação aos 30 dias anteriores",
      preliminar: false,
    });
  });

  test("sem tendência do servidor (campos ausentes ou nulos) não descreve nada", () => {
    expect(descreverTendencia(BASE)).toBeNull();
    expect(descreverTendencia({ ...BASE, tendenciaNota: null, variacaoNota: null })).toBeNull();
    expect(descreverTendencia(null)).toBeNull();
  });

  test("valor desconhecido ou variação inválida não descreve nada", () => {
    expect(descreverTendencia({ ...BASE, tendenciaNota: "DISPARANDO", variacaoNota: 1 })).toBeNull();
    expect(descreverTendencia({ ...BASE, tendenciaNota: "SUBINDO", variacaoNota: null })).toBeNull();
  });

  test("sem avaliações suficientes (RN-15) não mostra tendência", () => {
    expect(
      descreverTendencia({ ...BASE, nAvaliacoes: 3, tendenciaNota: "SUBINDO", variacaoNota: 1 })
    ).toBeNull();
    expect(
      descreverTendencia({ ...BASE, indicadoresDisponiveis: false, tendenciaNota: "SUBINDO", variacaoNota: 1 })
    ).toBeNull();
  });
});
