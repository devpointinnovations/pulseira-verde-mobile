/**
 * Check-in manual do detalhe do hospital ("Estou aqui agora"). As regras saíram da lista do
 * Início quando o card perdeu o botão de check-in (design aprovado, 23/11/2026): uma visita
 * por vez, o 409 de geofences empatadas (E2-04) e o check-in guardado na fila (OPS-05).
 */
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { useCheckinNoHospital } from "../../../screens/visitas/hooks/useCheckinNoHospital";
import { useCheckinManual } from "../../../screens/visitas/hooks/useMutacoesVisita";

jest.mock("../../../screens/visitas/hooks/useMutacoesVisita", () => ({ useCheckinManual: jest.fn() }));

const HOSPITAL_A = { id: "hA", nome: "Hospital A" };

describe("useCheckinNoHospital", () => {
  let registrar;
  let aoEntrar;
  let definirLocal;

  function montar(visitaAtiva = null) {
    return renderHook(({ visita }) => useCheckinNoHospital({ visitaAtiva: visita, definirLocal, aoEntrar }), {
      initialProps: { visita: visitaAtiva },
    });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    registrar = jest.fn();
    aoEntrar = jest.fn();
    definirLocal = jest.fn();
    useCheckinManual.mockReturnValue({ mutateAsync: registrar });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("check-in bem-sucedido registra a visita e entra no hospital", async () => {
    registrar.mockResolvedValue({ id: "v1", hospitalId: "hA" });
    const { result } = montar();

    await act(() => result.current.checkin(HOSPITAL_A));

    expect(registrar).toHaveBeenCalledWith({ hospitalId: "hA" });
    expect(aoEntrar).toHaveBeenCalledWith(HOSPITAL_A);
    expect(result.current.enviandoId).toBeNull();
  });

  test("marca o hospital em envio enquanto o servidor não responde", async () => {
    let responder;
    registrar.mockReturnValue(new Promise((resolve) => (responder = resolve)));
    const { result } = montar();

    act(() => {
      result.current.checkin(HOSPITAL_A);
    });
    expect(result.current.enviandoId).toBe("hA");

    await act(async () => responder({ id: "v1" }));
    expect(result.current.enviandoId).toBeNull();
  });

  test("com a visita já aberta neste hospital, só entra de novo, sem outro check-in", async () => {
    const { result } = montar({ id: "v1", hospitalId: "hA" });

    await act(() => result.current.checkin(HOSPITAL_A));

    expect(aoEntrar).toHaveBeenCalledWith(HOSPITAL_A);
    expect(registrar).not.toHaveBeenCalled();
  });

  test("com visita aberta em outro hospital, avisa e não faz o check-in", async () => {
    const { result } = montar({ id: "v1", hospitalId: "hB" });

    await act(() => result.current.checkin(HOSPITAL_A));

    expect(Alert.alert).toHaveBeenCalledWith("Check-in ativo", expect.stringContaining("outro hospital"));
    expect(registrar).not.toHaveBeenCalled();
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  test("conflito de geofence (409) deixa escolher o hospital e refaz o check-in nele", async () => {
    const conflito = Object.assign(new Error("Encontramos mais de um hospital aqui."), {
      status: 409,
      data: {
        message: "Encontramos mais de um hospital aqui.",
        candidatos: [
          { hospitalId: "hA", nome: "Hospital A" },
          { hospitalId: "hB", nome: "Hospital B" },
        ],
      },
    });
    registrar.mockRejectedValueOnce(conflito).mockResolvedValueOnce({ id: "v1", hospitalId: "hB" });
    const { result } = montar();

    await act(() => result.current.checkin(HOSPITAL_A));

    const [titulo, mensagem, botoes] = Alert.alert.mock.calls[0];
    expect(titulo).toBe("Qual hospital é este?");
    expect(mensagem).toBe("Encontramos mais de um hospital aqui.");
    expect(botoes.map((b) => b.text)).toEqual(["Hospital A", "Hospital B", "Cancelar"]);

    await act(async () => botoes[1].onPress());

    await waitFor(() => expect(registrar).toHaveBeenLastCalledWith({ hospitalId: "hB" }));
    expect(aoEntrar).toHaveBeenCalledWith({ id: "hB", nome: "Hospital B" });
  });

  test("a escolha do 409 respeita a visita que chegou depois do alerta", async () => {
    const conflito = Object.assign(new Error("Conflito"), {
      status: 409,
      data: { candidatos: [{ hospitalId: "hB", nome: "Hospital B" }] },
    });
    registrar.mockRejectedValueOnce(conflito);
    const { result, rerender } = montar();

    await act(() => result.current.checkin(HOSPITAL_A));
    const [, mensagem, botoes] = Alert.alert.mock.calls[0];
    expect(mensagem).toBe("Encontramos mais de um hospital nesta localização.");

    // A visita de outro hospital chega com o alerta ainda aberto.
    rerender({ visita: { id: "v9", hospitalId: "hC" } });
    await act(async () => botoes[0].onPress());

    expect(registrar).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenLastCalledWith("Check-in ativo", expect.any(String));
  });

  test("sem conexão, o check-in guardado na fila já vale na tela e não soa como falha", async () => {
    registrar.mockRejectedValue(
      Object.assign(new Error("O registro foi guardado e será enviado assim que a conexão voltar."), { enfileirado: true })
    );
    const { result } = montar();

    await act(() => result.current.checkin(HOSPITAL_A));

    expect(definirLocal).toHaveBeenCalledWith({ id: null, hospitalId: "hA", origem: "MANUAL" });
    expect(Alert.alert).toHaveBeenCalledWith("Sem conexão", "O registro foi guardado e será enviado assim que a conexão voltar.");
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  test("erro comum mostra o alerta do check-in e não entra", async () => {
    registrar.mockRejectedValueOnce(new Error("Backend indisponível.")).mockRejectedValueOnce({});
    const { result } = montar();

    await act(() => result.current.checkin(HOSPITAL_A));
    expect(Alert.alert).toHaveBeenLastCalledWith("Check-in", "Backend indisponível.");

    await act(() => result.current.checkin(HOSPITAL_A));
    expect(Alert.alert).toHaveBeenLastCalledWith("Check-in", "Não foi possível fazer o check-in.");
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});
