import { fontes } from "./tokens";

// Só o navegador inclui estes arquivos no bundle; o Android usa os de res/font.
const PESOS = {
  400: require("../../assets/fonts/Inter-400Regular.ttf"),
  500: require("../../assets/fonts/Inter-500Medium.ttf"),
  600: require("../../assets/fonts/Inter-600SemiBold.ttf"),
  700: require("../../assets/fonts/Inter-700Bold.ttf"),
  800: require("../../assets/fonts/Inter-800ExtraBold.ttf"),
};

function urlDoArquivo(modulo) {
  return typeof modulo === "string" ? modulo : modulo?.uri ?? modulo?.default ?? "";
}

/** Declara a Inter com os cinco pesos, para o `fontWeight` escolher o arquivo certo. */
export function carregarFontes() {
  if (typeof document === "undefined" || document.getElementById("fontes-inter")) {
    return;
  }
  const estilo = document.createElement("style");
  estilo.id = "fontes-inter";
  estilo.textContent = Object.entries(PESOS)
    .map(
      ([peso, modulo]) =>
        `@font-face{font-family:"${fontes.texto}";font-weight:${peso};font-display:swap;src:url("${urlDoArquivo(modulo)}") format("truetype");}`
    )
    .join("\n");
  document.head.appendChild(estilo);
}
