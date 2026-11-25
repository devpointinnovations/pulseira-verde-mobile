/**
 * Smoke test de navegação (E6-01): garante que o App monta e que a barra de
 * Bottom Tabs exibe as 4 abas do novo layout (Início, Ranking, Visitas, Perfil).
 *
 * Renderiza o `App` real com mocks das libs nativas (mapa, notifications, GPS),
 * conforme já feitos em `jest.setup.js`, e valida a árvore de acessibilidade da tab bar.
 */
import React from "react";
import { StyleSheet } from "react-native";
import { colors } from "../../theme";
import { render, screen, act, fireEvent } from "@testing-library/react-native";
import * as Notifications from "expo-notifications";
import { __setMockInsets } from "react-native-safe-area-context";
import App from "../../../App";
import { concluirOnboarding } from "../../screens/onboarding/service/OnboardingService";
import * as FeedbackNotificationService from "../../screens/feedback/service/FeedbackNotificationService";

// utils/mapkit (adaptador do MapLibre): expõe componentes nativos não
// suportados pelo Jest; substituímos por Views textuais para o smoke test.
jest.mock("../../utils/mapkit", () => {
  const { View } = require("react-native");
  const stub = (props) => <View {...props} />;
  return {
    __esModule: true,
    MapView: stub,
    Camera: stub,
    MarkerView: stub,
    ShapeSource: stub,
    LineLayer: stub,
    FillLayer: stub,
  };
});

// A tela do mapa liga o GPS e segura o processo do Jest aberto; aqui só importa a navegação.
jest.mock("../../screens/geolocalizacao/view/GeoLocalizacaoScreen", () => {
  const { Text } = require("react-native");
  return { __esModule: true, default: () => <Text>Mapa de Geolocalização</Text> };
});

// expo-task-manager: o módulo nativo não roda em Jest.
jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  registerTaskAsync: jest.fn(async () => true),
  unregisterTaskAsync: jest.fn(async () => true),
}));

// react-native-safe-area-context: insets nativos indisponíveis em Jest; mock manual
// para que SafeAreaProvider/SafeAreaView montem os filhos e o app renderize as tabs.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  // Mutável: o teste da barra de sistema (Android com botões na tela) precisa simular
  // um `insets.bottom` real (~48), diferente do padrão 0 (equivalente à barra de
  // gestos, que não expõe o bug corrigido em App.js).
  let insetsAtuais = { top: 0, right: 0, bottom: 0, left: 0 };
  const SafeAreaProvider = ({ children, ...rest }) =>
    React.createElement(View, { ...rest, style: { flex: 1 }, collapsable: false }, children);
  const SafeAreaView = ({ children, style, ...rest }) =>
    React.createElement(View, { ...rest, style: [{ flex: 1 }, style] }, children);
  const SafeAreaInsetsContext = React.createContext(insetsAtuais);
  return {
    __esModule: true,
    SafeAreaProvider,
    SafeAreaView,
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => insetsAtuais,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    get initialWindowMetrics() {
      return { insets: insetsAtuais, frame: { x: 0, y: 0, width: 390, height: 844 } };
    },
    // Só para este arquivo de teste — não existe no módulo real.
    __setMockInsets: (novo) => {
      insetsAtuais = novo;
    },
  };
});

// react-native-gesture-handler: módulo nativo (install/handlers) exigido por
// react-native-screens e pelo bottom-tabs; o stack JS saiu no ARQ-04;
// mock simples para renderizar no Jest.
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  const stubHandler = ({ children, ...rest }) => React.createElement(View, { ...rest }, children);
  return {
    __esModule: true,
    default: { install: jest.fn() },
    GestureHandlerRootView: ({ children, ...rest }) =>
      React.createElement(View, { ...rest, style: { flex: 1 } }, children),
    PanGestureHandler: stubHandler,
    TapGestureHandler: stubHandler,
    LongPressGestureHandler: stubHandler,
    NativeViewGestureHandler: stubHandler,
    State: { UNDETERMINED: 0, BEGAN: 1, ACTIVE: 2, END: 3, CANCELLED: 4, FAILED: 5 },
  };
});

