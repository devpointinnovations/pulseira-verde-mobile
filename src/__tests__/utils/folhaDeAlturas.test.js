/** Alturas da folha do Início: regras puras de parada, toque e soltura do dedo. */
import {
  alturaDaParada,
  degrauDaParada,
  PARADAS,
  paradaAoSoltar,
  proximaParada,
} from "../../utils/folhaDeAlturas";

const TELA = 1000;

describe("folhaDeAlturas", () => {
  test("cada parada ocupa uma fração da altura útil", () => {
    expect(alturaDaParada("recolhida", TELA)).toBe(200);
    expect(alturaDaParada("meio", TELA)).toBe(400);
    expect(alturaDaParada("expandida", TELA)).toBe(600);
  });

  test("a folha nunca passa de 60% da tela, para não subir até a barra de busca", () => {
    for (const parada of PARADAS) {
      expect(alturaDaParada(parada, TELA)).toBeLessThanOrEqual(TELA * 0.6);
    }
  });

  test("o toque na alça passa à parada seguinte e volta à recolhida depois da expandida", () => {
    expect(proximaParada("recolhida")).toBe("meio");
    expect(proximaParada("meio")).toBe("expandida");
    expect(proximaParada("expandida")).toBe("recolhida");
  });

  test("a acessibilidade sobe ou desce um degrau e para nas pontas", () => {
    expect(degrauDaParada("meio", 1)).toBe("expandida");
    expect(degrauDaParada("meio", -1)).toBe("recolhida");
    expect(degrauDaParada("expandida", 1)).toBe("expandida");
    expect(degrauDaParada("recolhida", -1)).toBe("recolhida");
  });

  describe("ao soltar o dedo", () => {
    test("assenta na parada mais próxima da altura em que o dedo parou", () => {
      expect(paradaAoSoltar(250, 0, TELA)).toBe("recolhida");
      expect(paradaAoSoltar(420, 0, TELA)).toBe("meio");
      expect(paradaAoSoltar(580, 0, TELA)).toBe("expandida");
    });

    test("um arremesso para cima vai além da parada mais próxima", () => {
      expect(paradaAoSoltar(400, -2, TELA)).toBe("expandida");
    });

    test("um arremesso para baixo recolhe", () => {
      expect(paradaAoSoltar(400, 1.5, TELA)).toBe("recolhida");
    });
  });
});
