/**
 * Detalhe público do hospital (F-03/F-04) — regressão do crash de check-in manual.
 *
 * Bug corrigido: o `useMemo` de `temporizadorTexto` ficava depois dos `return`
 * condicionais de carregamento/erro, violando as Regras de Hooks do React (o número
 * de hooks executados variava entre a renderização "carregando" e a renderização com
 * dados prontos). Isso disparava "Rendered more hooks than during the previous
 * render" e derrubava o app inteiro ao abrir o detalhe de um hospital — tanto ao
 * tocar em "Check-in" (que navega direto para cá) quanto ao abrir o card de um
 * hospital com visita já ativa.
 *
 * Todo teste abaixo que usa `renderizar()` já exercita a transição real
 * carregando -> dados prontos (a promise de `buscarPorId` resolve depois do primeiro
 * paint), então qualquer regressão nas Regras de Hooks volta a quebrar estes testes.
 */
import React from "react";
import { fireEvent, screen, act, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import HospitalDetalheScreen from "../../../screens/hospitais/view/HospitalDetalheScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { agendarFeedback } from "../../../screens/feedback/service/FeedbackNotificationService";
import { ErroSemInternet } from "../../../config/http";
import { Alert as AlertModule, Linking } from "react-native";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackNotificationService");

// Guarda o callback de foco mais recente para o teste poder simular um segundo
// foco da tela (ex.: voltar de outro app) sem desmontar o componente.
let callbackDeFoco = null;

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    callbackDeFoco = callback;
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const HOSPITAL = {
  id: "h1",
  nome: "Hospital Central",
  tipo: "PUBLICO",
  categoria: "HOSPITAL",
  tipoUnidade: "HOSPITAL GERAL",
  horarioFuncionamento: "24 horas",
  ativo: true,
  endereco: { logradouro: "Rua das Flores, 100", cidade: "Brasília", uf: "DF", cep: "70000-000" },
  contato: { telefone: "(61) 3333-4444", email: "contato@hospitalcentral.df.gov.br" },
  geofence: {
    type: "Polygon",
    coordinates: [
      [
        [-47.9, -15.8],
        [-47.91, -15.8],
        [-47.91, -15.81],
        [-47.9, -15.81],
        [-47.9, -15.8],
      ],
    ],
  },
};

const INDICADORES = {
  hospitalId: "h1",
  indicadoresDisponiveis: true,
  notaMedia: 4.2,
  nAvaliacoes: 10,
  tempoMedianoMinutos: 45,
  nVisitas: 20,
  periodo: { inicio: "2026-08-01", fim: "2026-08-31" },
  atualizadoEm: "2026-09-01T00:00:00Z",
};

const NAVEGACAO = { goBack: jest.fn(), navigate: jest.fn() };

function renderizar(id = "h1") {
  const route = { params: { id } };
  return renderComProviders(<HospitalDetalheScreen navigation={NAVEGACAO} route={route} />);
}

/** Checkout aceito: depois dele, o servidor passa a responder que não há visita ativa. */
function checkoutComSucesso(resposta) {
  VisitaService.checkout.mockImplementation(async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    return resposta;
  });
}

/** Simula a tela ganhando foco de novo (ex.: voltar de outro app), sem remontar. */
async function refocarTela() {
  await act(async () => {
    callbackDeFoco();
  });
}

