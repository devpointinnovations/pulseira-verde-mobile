import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE = "@saude_monitor:onboardingConcluido";

/**
 * Apresentação de 3 telas do novo layout: aparece uma vez, até a pessoa terminar ou pular.
 * Leitura que falha conta como concluída: o app não pode ficar preso na apresentação.
 */
export async function onboardingConcluido() {
  try {
    return (await AsyncStorage.getItem(CHAVE)) !== null;
  } catch {
    return true;
  }
}

export async function concluirOnboarding() {
  try {
    await AsyncStorage.setItem(CHAVE, new Date().toISOString());
  } catch {
    // Sem gravar, a apresentação volta na próxima abertura; nada se perde.
  }
}
