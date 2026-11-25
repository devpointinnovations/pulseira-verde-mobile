import React from "react";
import { Alert } from "react-native";
import CSOptionSheet from "../../../components/CSOptionSheet";
import { avisarSemConexao } from "../../../utils/alertas";
import { TIPO_TROCA, escolherUnidade } from "../service/EscolhaUnidadeService";

/**
 * Seletor aberto pelo toque na notificação de unidades sobrepostas (E2-04/RN-05): escolher a
 * unidade de um empate (opção A) ou trocar a da visita registrada (opção B). `escolha` é o dado
 * da notificação (`EscolhaUnidadeService`); `null` mantém o seletor fechado.
 */
export default function EscolhaUnidadeSheet({ escolha, onClose }) {
  const escolher = async (hospitalId) => {
    onClose();
    try {
      await escolherUnidade(escolha, hospitalId);
    } catch (erro) {
      if (erro?.enfileirado) {
        // Guardado para enviar quando a conexão voltar: não é falha (OPS-05).
        avisarSemConexao(erro.message);
        return;
      }
      Alert.alert("Escolher unidade", erro?.message || "Não foi possível registrar a unidade.");
    }
  };

  return (
    <CSOptionSheet
      visible={!!escolha}
      title={escolha?.tipo === TIPO_TROCA ? "Trocar a unidade da visita" : "Em qual unidade você está?"}
      options={(escolha?.opcoes || []).map(({ hospitalId, nome }) => ({
        key: hospitalId,
        label: nome,
        onPress: () => escolher(hospitalId),
      }))}
      onClose={onClose}
    />
  );
}