describe("HospitalDetalheScreen (F-03/F-04) — crash do check-in manual", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sessão lida do aparelho (anônima): a visita ativa só é consultada depois disso.
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue(HOSPITAL);
    HospitalService.buscarIndicadores.mockResolvedValue(INDICADORES);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    // Assíncrona como a real: a tela encadeia `.catch` no retorno.
    agendarFeedback.mockResolvedValue(null);
  });

  test("sai de carregando para os dados prontos sem quebrar (Regras de Hooks)", async () => {
    renderizar();
    expect(await screen.findByText("Hospital Central")).toBeTruthy();
    expect(screen.getByText(/Rua das Flores, 100/)).toBeTruthy();
    expect(screen.getByText("24 horas")).toBeTruthy();
  });

  test("'Compartilhar' manda o nome e a nota do hospital", async () => {
    const share = jest.spyOn(Share, "share").mockResolvedValue({});
    renderizar();
    await screen.findByText("Hospital Central");
    await waitFor(() => expect(screen.getByText("4,2")).toBeTruthy());

    fireEvent.press(screen.getByLabelText("Compartilhar"));

    expect(share).toHaveBeenCalledWith({
      message: "Hospital Central, nota 4,2. Veja a nota e o tempo de espera no Pulseira Verde.",
    });
  });

  test("'Compartilhar' sem nota suficiente manda só o nome", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({ ...INDICADORES, indicadoresDisponiveis: false });
    const share = jest.spyOn(Share, "share").mockResolvedValue({});
    renderizar();
    await screen.findByText("Hospital Central");

    fireEvent.press(screen.getByLabelText("Compartilhar"));

    expect(share).toHaveBeenCalledWith({ message: "Hospital Central. Veja a nota e o tempo de espera no Pulseira Verde." });
  });

  test("com visita manual ativa no mesmo hospital, exibe o cronômetro sem crashar", async () => {
    // Esta é exatamente a navegação que antes derrubava o app: check-in feito com
    // sucesso -> HospitaisScreen navega para cá -> tela carrega com visita já ativa.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: {
        id: "v1",
        origem: "MANUAL",
        hospitalId: "h1",
        entrada: new Date(Date.now() - 65 * 1000).toISOString(),
      },
    });

    renderizar();

    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();
    expect(screen.queryByText("Estou aqui agora")).toBeNull();
    expect(screen.getByText("Não estou aqui")).toBeTruthy();
    // Cronômetro formatado hh:mm:ss (>= 00:01:05, sem travar em 00:00:00).
    expect(screen.getByLabelText(/Tempo de permanência 00:01:/)).toBeTruthy();
  });

  test("visita ativa em OUTRO hospital não mostra o cronômetro deste hospital", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v2", origem: "MANUAL", hospitalId: "outro-hospital", entrada: new Date().toISOString() },
    });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("visita GEOFENCE ativa no mesmo hospital mostra o cronômetro (teste de campo da rc.6)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v3", origem: "GEOFENCE", hospitalId: "h1", entrada: new Date().toISOString() },
    });

    renderizar();

    expect(await screen.findByText("Check-in automático ativo")).toBeTruthy();
    expect(screen.getByLabelText(/^Tempo de permanência \d{2}:\d{2}:\d{2}$/)).toBeTruthy();
  });

  test("visita GEOFENCE ativa não oferece o 'Não estou aqui' (decisão do PO, 21/10/2026)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v3", origem: "GEOFENCE", hospitalId: "h1", entrada: new Date().toISOString() },
    });

    renderizar();
    await screen.findByText("Check-in automático ativo");

    expect(screen.queryByText("Não estou aqui")).toBeNull();
  });

  test("visita GEOFENCE de outro hospital não mostra o cronômetro", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v4", origem: "GEOFENCE", hospitalId: "h9", entrada: new Date().toISOString() },
    });

    renderizar();
    await screen.findByText("Hospital Central");

    expect(screen.queryByText("Check-in automático ativo")).toBeNull();
  });

  test("'Não estou aqui' finaliza o check-out e repassa a duração ao feedback (RN-01/RN-07)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    // A duração vem da resposta do checkout; quem decide convidar ou não é agendarFeedback.
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 8 });

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", { encerramentoManual: true });
    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        visitaId: "v1",
        hospitalId: "h1",
        hospitalNome: "Hospital Central",
        duracaoMinutos: 8,
      })
    );
    await waitFor(() => expect(screen.queryByText("Check-in manual ativo")).toBeNull());
  });

  test("check-out de visita curta (<2 min) repassa a duração — não convida para feedback (RN-01/RN-07)", async () => {
    // Bug relatado: check-in seguido de checkout imediato ainda disparava a pesquisa. A
    // duração curta é repassada e o gate de 2 min em agendarFeedback (testado em unidade)
    // suprime a notificação.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 1 });

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", duracaoMinutos: 1 })
    );
  });

  test("falha ao agendar o feedback é registrada e o cronômetro some mesmo assim", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 8 });
    agendarFeedback.mockRejectedValue(new Error("disco cheio"));

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(warn).toHaveBeenCalledWith("useEncerrarVisitaManual: falha ao agendar o feedback", "disco cheio");
    await waitFor(() => expect(screen.queryByText("Check-in manual ativo")).toBeNull());
    warn.mockRestore();
  });

  test("erro no check-out mantém a visita ativa e mostra alerta", async () => {
    const AlertModule = require("react-native").Alert;
    jest.spyOn(AlertModule, "alert").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    VisitaService.checkout.mockRejectedValue(new Error("Falha ao finalizar."));

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(AlertModule.alert).toHaveBeenCalledWith("Check-out", "Falha ao finalizar.");
    expect(screen.getByText("Check-in manual ativo")).toBeTruthy();
  });

  test("check-out sem internet é enfileirado (OPS-05): encerra localmente em vez de deixar o cronômetro rodando", async () => {
    // Regressão evitada: sem este tratamento, um checkout enfileirado (sucesso do
    // ponto de vista do usuário — será sincronizado depois) caía no mesmo catch
    // genérico de erro e deixava o cronômetro contando indefinidamente para uma
    // visita que o usuário já encerrou.
    const AlertModule = require("react-native").Alert;
    jest.spyOn(AlertModule, "alert").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    VisitaService.checkout.mockRejectedValue(
      Object.assign(new Error("Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."), {
        enfileirado: true,
      })
    );

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", hospitalId: "h1", hospitalNome: "Hospital Central" })
    );
    await waitFor(() => expect(screen.queryByText("Check-in manual ativo")).toBeNull());
    expect(AlertModule.alert).toHaveBeenCalledWith(
      "Sem conexão",
      "Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."
    );

    // Voltar à tela ainda sem conexão não traz de volta o cronômetro da visita encerrada.
    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("um refoco sem internet não apaga o cronômetro de uma visita manual já carregada", async () => {
    // Achado do code-review: o mesmo bug corrigido em HospitaisScreen (catch
    // zerando o estado em QUALQUER falha) existia aqui. Sem conexão não significa
    // "sem visita ativa" — significa "não sabemos"; o card não pode desaparecer só
    // porque o aparelho perdeu sinal com a tela já aberta.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });

    renderizar();
    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();

    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();

    expect(screen.getByText("Check-in manual ativo")).toBeTruthy();
  });

  test("um refoco com erro real (não de conectividade) ainda limpa o cronômetro", async () => {
    // Outra metade do achado: preservar o estado só faz sentido para falha de
    // conectividade. Um erro de verdade precisa continuar zerando — senão o card
    // ficaria preso mostrando um cronômetro de uma visita que talvez nem exista mais.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    renderizar();
    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Sessão expirada. Faça login novamente."));
    await refocarTela();

    await waitFor(() => expect(screen.queryByText("Check-in manual ativo")).toBeNull());
  });

  test("indicadores insuficientes mostram a mensagem de transparência (RN-15)", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({
      hospitalId: "h1",
      indicadoresDisponiveis: false,
      notaMedia: null,
      nAvaliacoes: 2,
    });

    renderizar();
    await screen.findByText("Hospital Central");

    expect(
      screen.getByText(/Ainda sem avaliações suficientes/)
    ).toBeTruthy();
  });

  test("nota com menos de 5 avaliações também é insuficiente (mesmo critério do card)", async () => {
    // Caso limítrofe apontado no code-review: nota real mas nAvaliacoes < 5. Antes, o
    // detalhe mostrava a nota enquanto o card da lista mostrava o aviso — o mesmo
    // hospital em dois estados contraditórios. Alinhado ao critério nAvaliacoes >= 5.
    HospitalService.buscarIndicadores.mockResolvedValue({
      hospitalId: "h1",
      indicadoresDisponiveis: true,
      notaMedia: 4.2,
      nAvaliacoes: 3,
    });

    renderizar();
    await screen.findByText("Hospital Central");

    expect(
      screen.getByText(/Ainda sem avaliações suficientes/)
    ).toBeTruthy();
    expect(screen.queryByText("4,2")).toBeNull();
    expect(screen.queryByText("3 avaliações")).toBeNull();
  });

  test("falha ao buscar indicadores dedicados usa o fallback embutido no hospital", async () => {
    HospitalService.buscarIndicadores.mockRejectedValue(new Error("indisponível"));
    HospitalService.buscarPorId.mockResolvedValue({ ...HOSPITAL, indicadores: INDICADORES });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.getByText("4,2")).toBeTruthy();
  });

  test("'Como chegar' abre a rota pelo centro do geofence; sem coordenadas, pelo endereço", async () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderizar();
    fireEvent.press(await screen.findByText("Como chegar"));
    expect(abrir).toHaveBeenLastCalledWith(expect.stringMatching(/destination=-15\.80\d*%2C-47\.90\d*$/));

    HospitalService.buscarPorId.mockResolvedValue({ ...HOSPITAL, id: "h2", geofence: null });
    renderizar("h2");
    fireEvent.press((await screen.findAllByText("Como chegar")).at(-1));
    expect(abrir).toHaveBeenLastCalledWith(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Hospital Central, Rua das Flores, 100, Brasília")}`
    );
    abrir.mockRestore();
  });

  test("hospital com poucos dados: etiquetas pelo código, 'Inativo', sem endereço e sem espera", async () => {
    HospitalService.buscarPorId.mockResolvedValue({
      id: "h1",
      nome: "Unidade X",
      tipo: "MISTO",
      categoria: "OUTRO_TIPO",
      ativo: false,
    });
    HospitalService.buscarIndicadores.mockResolvedValue({
      indicadoresDisponiveis: true,
      notaMedia: 3.5,
      nAvaliacoes: 8,
    });

    renderizar();
    await screen.findByText("Unidade X");

    expect(screen.getByText("OUTRO_TIPO")).toBeTruthy();
    expect(screen.getByText("MISTO")).toBeTruthy();
    expect(screen.getByText("Inativo")).toBeTruthy();
    expect(screen.getByText("3,5")).toBeTruthy();
    expect(screen.queryByText(/tempo médio de espera/)).toBeNull();
    expect(screen.queryByText(/atendimentos no período/)).toBeNull();
    expect(screen.queryByText(/Período:/)).toBeNull();
  });

  test("voltar funciona enquanto o hospital carrega", () => {
    HospitalService.buscarPorId.mockReturnValue(new Promise(() => {}));
    renderizar();
    fireEvent.press(screen.getByLabelText("Voltar"));
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });

  test("'Ligar' e 'E-mail' usam o contato; sem contato, os botões somem", async () => {
    const abrir = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    renderizar();
    fireEvent.press(await screen.findByText("Ligar"));
    fireEvent.press(screen.getByText("E-mail"));
    expect(abrir).toHaveBeenCalledWith("tel:6133334444");
    expect(abrir).toHaveBeenCalledWith("mailto:contato@hospitalcentral.df.gov.br");
    abrir.mockRestore();
  });

  test("sem contato, só 'Como chegar' aparece", async () => {
    HospitalService.buscarPorId.mockResolvedValue({ ...HOSPITAL, contato: null, horarioFuncionamento: null });
    renderizar();
    await screen.findByText("Como chegar");
    expect(screen.queryByText("Ligar")).toBeNull();
    expect(screen.queryByText("E-mail")).toBeNull();
    expect(screen.queryByText("24 horas")).toBeNull();
  });

  test("mostra etiquetas, nota e o tempo de espera em minutos", async () => {
    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.getByText("HOSPITAL GERAL")).toBeTruthy();
    expect(screen.getByText("Público")).toBeTruthy();
    expect(screen.getByText("24 horas")).toBeTruthy();
    expect(screen.getByText("4,2")).toBeTruthy();
    expect(screen.getByText("45 min")).toBeTruthy();
    expect(screen.getByText("com base em 20 atendimentos no período")).toBeTruthy();
  });

  test("'Estou aqui agora' faz o check-in manual e o cronômetro toma o lugar do botão", async () => {
    VisitaService.checkin.mockImplementation(async () => {
      const visita = { id: "v7", hospitalId: "h1", origem: "MANUAL", entrada: new Date().toISOString() };
      VisitaService.buscarAtiva.mockResolvedValue({ visita });
      return visita;
    });
    renderizar();
    await act(async () => {
      fireEvent.press(await screen.findByText("Estou aqui agora"));
    });

    expect(VisitaService.checkin).toHaveBeenCalledWith(expect.objectContaining({ hospitalId: "h1", origem: "MANUAL" }));
    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();
    expect(screen.queryByText("Estou aqui agora")).toBeNull();
  });

  test("'Estou aqui agora' com visita em outro hospital avisa e não faz check-in", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: { id: "v2", hospitalId: "outro", origem: "MANUAL" } });
    renderizar();
    await screen.findByText("Hospital Central");
    await waitFor(() => expect(VisitaService.buscarAtiva).toHaveBeenCalled());
    await act(async () => {});
    jest.spyOn(AlertModule, "alert").mockImplementation(() => {});
    fireEvent.press(screen.getByText("Estou aqui agora"));

    expect(AlertModule.alert).toHaveBeenCalledWith("Check-in ativo", expect.any(String));
    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  test("erro ao carregar o hospital mostra o empty state com nova tentativa", async () => {
    HospitalService.buscarPorId.mockRejectedValueOnce(new Error("Hospital fora do ar."));

    renderizar();
    expect(await screen.findByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.getByText("Hospital fora do ar.")).toBeTruthy();

    HospitalService.buscarPorId.mockResolvedValueOnce(HOSPITAL);
    fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByText("Hospital Central")).toBeTruthy();
  });

  test("erro sem mensagem mostra o texto padrão", async () => {
    HospitalService.buscarPorId.mockRejectedValueOnce(new Error(""));

    renderizar();

    expect(await screen.findByText("Não foi possível carregar o hospital.")).toBeTruthy();
  });

  test("uma atualização que falha com o hospital já na tela não troca a tela pelo erro", async () => {
    const { queryClient } = renderizar();
    await screen.findByText("Hospital Central");

    HospitalService.buscarPorId.mockRejectedValueOnce(new Error("Sem conexão."));
    await act(async () => {
      await queryClient.refetchQueries();
    });

    expect(screen.getByText("Hospital Central")).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar")).toBeNull();
  });

  test("botão voltar aciona a navegação", async () => {
    renderizar();
    await screen.findByText("Hospital Central");
    fireEvent.press(screen.getByLabelText(/[Vv]oltar/));
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });

  test("sem id na rota não consulta o hospital", async () => {
    // A visita ativa é a consulta compartilhada do app (o observador global já a
    // mantém), então só o hospital depende do id.
    renderizar(null);
    await act(async () => {});

    expect(HospitalService.buscarPorId).not.toHaveBeenCalled();
    expect(HospitalService.buscarIndicadores).not.toHaveBeenCalled();
  });
});

