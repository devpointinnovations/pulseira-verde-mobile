/**
 * Início (E1-03, layout novo): mapa no topo, folha "Perto de você" com filtros e a lista.
 *
 * O card não tem mais o botão de check-in (design aprovado, decisão do PO de 23/11/2026):
 * o check-in manual fica só no detalhe ("Estou aqui agora"). Aqui ficam a lista que sai
 * do aparelho, a ordem por distância com GPS, o filtro "Até 5 km", o hospital da visita
 * ativa no topo e os atalhos do mapa, do ranking e do perfil.
 */
import React from "react";
import { fireEvent, screen, waitFor, act, within } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import { Alert } from "react-native";
import * as Location from "expo-location";
import HospitaisScreen from "../../../screens/hospitais/view/HospitaisScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import CatalogoLocal from "../../../services/CatalogoLocal";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");

// utils/mapkit (MapLibre nativo) não roda no Jest: Views no lugar, como nos outros testes do mapa.
jest.mock("../../../utils/mapkit", () => {
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;
  return { __esModule: true, MapView: stub, Camera: stub, MarkerView: stub, ShapeSource: stub, FillLayer: stub, LineLayer: stub };
});
jest.mock("../../../services/CatalogoLocal", () => ({
  __esModule: true,
  default: { lerCopiaGuardada: jest.fn(), obterEstabelecimentos: jest.fn(), sincronizarVersao: jest.fn(), conferirSeVencida: jest.fn() },
}));

// A aba ganha foco uma vez, ao montar.
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const HOSPITAL_A = { id: "hA", nome: "Hospital A", tipo: "PUBLICO", categoria: "HOSPITAL" };
const HOSPITAL_B = { id: "hB", nome: "Hospital B", tipo: "PRIVADO", categoria: "UPA" };

const NAVEGACAO = { navigate: jest.fn(), goBack: jest.fn() };

function renderizar() {
  return renderComProviders(<HospitaisScreen navigation={NAVEGACAO} />);
}

