import React from "react";
import { render } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";

// No Jest não há janela nativa: medidas fixas para as telas que leem as margens seguras.
const MEDIDAS_DA_TELA = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 24, left: 0, right: 0, bottom: 0 } };

/**
 * QueryClient isolado por teste: sem retry (o `apiClient` já repete) e sem coleta de
 * lixo durante o teste, para que nada vaze de um caso para o outro.
 */
export function criarQueryClientDeTeste() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** `render` com os providers do app que as telas migradas precisam. */
export function renderComProviders(ui, { queryClient = criarQueryClientDeTeste(), ...opcoes } = {}) {
  const Wrapper = ({ children }) => (
    <SafeAreaProvider initialMetrics={MEDIDAS_DA_TELA}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...opcoes }), queryClient };
}