/**
 * O `App` real monta a aba inicial, que consulta a visita ativa (E2-07) — este
 * smoke test precisa declarar o que a rede responde, senão cai no `fetch` que
 * falha alto do `jest.setup.js`.
 *
 * Antes de 04/09/2026 nada era declarado aqui e, como o guard `if (!global.fetch)`
 * do setup era inerte no Node 20, esta suíte fazia **HTTP real** contra
 * `192.168.0.10:8080`. Os sockets e os temporizadores de 20 s do `fetchComTimeout`
 * sobreviviam ao fim do teste: era a origem única do aviso "A worker process has
 * failed to exit gracefully" e de ~40 s de espera por execução da suíte inteira.
 *
 * A resposta é "sem visita ativa", que é o estado de quem abre o app pela primeira
 * vez — o caminho que este smoke test deve exercitar.
 */
beforeEach(async () => {
  // Quem já passou pela apresentação abre direto nas abas.
  await concluirOnboarding();
  global.fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => null,
    text: async () => "",
  }));
});

describe("App — Bottom Tabs (E6-01)", () => {
  it("monta o app e exibe as 4 abas do novo layout (Início, Ranking, Visitas, Perfil)", async () => {
    render(<App />);
    await screen.findByText("Início");

    expect(screen.getByText("Início")).toBeOnTheScreen();
    expect(screen.getByText("Ranking")).toBeOnTheScreen();
    expect(screen.getByText("Visitas")).toBeOnTheScreen();
    expect(screen.getByText("Perfil")).toBeOnTheScreen();
    expect(screen.queryByText("Mapa")).toBeNull();
  });

  it("cada aba tem um rótulo de acessibilidade que diz o que ela abre", async () => {
    render(<App />);
    await screen.findByText("Início");

    expect(screen.getByLabelText("Início — hospitais perto de você")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ranking — melhores hospitais")).toBeOnTheScreen();
    expect(screen.getByLabelText("Visitas — histórico e avaliações pendentes")).toBeOnTheScreen();
    expect(screen.getByLabelText("Perfil — conta e privacidade")).toBeOnTheScreen();
  });

  it("Início abre a lista de hospitais e o ícone ativo fica na pílula verde", async () => {
    render(<App />);
    await screen.findByText("Início");

    expect(screen.getByText("Perto de você")).toBeOnTheScreen();
    // A tab bar desenha o ícone ativo e o inativo de cada aba e alterna pela opacidade.
    const ativas = screen.getAllByTestId("aba-ativa");
    expect(ativas).toHaveLength(4);
    ativas.forEach((pilula) =>
      expect(StyleSheet.flatten(pilula.props.style).backgroundColor).toBe(colors.primaryContainer)
    );
  });

  it("tocar de novo na aba Início depois de abrir o mapa volta para a lista", async () => {
    render(<App />);
    await screen.findByText("Início");

    fireEvent.press(screen.getByLabelText("Abrir o mapa completo"));
    expect(await screen.findByText("Mapa de Geolocalização")).toBeOnTheScreen();

    fireEvent.press(screen.getByLabelText("Ranking — melhores hospitais"));
    fireEvent.press(screen.getByLabelText("Início — hospitais perto de você"));
    expect(await screen.findByText("Perto de você")).toBeOnTheScreen();
  });

  it("em aparelho com barra de sistema (botões na tela), a tab bar soma o inset — não fica atrás dela", async () => {
    // Relato do PO com captura de tela do físico: a barra ficava atrás dos botões do
    // Android. `insets.bottom` só é > 0 com a barra de navegação clássica — a de
    // gestos tem inset ~0 e não expõe o bug. `@react-navigation/bottom-tabs` soma esse
    // inset sozinho, mas SÓ quando a tela não define `height`/`paddingBottom` fixos no
    // `tabBarStyle` — um valor fixo entra depois no array de estilos e o sobrescreve.
    __setMockInsets({ top: 0, right: 0, bottom: 48, left: 0 });

    render(<App />);
    await screen.findByText("Início");

    // `getByRole("tablist")` não resolve neste ambiente (RNTL não mapeia esse role em
    // particular); o elemento existe na árvore com `accessibilityRole="tablist"` — é
    // o próprio marcador que a lib usa para o container das abas, então é estável.
    const tablist = screen.UNSAFE_getByProps({ accessibilityRole: "tablist" });
    const barra = tablist.parent;
    const estilo = StyleSheet.flatten(barra.props.style);

    expect(estilo.height).toBe(72 + 48);
    expect(estilo.paddingBottom).toBe(8 + 48);
  });
});

afterEach(() => {
  __setMockInsets({ top: 0, right: 0, bottom: 0, left: 0 });
});

describe("App — apresentação na primeira abertura", () => {
  it("quem ainda não passou pela apresentação abre nela, não nas abas", async () => {
    await require("@react-native-async-storage/async-storage").default.__reset();

    render(<App />);

    expect(await screen.findByText("Saiba qual hospital atende melhor perto de você")).toBeOnTheScreen();
    expect(screen.queryByText("Perfil")).toBeNull();
  });
});

describe("App — abrir formulário a partir da notificação de feedback (RN-09)", () => {
  /** Captura o callback registrado em Notifications.addNotificationResponseReceivedListener. */
  function callbackDeResposta() {
    const chamada = Notifications.addNotificationResponseReceivedListener.mock.calls.at(-1);
    return chamada[0];
  }

  function respostaDeNotificacao(data) {
    return { notification: { request: { content: { data } } } };
  }

  test("pendência dentro da janela de 24h abre o formulário de feedback", async () => {
    jest.spyOn(FeedbackNotificationService, "pendenciaDaVisita").mockResolvedValue({
      visitaId: "v1",
      hospitalNome: "Hospital Central",
    });
    jest.spyOn(FeedbackNotificationService, "agendarLembrete").mockResolvedValue(undefined);

    render(<App />);
    const tratarResposta = callbackDeResposta();

    await act(async () => {
      await tratarResposta(respostaDeNotificacao({ abrirFeedback: true, visitaId: "v1" }));
    });

    expect(await screen.findByText("Você passou pela triagem?")).toBeOnTheScreen();
  });

  test("pendência vencida (>24h) não abre o formulário — RN-09", async () => {
    // Achado da auditoria de código morto (08/09/2026): a notificação pode ficar
    // parada na bandeja além da janela de 24h; antes desta correção, tocá-la ainda
    // abria o formulário, que só falhava ao enviar (backend responde 404).
    // pendenciaDaVisita devolve null para a pendência vencida (ou já respondida).
    jest.spyOn(FeedbackNotificationService, "pendenciaDaVisita").mockResolvedValue(null);
    const agendarLembreteSpy = jest.spyOn(FeedbackNotificationService, "agendarLembrete");

    render(<App />);
    const tratarResposta = callbackDeResposta();

    await act(async () => {
      await tratarResposta(respostaDeNotificacao({ abrirFeedback: true, visitaId: "v1" }));
    });

    expect(screen.queryByText("Você passou pela triagem?")).toBeNull();
    expect(screen.getByText("Início")).toBeOnTheScreen();
    expect(agendarLembreteSpy).not.toHaveBeenCalled();
  });

  test("a notificação tocada consulta a pendência da PRÓPRIA visita", async () => {
    // Achado do code-review (08/09/2026): com uma pendência só, uma notificação antiga
    // abria o formulário com o hospital da visita mais recente. Agora cada visita tem a
    // sua pendência e a busca é pelo visitaId da notificação.
    const pendenciaDaVisitaSpy = jest
      .spyOn(FeedbackNotificationService, "pendenciaDaVisita")
      .mockResolvedValue({ visitaId: "v1-antiga", hospitalNome: "Hospital Antigo" });
    jest.spyOn(FeedbackNotificationService, "agendarLembrete").mockResolvedValue(undefined);

    render(<App />);
    const tratarResposta = callbackDeResposta();

    await act(async () => {
      await tratarResposta(
        respostaDeNotificacao({ abrirFeedback: true, visitaId: "v1-antiga" })
      );
    });

    expect(pendenciaDaVisitaSpy).toHaveBeenCalledWith("v1-antiga");
    expect(await screen.findByText("Hospital Antigo")).toBeOnTheScreen();
  });

  test("abre o formulário mesmo se o agendamento do lembrete falhar (bug de foreground)", async () => {
    // Bug relatado: com o app aberto numa tela qualquer, tocar a notificação não
    // redirecionava. A causa era `await agendarLembrete(...)` ANTES do navigate — se o
    // agendamento falhasse, o navigate nunca rodava. Agora a navegação vem primeiro e o
    // lembrete é efeito colateral tolerante a falha.
    jest.spyOn(FeedbackNotificationService, "pendenciaDaVisita").mockResolvedValue({
      visitaId: "v1",
      hospitalNome: "Hospital Central",
    });
    jest
      .spyOn(FeedbackNotificationService, "agendarLembrete")
      .mockRejectedValue(new Error("falha ao agendar lembrete"));

    render(<App />);
    const tratarResposta = callbackDeResposta();

    await act(async () => {
      await tratarResposta(respostaDeNotificacao({ abrirFeedback: true, visitaId: "v1" }));
    });

    expect(await screen.findByText("Você passou pela triagem?")).toBeOnTheScreen();
  });

  test("notificação de unidades sobrepostas abre o seletor com as unidades (E2-04)", async () => {
    render(<App />);
    const tratarResposta = callbackDeResposta();

    await act(async () => {
      await tratarResposta(
        respostaDeNotificacao({
          escolhaUnidade: {
            tipo: "desempate",
            opcoes: [
              { hospitalId: "h1", nome: "Hospital Regional de Taguatinga" },
              { hospitalId: "h2", nome: "Cepav - Azaleia" },
            ],
            posicao: { type: "Point", coordinates: [-48.07, -15.89] },
            entrada: "2026-11-24T22:00:00.000Z",
          },
        })
      );
    });

    expect(await screen.findByText("Em qual unidade você está?")).toBeOnTheScreen();
    expect(screen.getByText("Cepav - Azaleia")).toBeOnTheScreen();
    // Não é feedback: nenhuma pendência é consultada.
    expect(screen.queryByText("Você passou pela triagem?")).toBeNull();
  });

  test("cold start: a notificação que abriu o app do zero leva ao feedback (bug 'Fechar tudo')", async () => {
    // Bug relatado: após "Fechar tudo", tocar a notificação abria a tela inicial. O
    // listener ao vivo não recebe a resposta que INICIA o app — ela vem por
    // getLastNotificationResponseAsync, tratada no mount.
    jest.spyOn(FeedbackNotificationService, "pendenciaDaVisita").mockResolvedValue({
      visitaId: "v1",
      hospitalNome: "Hospital Central",
    });
    jest.spyOn(FeedbackNotificationService, "agendarLembrete").mockResolvedValue(undefined);
    Notifications.getLastNotificationResponseAsync.mockResolvedValueOnce(
      respostaDeNotificacao({ abrirFeedback: true, visitaId: "v1" })
    );

    render(<App />);

    // O caminho de cold start é assíncrono (getLastNotificationResponseAsync no mount);
    // findByText aguarda a navegação despachar o formulário.
    expect(await screen.findByText("Você passou pela triagem?")).toBeOnTheScreen();
  });
});