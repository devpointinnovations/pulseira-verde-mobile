/**
 * Ícone do Pulseira Verde (logo B aprovado em 16/11/2026): pin branco com cruz verde sobre
 * o verde da marca (#0B6B4F). Desenhado em SVG e rasterizado com o Chromium do Playwright.
 *
 * Como regenerar (da raiz do repositório):
 *   node assets/icon-src/gerar_icone.js
 *
 * Escreve assets/{icon,favicon,splash-icon,android-icon-*}.png e os mipmaps e o logo da
 * abertura em android/app/src/main/res. NÃO rodar `expo prebuild`: o android/ é mantido à mão.
 */
/* global __dirname, Buffer */
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const VERDE = "#0B6B4F";
const RAIZ = path.resolve(__dirname, "..", "..");
const RES = path.join(RAIZ, "android/app/src/main/res");

// Caixa de 100 x 100. Pin com a ponta em (50; 83,5) e a cabeça centrada em (50; 42).
const PIN = "M50 83.5 C44 75 24.2 60 24.2 42 A25.8 25.8 0 1 1 75.8 42 C75.8 60 56 75 50 83.5 Z";
const CRUZ =
  '<rect x="44.8" y="28.8" width="10.4" height="26.4" rx="1.1"/>' +
  '<rect x="36.8" y="36.8" width="26.4" height="10.4" rx="1.1"/>';

function glifo({ pin, cruz, escala = 1, vazada = false }) {
  const t = `transform="translate(50 50) scale(${escala}) translate(-50 -50)"`;
  if (vazada) {
    return `<defs><mask id="m"><rect width="100" height="100" fill="white"/><g fill="black">${CRUZ}</g></mask></defs>
      <g ${t}><path d="${PIN}" fill="${pin}" mask="url(#m)"/></g>`;
  }
  return `<g ${t}><path d="${PIN}" fill="${pin}"/><g fill="${cruz}">${CRUZ}</g></g>`;
}

const VARIANTES = {
  // Ícone completo (legado e web): quadrado arredondado verde.
  completo: `<rect width="100" height="100" rx="22" fill="${VERDE}"/>${glifo({ pin: "#fff", cruz: VERDE, escala: 0.9 })}`,
  redondo: `<circle cx="50" cy="50" r="50" fill="${VERDE}"/>${glifo({ pin: "#fff", cruz: VERDE, escala: 0.78 })}`,
  // Camadas do ícone adaptativo: o glifo cabe na zona segura (~66% central).
  frente: glifo({ pin: "#fff", cruz: VERDE, escala: 0.6 }),
  fundo: `<rect width="100" height="100" fill="${VERDE}"/>`,
  mono: glifo({ pin: "#fff", vazada: true, escala: 0.6 }),
  // Abertura: símbolo verde com cruz branca sobre o fundo branco.
  abertura: glifo({ pin: VERDE, cruz: "#fff", escala: 0.42 }),
};

const SAIDAS = [
  ["completo", 1024, "assets/icon.png"],
  ["completo", 196, "assets/favicon.png"],
  ["frente", 1024, "assets/android-icon-foreground.png"],
  ["fundo", 1024, "assets/android-icon-background.png"],
  ["mono", 1024, "assets/android-icon-monochrome.png"],
  ["abertura", 1024, "assets/splash-icon.png"],
];
const DENSIDADES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [nome, fator] of Object.entries(DENSIDADES)) {
  SAIDAS.push(
    ["completo", 48 * fator, `${RES}/mipmap-${nome}/ic_launcher.webp`],
    ["redondo", 48 * fator, `${RES}/mipmap-${nome}/ic_launcher_round.webp`],
    ["frente", 108 * fator, `${RES}/mipmap-${nome}/ic_launcher_foreground.webp`],
    ["fundo", 108 * fator, `${RES}/mipmap-${nome}/ic_launcher_background.webp`],
    ["mono", 108 * fator, `${RES}/mipmap-${nome}/ic_launcher_monochrome.webp`],
    ["abertura", 288 * fator, `${RES}/drawable-${nome}/splashscreen_logo.png`]
  );
}

/** O screenshot só sai em PNG; os mipmaps do Android são .webp, convertidos por um canvas. */
async function paraWebp(pagina, png) {
  const dataUrl = await pagina.evaluate(async (base64) => {
    const imagem = new Image();
    imagem.src = `data:image/png;base64,${base64}`;
    await imagem.decode();
    const canvas = document.createElement("canvas");
    canvas.width = imagem.width;
    canvas.height = imagem.height;
    canvas.getContext("2d").drawImage(imagem, 0, 0);
    return canvas.toDataURL("image/webp", 1);
  }, png.toString("base64"));
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

// Sem catch de propósito: um erro aqui derruba o script com a pilha, que é o que se quer ver.
void (async () => {
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  for (const [variante, tamanho, destino] of SAIDAS) {
    await pagina.setViewportSize({ width: tamanho, height: tamanho });
    await pagina.setContent(
      `<html><body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 100 100">${VARIANTES[variante]}</svg></body></html>`
    );
    const png = await pagina.screenshot({ omitBackground: true, type: "png" });
    const arquivo = path.isAbsolute(destino) ? destino : path.join(RAIZ, destino);
    fs.writeFileSync(arquivo, arquivo.endsWith(".webp") ? await paraWebp(pagina, png) : png);
  }
  await navegador.close();
})();
