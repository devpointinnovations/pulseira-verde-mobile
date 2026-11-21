/**
 * Aviso de conexão acima da tab bar (offline total, 21/11/2026).
 */
import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, render, screen } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import CSAvisoConexao from "../../components/CSAvisoConexao";
import { enfileirar, limparFila } from "../../config/filaOffline";

describe("CSAvisoConexao", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
  });

  afterEach(() => {
    act(() => onlineManager.setOnline(true));
  });

  it("com rede e fila vazia não mostra nada", async () => {
    render(<CSAvisoConexao />);
    await act(async () => {});
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem rede avisa que mostra o que está guardado e conta os registros que chegam na fila", async () => {
    act(() => onlineManager.setOnline(false));
    render(<CSAvisoConexao />);
    expect(await screen.findByText("Sem internet. Mostrando o que está guardado no celular.")).toBeTruthy();

    await act(() => enfileirar({ chave: "feedback:v1", tipo: "requisicao", corpo: {} }));
    expect(screen.getByText(/1 registro aguardando envio/)).toBeTruthy();

    await act(() => enfileirar({ chave: "feedback:v2", tipo: "requisicao", corpo: {} }));
    expect(screen.getByText(/2 registros aguardando envio/)).toBeTruthy();
  });

  it("com a rede de volta mostra o envio e some quando a fila esvazia", async () => {
    await enfileirar({ chave: "checkin:h1:1", tipo: "checkin", corpo: {} });
    render(<CSAvisoConexao />);
    expect(await screen.findByText("Enviando: 1 registro aguardando envio.")).toBeTruthy();

    await act(() => limparFila());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