describe("HospitaisScreen (E1-03) — lista, visita ativa e atalhos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sessão lida do aparelho (anônima): a visita ativa só é consultada depois disso.
    definirUsuarioDaSessao(null);
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: {} });
    HospitalService.buscarPorId.mockResolvedValue(null);
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([HOSPITAL_A, HOSPITAL_B]);
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([HOSPITAL_A, HOSPITAL_B]);
    CatalogoLocal.conferirSeVencida.mockResolvedValue(false);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("carrega a lista imediatamente, sem esperar o debounce", async () => {
    renderizar();
    expect(await screen.findByText("Hospital A")).toBeTruthy();
    expect(screen.getByText("Hospital B")).toBeTruthy();
  });

  test("a lista sai do aparelho: não pede hospitais ao servidor página a página", async () => {
    renderizar();
    await screen.findByText("Hospital A");

    expect(HospitalService.listar).not.toHaveBeenCalled();
  });

  test("sem cópia e sem rede mostra o erro, e 'Tentar novamente' baixa o catálogo de novo", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue(null);
    CatalogoLocal.obterEstabelecimentos.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();
    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();

    fireEvent.press(screen.getByText("Tentar novamente"));

    expect(await screen.findByText("Hospital A")).toBeTruthy();
  });

  test("a busca filtra no aparelho, sem acento e caixa, só depois da pausa na digitação", async () => {
    renderizar();
    await screen.findByText("Hospital A");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital ou UPA"), "Hospítal A");
    expect(screen.getByText("Hospital B")).toBeTruthy();

    await waitFor(() => expect(screen.queryByText("Hospital B")).toBeNull());
    expect(screen.getByText("Hospital A")).toBeTruthy();
    expect(HospitalService.listar).not.toHaveBeenCalled();
  });

  describe("GPS, distância e filtro 'Até 5 km'", () => {
    // Hospital A a ~3,3 km da pessoa; Hospital B a ~1,1 km; Hospital C a ~11 km.
    const PESSOA = { latitude: -15.78, longitude: -47.89 };
    const PERTO_A = { ...HOSPITAL_A, localizacao: { latitude: -15.75, longitude: -47.89 } };
    const PERTO_B = { ...HOSPITAL_B, localizacao: { latitude: -15.79, longitude: -47.89 } };
    const LONGE_C = { id: "hC", nome: "Hospital C", tipo: "PUBLICO", categoria: "HOSPITAL", localizacao: { latitude: -15.68, longitude: -47.89 } };

    function comGps() {
      Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: true });
      Location.getLastKnownPositionAsync.mockResolvedValue(null);
      Location.getCurrentPositionAsync.mockResolvedValue({ coords: PESSOA });
    }

    function nomesNaLista() {
      return within(screen.getByTestId("lista-hospitais"))
        .getAllByText(/^Hospital [ABC]$/)
        .map((el) => el.props.children);
    }

    beforeEach(() => {
      CatalogoLocal.lerCopiaGuardada.mockResolvedValue([PERTO_A, PERTO_B, LONGE_C]);
      CatalogoLocal.obterEstabelecimentos.mockResolvedValue([PERTO_A, PERTO_B, LONGE_C]);
    });

    // clearAllMocks não desfaz o GPS ligado aqui; sem isto ele vazaria para os testes seguintes.
    afterEach(() => {
      Location.getForegroundPermissionsAsync.mockReset();
      Location.getCurrentPositionAsync.mockReset();
      Location.getLastKnownPositionAsync.mockReset();
    });

    test("com GPS, a lista vai do mais perto ao mais longe e mostra a distância no card", async () => {
      comGps();
      renderizar();

      await waitFor(() => expect(nomesNaLista()).toEqual(["Hospital B", "Hospital A", "Hospital C"]));
      expect(screen.getByText(/· 1,1 km$/)).toBeTruthy();
    });

    test("'Até 5 km' deixa só os hospitais a até 5 km", async () => {
      comGps();
      renderizar();
      await waitFor(() => expect(nomesNaLista()).toEqual(["Hospital B", "Hospital A", "Hospital C"]));

      fireEvent.press(screen.getByText("Até 5 km"));

      expect(nomesNaLista()).toEqual(["Hospital B", "Hospital A"]);
    });

    test("sem permissão de localização, a lista segue a ordem do catálogo e 'Até 5 km' pede a localização", async () => {
      Location.getForegroundPermissionsAsync.mockResolvedValue({ granted: false });
      renderizar();
      await screen.findByText("Hospital A");

      expect(nomesNaLista()).toEqual(["Hospital A", "Hospital B", "Hospital C"]);
      expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();

      fireEvent.press(screen.getByText("Até 5 km"));
      expect(screen.getByText("Sem a sua localização")).toBeTruthy();
    });
  });

  test("o avatar da busca abre o perfil e mostra a inicial de quem entrou", async () => {
    definirUsuarioDaSessao({ id: "u1", nome: "maria" });
    renderizar();
    await screen.findByText("Hospital A");

    expect(screen.getByText("M")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Abrir o perfil"));
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Perfil");
  });

  test("o botão de localização do mapa abre o mapa completo", async () => {
    renderizar();
    await screen.findByText("Hospital A");

    fireEvent.press(screen.getByLabelText("Abrir o mapa na sua localização"));
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("MapaTela");
  });

  describe("hospital do check-in ativo no topo da lista (pedido do PO, 10/09/2026)", () => {
    test("hospital ativo já presente na lista aparece primeiro, sem duplicar", async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hB" } });
      HospitalService.buscarPorId.mockResolvedValue(HOSPITAL_B);

      renderizar();
      await screen.findByText("Hospital A");

      // `buscarPorId` resolve assincronamente, depois da lista já ter carregado —
      // esperar só "Hospital A" existir não garante que o destaque já aplicou
      // (achado sob carga: passava isolado, falhava junto com a suíte completa).
      await waitFor(() => {
        const nomes = within(screen.getByTestId("lista-hospitais")).getAllByText(/^Hospital [AB]$/).map((el) => el.props.children);
        expect(nomes).toEqual(["Hospital B", "Hospital A"]);
      });
    });

    test("hospital ativo fora da cópia do catálogo é buscado à parte e aparece no topo", async () => {
      const HOSPITAL_FORA_DA_PAGINA = { id: "hZ", nome: "Hospital Z", tipo: "PUBLICO", categoria: "HOSPITAL" };
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hZ" } });
      HospitalService.buscarPorId.mockResolvedValue(HOSPITAL_FORA_DA_PAGINA);

      renderizar();
      await screen.findByText("Hospital A");

      await waitFor(() => expect(HospitalService.buscarPorId).toHaveBeenCalledWith("hZ", { signal: expect.anything() }));
      await waitFor(() => {
        const nomes = within(screen.getByTestId("lista-hospitais")).getAllByText(/^Hospital [ABZ]$/).map((el) => el.props.children);
        expect(nomes).toEqual(["Hospital Z", "Hospital A", "Hospital B"]);
      });
    });

    test("sem check-in ativo, a ordem da lista não muda", async () => {
      renderizar();
      await screen.findByText("Hospital A");

      expect(HospitalService.buscarPorId).not.toHaveBeenCalled();
      const nomes = within(screen.getByTestId("lista-hospitais")).getAllByText(/^Hospital [AB]$/).map((el) => el.props.children);
      expect(nomes).toEqual(["Hospital A", "Hospital B"]);
    });

    test("visita ativa aparece no aviso do topo com os minutos, e o toque abre a visita", async () => {
      const entrada = new Date(Date.now() - 42 * 60000).toISOString();
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v9", hospitalId: "hB", entrada } });
      HospitalService.buscarPorId.mockResolvedValue(HOSPITAL_B);

      renderizar();
      const aviso = await screen.findByLabelText("Visita em andamento em Hospital B");
      expect(within(aviso).getByText("42 min")).toBeTruthy();

      fireEvent.press(aviso);
      expect(NAVEGACAO.navigate).toHaveBeenCalledWith("VisitaEmAndamento");
    });

    test("sem o hospital e sem horário de entrada, o aviso fica genérico e sem minutos", async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v9", hospitalId: "hX" } });

      renderizar();
      const aviso = await screen.findByLabelText("Visita em andamento");
      expect(within(aviso).getByText("Hospital")).toBeTruthy();
      expect(within(aviso).queryByText(/min/)).toBeNull();
    });

    test("'Ver ranking' abre a aba Ranking e o botão do mapa abre o mapa", async () => {
      renderizar();
      await screen.findByText("Hospital A");

      fireEvent.press(screen.getByText("Ver ranking"));
      fireEvent.press(screen.getByLabelText("Abrir o mapa dos hospitais"));

      expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Ranking");
      expect(NAVEGACAO.navigate).toHaveBeenCalledWith("MapaTela");
      expect(screen.queryByText("Visita em andamento")).toBeNull();
    });

    test("falha ao buscar o hospital ativo não quebra a lista (fallback silencioso)", async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hB" } });
      HospitalService.buscarPorId.mockRejectedValue(new Error("sem conexão"));

      renderizar();

      expect(await screen.findByText("Hospital A")).toBeTruthy();
      expect(screen.getByText("Hospital B")).toBeTruthy();
    });
  });
});

