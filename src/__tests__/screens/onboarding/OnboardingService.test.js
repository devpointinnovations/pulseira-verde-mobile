import AsyncStorage from "@react-native-async-storage/async-storage";
import { concluirOnboarding, onboardingConcluido } from "../../../screens/onboarding/service/OnboardingService";

describe("OnboardingService", () => {
  beforeEach(() => AsyncStorage.__reset());

  it("começa pendente e fica concluída depois de gravar", async () => {
    expect(await onboardingConcluido()).toBe(false);
    await concluirOnboarding();
    expect(await onboardingConcluido()).toBe(true);
  });

  it("falha ao ler ou gravar não prende o app na apresentação", async () => {
    const getItem = jest.spyOn(AsyncStorage, "getItem").mockRejectedValueOnce(new Error("disco"));
    expect(await onboardingConcluido()).toBe(true);
    getItem.mockRestore();

    const setItem = jest.spyOn(AsyncStorage, "setItem").mockRejectedValueOnce(new Error("disco"));
    await expect(concluirOnboarding()).resolves.toBeUndefined();
    setItem.mockRestore();
  });
});
