/**
 * Alturas da folha "Perto de você" no Início: recolhida (só a alça e o título), no meio
 * (padrão) e expandida (lista, até 60% da tela). Funções puras: o gesto fica no componente.
 */
export const PARADAS = ["recolhida", "meio", "expandida"];

/**
 * Fração da altura útil da tela que a folha ocupa em cada parada. O teto de 60% (PO, 24/11)
 * deixa sempre a barra de busca e parte do mapa à vista.
 */
export const FRACAO_DA_PARADA = { recolhida: 0.2, meio: 0.4, expandida: 0.6 };

/** Quanto do impulso do dedo (px/ms) conta para decidir a parada: projeta o movimento adiante. */
const PROJECAO_DO_IMPULSO_MS = 150;

export function alturaDaParada(parada, alturaUtil) {
  return Math.round(alturaUtil * FRACAO_DA_PARADA[parada]);
}

/** Parada seguinte do toque na alça: recolhida, meio, expandida e de volta à recolhida. */
export function proximaParada(parada) {
  return PARADAS[(PARADAS.indexOf(parada) + 1) % PARADAS.length];
}

/** Um degrau acima (`+1`) ou abaixo (`-1`), parando nas pontas. Serve à acessibilidade. */
export function degrauDaParada(parada, passo) {
  const indice = PARADAS.indexOf(parada) + passo;
  return PARADAS[Math.min(PARADAS.length - 1, Math.max(0, indice))];
}

/**
 * Parada onde a folha assenta ao soltar o dedo: a mais próxima da altura em que o
 * movimento terminaria. `velocidadeY` é a do gesto (negativa = subindo).
 */
export function paradaAoSoltar(alturaAtual, velocidadeY, alturaUtil) {
  const alvo = alturaAtual - velocidadeY * PROJECAO_DO_IMPULSO_MS;
  return PARADAS.reduce((melhor, parada) =>
    Math.abs(alturaDaParada(parada, alturaUtil) - alvo) < Math.abs(alturaDaParada(melhor, alturaUtil) - alvo)
      ? parada
      : melhor,
    PARADAS[0]
  );
}
