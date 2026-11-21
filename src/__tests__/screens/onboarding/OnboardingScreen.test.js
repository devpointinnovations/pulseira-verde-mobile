/**
 * Apresentação do novo layout (3 telas): avanço, pedidos de permissão e conclusão.
 */
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import OnboardingScreen from "../../../screens/onboarding/view/OnboardingScreen";
import { onboardingConcluido } from "../../../screens/onboarding/service/OnboardingService";
import { iniciarGeofencing } from "../../../screens/visitas/service/GeofencingTaskService";
import { solicitarPermissaoNotificacao } from "../../../services/NotificacaoPermissao";
import PerfilService from "../../../screens/perfil/service/PerfilService";

jest.mock("../../../screens/visitas/service/GeofencingTaskService", () => ({ iniciarGeofencing: jest.fn() }));
jest.mock("../../../services/NotificacaoPermissao", () => ({ solicitarPermissaoNotificacao: jest.fn() }));
jest.mock("../../../screens/perfil/service/PerfilService", () => ({
  __esModule: true,
  default: { permissaoLocalizacao: jest.fn(), atualizarConsentimento: jest.fn() },
}));

function renderizar() {
  const navigation = { reset: jest.fn() };
  renderComProviders(<OnboardingScreen navigation={navigation} />);
  return navigation;
}

const PARA_AS_ABAS = { index: 0, routes: [{ name: "Tabs" }] };

describe("OnboardingScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.__reset();
    iniciarGeofencing.mockResolvedValue(undefined);
    PerfilService.permissaoLocalizacao.mockResolvedValue("granted");
    PerfilService.atualizarConsentimento.mockResolvedValue(null);
    solicitarPermissaoNotificacao.mockResolvedValue(true);
  });

  it("percorre as 3 telas pedindo localização e avisos, registra o consentimento e abre o app", async () => {
    const navigation = renderizar();
    expect(screen.getByText("Saiba qual hospital atende melhor perto de você")).toBeTruthy();
    expect(screen.getByLabelText("Tela 1 de 3")).toBeTruthy();

    fireEvent.press(screen.getByText("Continuar"));
    expect(screen.getByText("O app percebe quando você chega ao hospital")).toBeTruthy();
    expect(screen.getByText(/nunca é publicada/)).toBeTruthy();

    fireEvent.press(screen.getByText("Permitir localização"));
    expect(await screen.findByText("Na saída, conte como foi em 1 minuto")).toBeTruthy();
    expect(iniciarGeofencing).toHaveBeenCalled();
    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ localizacao: true });

    fireEvent.press(screen.getByText("Ativar avisos"));
    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith(PARA_AS_ABAS));
    expect(PerfilService.atualizarConsentimento).toHaveBeenCalledWith({ notificacoes: true });
    expect(await onboardingConcluido()).toBe(true);
  });

  it("'Agora não' e 'Começar sem avisos' seguem sem pedir nada ao sistema", async () => {
    const navigation = renderizar();
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent.press(screen.getByText("Agora não"));
    fireEvent.press(screen.getByText("Começar sem avisos"));

    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith(PARA_AS_ABAS));
    expect(iniciarGeofencing).not.toHaveBeenCalled();
    expect(solicitarPermissaoNotificacao).not.toHaveBeenCalled();
  });

  it("permissão negada ou falha no registro não prende a pessoa na apresentação", async () => {
    iniciarGeofencing.mockRejectedValue(new Error("negada"));
    renderizar();
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent.press(screen.getByText("Permitir localização"));

    expect(await screen.findByText("Na saída, conte como foi em 1 minuto")).toBeTruthy();
  });

  it("'Pular' conclui a apresentação de qualquer tela", async () => {
    const navigation = renderizar();
    fireEvent.press(screen.getByLabelText("Pular apresentação"));

    await waitFor(() => expect(navigation.reset).toHaveBeenCalledWith(PARA_AS_ABAS));
    expect(await onboardingConcluido()).toBe(true);
  });
});
