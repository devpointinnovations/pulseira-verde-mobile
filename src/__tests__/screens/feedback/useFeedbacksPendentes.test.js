/**
 * Número de avaliações pendentes na aba Visitas: só a contagem, a partir da lista local.
 */
import React from "react";
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClientProvider } from "@tanstack/react-query";
import { criarQueryClientDeTeste } from "../../helpers/renderComProviders";
import { useQuantidadeFeedbacksPendentes } from "../../../screens/feedback/hooks/useFeedbacksPendentes";
import { listarPendencias } from "../../../screens/feedback/service/FeedbackNotificationService";
import { queryKeys } from "../../../core/query/queryKeys";

jest.mock("../../../screens/feedback/service/FeedbackNotificationService");

function montar() {
  const cliente = criarQueryClientDeTeste();
  const wrapper = ({ children }) => <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  return { cliente, ...renderHook(() => useQuantidadeFeedbacksPendentes(), { wrapper }) };
}

describe("useQuantidadeFeedbacksPendentes", () => {
  test("começa em 0 e passa a contar as pendências do aparelho", async () => {
    listarPendencias.mockResolvedValue([{ visitaId: "v1" }, { visitaId: "v2" }]);
    const { result, cliente } = montar();

    expect(result.current).toBe(0);
    await waitFor(() => expect(result.current).toBe(2));
    // No cache fica só o número, nunca os hospitais visitados.
    expect(cliente.getQueryData(queryKeys.visitas.feedbacksPendentes())).toBe(2);
  });
});
