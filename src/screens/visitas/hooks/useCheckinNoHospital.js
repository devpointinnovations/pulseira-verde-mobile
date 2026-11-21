import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { avisarSemConexao } from "../../../utils/alertas";
import { useCheckinManual } from "./useMutacoesVisita";

/**
 * Check-in manual com as regras que a lista do Início já seguia, para o detalhe do hospital
 * ("Estou aqui agora") usar as mesmas: uma visita por vez, o 409 de geofences empatadas
 * (E2-04) deixa escolher o hospital e, sem conexão, o check-in guardado na fila (OPS-05)
 * já vale na tela.
 *
 * `aoEntrar(hospital)` roda quando a visita deste hospital está aberta (nova ou a que já
 * existia). Devolve `checkin(hospital)` e o id do hospital em envio.
 */
export function useCheckinNoHospital({ visitaAtiva, definirLocal, aoEntrar }) {
  const { mutateAsync: registrarCheckin } = useCheckinManual();
  const [enviandoId, setEnviandoId] = useState(null);

  // ARQ-05 / code-review de 03/09/2026: o 409 chama `checkin` de novo a partir do alerta,
  // com o closure antigo. Se a visita ativa chegar depois do alerta, o toque no candidato
  // furaria o guard de "uma visita por vez" sem o ref, que carrega o valor corrente.
  const visitaAtivaRef = useRef(visitaAtiva);
  useEffect(() => {
    visitaAtivaRef.current = visitaAtiva;
  }, [visitaAtiva]);

  const checkin = useCallback(
    async function fazer(hospital) {
      const ativa = visitaAtivaRef.current;
      if (ativa) {
        if (ativa.hospitalId === hospital.id) {
          aoEntrar(hospital);
        } else {
          Alert.alert(
            "Check-in ativo",
            "Você já tem uma visita em andamento em outro hospital. Finalize-a antes de começar outra."
          );
        }
        return;
      }

      setEnviandoId(hospital.id);
      try {
        // A mutação grava a visita confirmada na query compartilhada: o observador global
        // (heartbeat e geofencing) segue a visita nova sem depender do foco de uma tela.
        await registrarCheckin({ hospitalId: hospital.id });
        setEnviandoId(null);
        aoEntrar(hospital);
      } catch (e) {
        setEnviandoId(null);
        if (e.status === 409 && e.data?.candidatos?.length) {
          Alert.alert(
            "Qual hospital é este?",
            e.data.message || "Encontramos mais de um hospital nesta localização.",
            [
              ...e.data.candidatos.map((candidato) => ({
                text: candidato.nome,
                onPress: () => fazer({ id: candidato.hospitalId, nome: candidato.nome }),
              })),
              { text: "Cancelar", style: "cancel" },
            ]
          );
          return;
        }
        if (e.enfileirado) {
          // Guardado para sincronizar depois: não é falha. A visita vale na tela já, o que
          // arma o guard acima antes da fila sincronizar; o `id: null` é trocado pelo real
          // na próxima resposta do servidor. Janela residual em `preservarSeSemConexao`.
          definirLocal({ id: null, hospitalId: hospital.id, origem: "MANUAL" });
          avisarSemConexao(e.message);
          return;
        }
        Alert.alert("Check-in", e.message || "Não foi possível fazer o check-in.");
      }
    },
    [registrarCheckin, definirLocal, aoEntrar]
  );

  return { checkin, enviandoId };
}
