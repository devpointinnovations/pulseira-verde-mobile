import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Bell, ChevronRight, Hospital, LogIn, LogOut, MapPin, ShieldCheck, Trash2, UserPlus } from "lucide-react-native";
import PerfilService from "../service/PerfilService";
import LoginService from "../../auth/service/LoginService";
import { useSessao } from "../../../core/stores/sessaoStore";
import { CSLoadingList } from "../../../components/CSLoading";
import CSEmptyState from "../../../components/CSEmptyState";
import { colors } from "../../../theme";
import styles from "./css/PerfilStyle";

/**
 * Tela Perfil → Dados e Privacidade (Épico 05 — E5-01, E5-02, E5-04).
 *
 * - E5-01: exibe e permite revogar a permissão de localização.
 * - E5-05: a revogação leva às configurações do sistema (`Linking.openSettings`), o
 *   app reconhece a mudança ao voltar do SO (`AppState`) e audita a decisão no
 *   backend (`PUT /api/v1/contas/consentimentos`, art. 8º §5º da LGPD).
 * - E5-02: link à Política de Privacidade (2 toques a partir do app).
 * - E6-05: acesso à tela dedicada de opt-in de notificações.
 * - E5-04: quando não há conta, orienta Cadastro/Login (conta é opcional).
 * - F0-05: botão de exclusão de conta (dados pessoais), com anonimização das
 *   estatísticas.
 *
 * E6-03/E6-04: acessibilidade (role/labels) e estados de loading/erro com retry.
 */
