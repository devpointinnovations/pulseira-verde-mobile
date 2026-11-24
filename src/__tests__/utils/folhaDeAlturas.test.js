/** Alturas da folha do Início: regras puras de parada, toque e soltura do dedo. */
import {
  alturaDaParada,
  degrauDaParada,
  paradaAoSoltar,
  proximaParada,
} from "../../utils/folhaDeAlturas";

const TELA = 1000;

describe("folhaDeAlturas", () => {
  test("cada parada ocupa uma fração da altura útil", () => {
    expect(alturaDaParada("recolhida", TELA)).toBe(200);
    expect(alturaDaParada("meio", TELA)).toBe(580);
    expect(alturaDaParada("expandida", TELA)).toBe(920);
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
      expect(paradaAoSoltar(560, 0, TELA)).toBe("meio");
      expect(paradaAoSoltar(850, 0, TELA)).toBe("expandida");
    });

    test("um arremesso para cima vai além da parada mais próxima", () => {
      expect(paradaAoSoltar(500, -2, TELA)).toBe("expandida");
    });

    test("um arremesso para baixo recolhe", () => {
      expect(paradaAoSoltar(500, 1.5, TELA)).toBe("recolhida");
    });
  });
});