describe("HospitalDetalheScreen — tendência simples da nota (E4-06)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue(HOSPITAL);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
  });

  test("mostra a frase da tendência e o leitor de tela lê a frase", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({
      ...INDICADORES,
      tendenciaNota: "SUBINDO",
      variacaoNota: 0.4,
      tendenciaPreliminar: false,
    });
    renderizar();

    expect(await screen.findByText("Nota subiu 0,4 em relação aos 30 dias anteriores")).toBeTruthy();
    expect(screen.getByLabelText("Nota subiu 0,4 em relação aos 30 dias anteriores.")).toBeTruthy();
    expect(screen.queryByText("Preliminar")).toBeNull();
  });

  test("tendência preliminar mostra o selo e o leitor de tela avisa", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({
      ...INDICADORES,
      tendenciaNota: "CAINDO",
      variacaoNota: -0.8,
      tendenciaPreliminar: true,
    });
    renderizar();

    expect(await screen.findByText("Nota caiu 0,8 em relação aos 30 dias anteriores")).toBeTruthy();
    expect(screen.getByText("Preliminar")).toBeTruthy();
    expect(
      screen.getByLabelText(
        "Nota caiu 0,8 em relação aos 30 dias anteriores. Preliminar: ainda há poucas avaliações."
      )
    ).toBeTruthy();
  });

  test("nota estável aparece sem número", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({
      ...INDICADORES,
      tendenciaNota: "ESTAVEL",
      variacaoNota: 0.1,
      tendenciaPreliminar: false,
    });
    renderizar();

    expect(await screen.findByText("Nota estável em relação aos 30 dias anteriores")).toBeTruthy();
  });

  test("sem tendência do servidor a tela não mostra nada dela", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue(INDICADORES);
    renderizar();

    expect(await screen.findByText("Hospital Central")).toBeTruthy();
    expect(screen.queryByTestId("tendencia-nota")).toBeNull();
  });
});