describe("HospitaisScreen — lista do catálogo no aparelho e indicadores do servidor (22/10/2026)", () => {
  const UPA = { id: "hU", nome: "Upa Riacho Fundo", tipo: "PUBLICO", categoria: "UPA" };
  const CLINICA = { id: "hC", nome: "Clínica Água", tipo: "PRIVADO", categoria: "OUTRO" };
  const NOTA_DA_UPA = { indicadoresDisponiveis: true, notaMedia: 4.2, nAvaliacoes: 12, tempoMedianoMinutos: 35 };

  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue(null);
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: {} });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([UPA, CLINICA]);
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UPA, CLINICA]);
    CatalogoLocal.conferirSeVencida.mockResolvedValue(false);
  });

  test("mostra a cópia guardada, em ordem de nome, sem esperar os indicadores", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
    const nomes = screen.getAllByText(/^(Upa Riacho Fundo|Clínica Água)$/).map((n) => n.props.children);
    expect(nomes).toEqual(["Clínica Água", "Upa Riacho Fundo"]);
  });

  test("a nota e o tempo do servidor aparecem no card do hospital", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: { hU: NOTA_DA_UPA } });

    renderizar();

    expect(await screen.findByText("12 avaliações")).toBeTruthy();
    expect(screen.getByLabelText(/Tempo médio de espera/)).toBeTruthy();
  });

  test("hospital sem indicadores na resposta fica sem nota", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: { hU: NOTA_DA_UPA } });

    renderizar();
    await screen.findByText("12 avaliações");

    expect(screen.getAllByText("Ainda sem avaliações suficientes")).toHaveLength(1);
  });

  test("sem servidor para os indicadores, a lista fica na tela com o aviso", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockRejectedValue(new Error("Servidor indisponível"));

    renderizar();

    expect(await screen.findByText(/Mostrando a lista guardada no aparelho/)).toBeTruthy();
    expect(screen.getByText("Upa Riacho Fundo")).toBeTruthy();
    expect(screen.queryByText("Algo deu errado")).toBeNull();
  });

  test("enquanto os indicadores só demoram, não mostra o aviso", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText(/Mostrando a lista guardada no aparelho/)).toBeNull();
  });

  test("ordena como o backend (binário)", async () => {
    const UBS = { id: "hX", nome: "Ubs 1", tipo: "PUBLICO", categoria: "UBS" };
    const UPA_MAIUSCULA = { id: "hY", nome: "UPA 2", tipo: "PUBLICO", categoria: "UPA" };
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UBS, UPA_MAIUSCULA]);

    renderizar();
    await screen.findByText("UPA 2");

    const nomes = screen.getAllByText(/^(Ubs 1|UPA 2)$/).map((n) => n.props.children);
    expect(nomes).toEqual(["UPA 2", "Ubs 1"]);
  });

  test("estabelecimento desativado na cópia não aparece", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UPA, { ...CLINICA, ativo: false }]);

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText("Clínica Água")).toBeNull();
  });

  test("o filtro de tipo vale para a cópia guardada", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    // O chip de filtro vem antes da lista; o selo "Privado" do card repete o texto.
    fireEvent.press(screen.getAllByRole("button", { name: "Privado" })[0]);

    expect(await screen.findByText("Clínica Água")).toBeTruthy();
    expect(screen.queryByText("Upa Riacho Fundo")).toBeNull();
  });

  test("a busca ignora acento e caixa na cópia guardada", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital ou UPA"), "AGUA");

    await waitFor(() => expect(screen.queryByText("Upa Riacho Fundo")).toBeNull());
    expect(screen.getByText("Clínica Água")).toBeTruthy();
  });

  test("sem cópia guardada, usa o catálogo baixado assim que ele chega", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue(null);
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([UPA]);

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
  });

  test("com cópia guardada, confere a idade dela em segundo plano sem esperar a rede", async () => {
    CatalogoLocal.conferirSeVencida.mockReturnValue(new Promise(() => {}));

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
    expect(CatalogoLocal.conferirSeVencida).toHaveBeenCalledTimes(1);
    expect(CatalogoLocal.obterEstabelecimentos).not.toHaveBeenCalled();
  });

  test("cópia vencida trocada em segundo plano entra na lista sem recarregar a tela", async () => {
    const NOVO = { id: "hN", nome: "Hospital Novo", tipo: "PUBLICO", categoria: "HOSPITAL" };
    CatalogoLocal.lerCopiaGuardada.mockResolvedValueOnce([UPA]).mockResolvedValue([UPA, NOVO]);
    CatalogoLocal.conferirSeVencida.mockResolvedValueOnce(true).mockResolvedValue(false);

    renderizar();

    expect(await screen.findByText("Hospital Novo")).toBeTruthy();
  });

  test("nota embutida numa cópia antiga do catálogo não aparece no lugar da do servidor", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([{ ...UPA, indicadores: NOTA_DA_UPA }]);
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText("12 avaliações")).toBeNull();
  });

  test("busca sem resultado na cópia sugere ajustar o filtro", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital ou UPA"), "inexistente");

    expect(await screen.findByText("Nenhum hospital encontrado")).toBeTruthy();
  });

  test("catálogo vazio oferece sugerir um hospital", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([]);

    renderizar();
    fireEvent.press(await screen.findByText("Sugerir hospital"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("SugerirHospital");
  });

  test("puxar para atualizar confere o catálogo com o servidor e busca os indicadores de novo", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");
    await waitFor(() => expect(HospitalService.listarIndicadoresDoCatalogo).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByTestId("lista-hospitais").props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(HospitalService.listarIndicadoresDoCatalogo).toHaveBeenCalledTimes(2));
    expect(CatalogoLocal.obterEstabelecimentos).toHaveBeenCalledWith({ idadeMaximaMs: 0 });
  });
});
