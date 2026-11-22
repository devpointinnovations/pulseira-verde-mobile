/**
 * Offline total (21/11/2026): o cache das consultas é gravado no aparelho e volta na abertura.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { criarQueryClient } from "../../core/query/queryClient";
import { queryKeys } from "../../core/query/queryKeys";
import { persistirCache, restaurarCache } from "../../core/query/cachePersistido";

const CHAVE = "@saude_monitor:cacheConsultas";

describe("cachePersistido", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("grava o que veio do servidor e o devolve num cache novo (app reaberto sem rede)", async () => {
    const cliente = criarQueryClient();
    const parar = persistirCache(cliente, 10);
    cliente.setQueryData(queryKeys.hospitais.detalhe("h1"), { id: "h1", nome: "HRAS" });
    cliente.setQueryData(queryKeys.conta.historico("u1"), { visitas: [{ id: "v1" }] });
    jest.advanceTimersByTime(10);
    parar();
    await Promise.resolve();

    const reaberto = criarQueryClient();
    await restaurarCache(reaberto);

    expect(reaberto.getQueryData(queryKeys.hospitais.detalhe("h1"))).toEqual({ id: "h1", nome: "HRAS" });
    expect(reaberto.getQueryData(queryKeys.conta.historico("u1"))).toEqual({ visitas: [{ id: "v1" }] });
  });

  it("não grava a visita ativa nem a cópia do catálogo, que têm armazenamento próprio", async () => {
    const cliente = criarQueryClient();
    const parar = persistirCache(cliente, 10);
    cliente.setQueryData(queryKeys.visitas.ativa("u1"), { visita: { id: "v1" } });
    cliente.setQueryData(queryKeys.hospitais.catalogoLocal(), [{ id: "h1" }]);
    cliente.setQueryData(queryKeys.hospitais.ranking({ ordem: "NOTA" }), { pages: [] });
    jest.advanceTimersByTime(10);
    parar();
    await Promise.resolve();

    const chaves = JSON.parse(await AsyncStorage.getItem(CHAVE)).queries.map((q) => q.queryKey);
    expect(chaves).toEqual([queryKeys.hospitais.ranking({ ordem: "NOTA" })]);
  });

  it("uma rajada de mudanças grava uma vez só", async () => {
    const setItem = jest.spyOn(AsyncStorage, "setItem");
    const cliente = criarQueryClient();
    const parar = persistirCache(cliente, 10);
    cliente.setQueryData(["a"], 1);
    cliente.setQueryData(["b"], 2);
    cliente.setQueryData(["c"], 3);
    jest.advanceTimersByTime(10);
    parar();

    expect(setItem.mock.calls.filter(([chave]) => chave === CHAVE)).toHaveLength(1);
    setItem.mockRestore();
  });

  it("cópia corrompida não impede o app de abrir", async () => {
    await AsyncStorage.setItem(CHAVE, "{não é json");
    const cliente = criarQueryClient();

    await expect(restaurarCache(cliente)).resolves.toBeUndefined();
    expect(cliente.getQueryCache().getAll()).toEqual([]);
  });
});
