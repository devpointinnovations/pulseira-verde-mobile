/**
 * Regra "avaliação suficiente" (RN-15): um hospital só mostra nota/tempo quando tem
 * pelo menos 5 avaliações. Extraída de CSHospitalCard.js e HospitalDetalheScreen.js
 * (08/09/2026, auditoria de código morto/lógica ambígua) — as duas telas
 * reimplementavam o critério de forma independente, com uma diferença sutil (o
 * detalhe checava `indicadoresDisponiveis`, o card não). Hoje os dois campos
 * concordam porque o backend deriva um do outro (`HospitalService.js`), mas isso era
 * um acoplamento implícito, não garantido pelo contrato — exatamente o tipo de
 * divergência que já gerou bug antes (PR #94/#95).
 *
 * @param {{ notaMedia?: number|null, nAvaliacoes?: number, indicadoresDisponiveis?: boolean }} indicadores
 */
export function avaliacaoSuficiente(indicadores) {
  return (
    indicadores?.indicadoresDisponiveis !== false &&
    indicadores?.notaMedia !== null &&
    indicadores?.notaMedia !== undefined &&
    indicadores?.nAvaliacoes >= 5
  );
}

const TENDENCIAS = ["SUBINDO", "ESTAVEL", "CAINDO"];

/**
 * Tendência simples da nota (E4-06): nota dos últimos 30 dias contra a dos 30 anteriores,
 * calculada no servidor. Devolve o sentido, a frase lida na tela (e pelo leitor de tela) e se
 * a tendência é preliminar (menos de 10 avaliações em algum dos períodos), ou `null` quando o
 * servidor não mandou tendência ou a nota não pode ser exibida (RN-15).
 *
 * @param {{ tendenciaNota?: string|null, variacaoNota?: number|null, tendenciaPreliminar?: boolean|null }} indicadores
 * @returns {{ sentido: "SUBINDO"|"ESTAVEL"|"CAINDO", frase: string, preliminar: boolean } | null}
 */
export function descreverTendencia(indicadores) {
  const sentido = indicadores?.tendenciaNota;
  if (!avaliacaoSuficiente(indicadores) || !TENDENCIAS.includes(sentido)) {
    return null;
  }
  const preliminar = indicadores.tendenciaPreliminar === true;
  if (sentido === "ESTAVEL") {
    return { sentido, frase: "Nota estável em relação aos 30 dias anteriores", preliminar };
  }
  // `Number(null)` daria 0: só aceita número de verdade.
  const variacao = indicadores.variacaoNota;
  if (typeof variacao !== "number" || !Number.isFinite(variacao)) {
    return null;
  }
  const verbo = sentido === "SUBINDO" ? "subiu" : "caiu";
  const valor = Math.abs(variacao).toFixed(1).replace(".", ",");
  return { sentido, frase: `Nota ${verbo} ${valor} em relação aos 30 dias anteriores`, preliminar };
}