export default function PerfilScreen({ navigation }) {
  // Sessão global: o Perfil reage na hora ao login, ao logout e ao encerramento da
  // sessão pelo interceptor 401, em vez de só descobrir no próximo foco.
  const usuario = useSessao((estado) => estado.usuario);
  // Até o app ler o usuário gravado no aparelho, o Perfil fica em carregamento em vez
  // de piscar o convite ao login para quem já está logado.
  const sessaoHidratada = useSessao((estado) => estado.hidratada);
  const [permissao, setPermissao] = useState("undetermined");
  const [carregando, setCarregando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroInicial, setErroInicial] = useState(null);

  const carregar = useCallback(async () => {
    setCarregandoInicial(true);
    setErroInicial(null);
    try {
      setPermissao(await PerfilService.permissaoLocalizacao());
    } catch (e) {
      setErroInicial(e?.message || "Não foi possível carregar seu perfil.");
    } finally {
      setCarregandoInicial(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // `carregar` mostra a falha em `erroInicial`: disparo intencional.
      void carregar();
    }, [carregar])
  );

  const emCarregamento = Boolean(carregandoInicial) || !sessaoHidratada;
  const permissaoConcedida = permissao === "granted";

  // Espelha o estado da permissão para o listener do AppState, que é registrado uma
  // única vez e não pode depender do valor capturado no render.
  const permissaoRef = useRef(permissao);
  permissaoRef.current = permissao;

  /**
   * E5-05: relê a permissão do sistema e, quando ela mudou (tipicamente porque o
   * usuário alterou nas configurações do SO), registra a nova decisão no backend.
   * Sem sessão ativa o serviço devolve `null` — a conta é opcional (E5-04).
   */
  const sincronizarPermissao = useCallback(async () => {
    try {
      const status = await PerfilService.permissaoLocalizacao();
      if (status === permissaoRef.current) {
        return;
      }
      setPermissao(status);
      await PerfilService.atualizarConsentimento({ localizacao: status === "granted" });
    } catch {
      // Falha de rede não pode travar a tela: a permissão do SO já vale no dispositivo
      // e a próxima sincronização (retorno ao app) tenta de novo.
    }
  }, []);

  // Ao voltar do app de configurações do sistema, reflete a decisão sem exigir
  // que o usuário reabra a tela.
  useEffect(() => {
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        // `sincronizarPermissao` tenta de novo na próxima volta ao app: disparo intencional.
        void sincronizarPermissao();
      }
    });
    return () => inscricao?.remove?.();
  }, [sincronizarPermissao]);

  // Rotas internas do PerfilStack (Login, Cadastro, Privacidade). Navega no próprio
  // stack — o antigo `getParent()` (Tab) não resolve essas rotas e "engolia" o toque.
  const irPara = (rota) => {
    navigation?.navigate?.(rota);
  };

  const solicitarPermissao = async () => {
    setCarregando(true);
    try {
      const status = await PerfilService.solicitarPermissaoLocalizacao();
      setPermissao(status);
      // E5-05: a concessão também é auditada, não só a revogação.
      await PerfilService.atualizarConsentimento({ localizacao: status === "granted" });
      if (status === "granted") {
        Alert.alert("Permissão concedida", "O aplicativo poderá usar sua localização para detectar visitas.");
      } else {
        Alert.alert("Permissão negada", "Você pode continuar usando o app; apenas o monitoramento automático ficará desativado.");
      }
    } finally {
      setCarregando(false);
    }
  };

  const revogarPermissao = () => {
    Alert.alert(
      "Revogar permissão de localização",
      "Ao revogar, o monitoramento automático de visitas para. Você continua usando o restante do aplicativo normalmente."
        + "\n\nVamos abrir as configurações do sistema para você desativar a permissão de localização.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "destructive",
          onPress: async () => {
            try {
              // A revogação é registrada primeiro: mesmo que o usuário desista nas
              // configurações do SO, a decisão manifestada no app já retira a base
              // legal do tratamento (art. 8º §5º) — e o retorno ao app resincroniza.
              await PerfilService.atualizarConsentimento({ localizacao: false });

              // Expo/RN não desliga a permissão do sistema programaticamente: levamos
              // o usuário direto à tela de configurações do app (E5-05).
              await Linking.openSettings();
            } catch {
              Alert.alert(
                "Revogar no sistema",
                "Não foi possível abrir as configurações. Desative a permissão de localização nas configurações de privacidade do dispositivo e volte a esta tela."
              );
            }
          },
        },
      ]
    );
  };

  const excluirConta = () => {
    Alert.alert(
      "Excluir conta e dados pessoais",
      "Seus dados pessoais (nome, e-mail, telefone) serão removidos, e suas visitas/feedbacks serão anonimizados. Esta ação é irreversível.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setCarregando(true);
            try {
              await LoginService.excluirConta();
              Alert.alert("Conta excluída", "Seus dados pessoais foram removidos com sucesso.");
            } catch (error) {
              Alert.alert("Falha ao excluir conta", error.message);
            } finally {
              setCarregando(false);
            }
          },
        },
      ]
    );
  };

  const deslogar = async () => {
    await PerfilService.deslogar();
  };

  const nome = usuario?.nome || usuario?.fullName || "Usuário";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.titulo} accessibilityRole="header">
        Perfil
      </Text>

      <ScrollView contentContainerStyle={styles.content}>
        {emCarregamento ? <CSLoadingList count={2} /> : null}

        {!emCarregamento && Boolean(erroInicial) && (
          <CSEmptyState
            icon={ShieldCheck}
            title="Não foi possível carregar"
            message={erroInicial}
            actionLabel="Tentar novamente"
            onAction={carregar}
          />
        )}

        {!emCarregamento && !erroInicial && (
          <>
            {usuario ? (
              <View style={styles.grupo}>
                <View style={styles.conta}>
                  <View style={styles.avatar} accessible={false} accessibilityElementsHidden>
                    <Text style={styles.avatarText}>{nome.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.linhaTextos}>
                    <Text style={styles.userName}>{nome}</Text>
                    <Text style={styles.userEmail}>{usuario.email || ""}</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.grupo}>
                <View style={styles.semAcesso}>
                  <Text style={styles.semAcessoTitle}>Conta opcional</Text>
                  <Text style={styles.semAcessoText}>
                    Você pode usar o app sem se cadastrar. Entre para ver suas visitas em
                    qualquer aparelho.
                  </Text>
                  <View style={styles.semAcessoActions}>
                    <TouchableOpacity
                      style={[styles.button, styles.actionButton]}
                      onPress={() => irPara("Login")}
                      accessibilityRole="button"
                      accessibilityLabel="Entrar"
                    >
                      <LogIn size={18} color={colors.onPrimary} />
                      <Text style={styles.buttonText}> Entrar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.buttonSecondary, styles.actionButton]}
                      onPress={() => irPara("Cadastro")}
                      accessibilityRole="button"
                      accessibilityLabel="Criar conta"
                    >
                      <UserPlus size={18} color={colors.onSurface} />
                      <Text style={styles.buttonTextSecondary}> Criar conta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}

            <Text style={styles.secao}>O app</Text>
            <View style={styles.grupo}>
              <LinhaMenu
                icone={Hospital}
                titulo="Sugerir um hospital"
                subtitulo="Não achou o seu? Avise a gente"
                onPress={() => navigation?.navigate?.("Inicio", { screen: "SugerirHospital" })}
              />
            </View>

            <Text style={styles.secao}>Suas preferências</Text>
            <View style={styles.grupo}>
              <LinhaMenu
                icone={MapPin}
                titulo="Localização"
                subtitulo={permissaoConcedida ? "Ativa · percebe sua chegada" : "Desativada · toque para permitir"}
                onPress={permissaoConcedida ? revogarPermissao : solicitarPermissao}
                desabilitado={carregando}
                accessibilityLabel={
                  permissaoConcedida ? "Revogar permissão de localização" : "Permitir localização"
                }
              />
              <LinhaMenu
                icone={Bell}
                titulo="Avisos"
                subtitulo="Aviso para avaliar a visita"
                onPress={() => irPara("Notificacoes")}
                accessibilityLabel="Gerenciar notificações"
              />
              <LinhaMenu
                icone={ShieldCheck}
                titulo="Dados e privacidade"
                subtitulo="Política de Privacidade e Termos de Uso"
                onPress={() => irPara("Privacidade")}
                accessibilityLabel="Ler Política de Privacidade e Termos de Uso"
                ultima
              />
            </View>
            <Text style={styles.footerNote}>
              A localização serve só para perceber suas visitas a hospitais. Sem ela, a consulta
              e o restante do app continuam funcionando.
            </Text>

            {usuario ? (
              <View style={styles.grupo}>
                <LinhaMenu icone={LogOut} titulo="Sair da conta" onPress={deslogar} />
                <LinhaMenu
                  icone={Trash2}
                  titulo="Excluir conta e dados pessoais"
                  onPress={excluirConta}
                  desabilitado={carregando}
                  perigo
                  ultima
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Linha de menu do Perfil (layout novo): ícone em bloco verde, título, subtítulo e seta. */
function LinhaMenu({ icone: Icone, titulo, subtitulo, onPress, accessibilityLabel, desabilitado, perigo, ultima }) {
  const cor = perigo ? colors.error : colors.primary;
  return (
    <TouchableOpacity
      style={[styles.linha, ultima && styles.linhaUltima]}
      onPress={onPress}
      disabled={desabilitado}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || titulo}
      accessibilityState={{ disabled: Boolean(desabilitado) }}
    >
      <View style={[styles.linhaIcone, perigo && styles.linhaIconePerigo]}>
        <Icone size={22} color={cor} />
      </View>
      <View style={styles.linhaTextos}>
        <Text style={[styles.linhaTitulo, perigo && { color: colors.error }]}>{titulo}</Text>
        {subtitulo ? <Text style={styles.linhaSubtitulo}>{subtitulo}</Text> : null}
      </View>
      <ChevronRight size={20} color={colors.outline} />
    </TouchableOpacity>
  );
}
