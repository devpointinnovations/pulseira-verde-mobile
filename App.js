import React, { useCallback, useEffect, useRef } from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {NavigationContainer} from "@react-navigation/native";
import {SafeAreaProvider, useSafeAreaInsets} from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import * as Network from "expo-network";
import {AppState, StyleSheet, View} from "react-native";
import {ClipboardList, MapPin, Trophy, User as UserIcon} from "lucide-react-native";
import LoginScreen from "./src/screens/auth/view/LoginScreen.js";
import EsqueciSenhaScreen from "./src/screens/auth/view/EsqueciSenhaScreen.js";
import ConfirmarEmailScreen from "./src/screens/auth/view/ConfirmarEmailScreen.js";
import UserScreen from "./src/screens/user/view/UserScreen.js";
import GeoLocalizacaoScreen from "./src/screens/geolocalizacao/view/GeoLocalizacaoScreen.js";
import HospitaisScreen from "./src/screens/hospitais/view/HospitaisScreen.js";
import HospitalDetalheScreen from "./src/screens/hospitais/view/HospitalDetalheScreen.js";
import RankingScreen from "./src/screens/hospitais/view/RankingScreen.js";
import SugerirHospitalScreen from "./src/screens/hospitais/view/SugerirHospitalScreen.js";
import VisitaEmAndamentoScreen from "./src/screens/visitas/view/VisitaEmAndamentoScreen.js";
import FeedbackFormScreen from "./src/screens/feedback/view/FeedbackFormScreen.js";
import PerfilScreen from "./src/screens/perfil/view/PerfilScreen.js";
import HistoricoScreen from "./src/screens/perfil/view/HistoricoScreen.js";
import PrivacidadeScreen from "./src/screens/perfil/view/PrivacidadeScreen.js";
import NotificacoesScreen from "./src/screens/perfil/view/NotificacoesScreen.js";
import {colors} from "./src/theme";
import { agendarLembrete, pendenciaDaVisita } from "./src/screens/feedback/service/FeedbackNotificationService";
import { sincronizar } from "./src/services/SincronizacaoOffline";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./src/core/query/queryClient";
import { configurarQueryNoApp } from "./src/core/query/setupQueryClient";
import { hidratarSessao } from "./src/core/stores/sessaoStore";
import VisitaAtivaSync from "./src/screens/visitas/hooks/VisitaAtivaSync";
import AtualizacaoObrigatoria from "./src/screens/atualizacao/AtualizacaoObrigatoria";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Abas do novo layout (Início, Ranking, Visitas, Perfil). Cada aba tem a sua pilha, para
// que voltar do detalhe do hospital pouse na aba de onde o usuário veio (F-07, PO 10/09).
function InicioStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HospitaisLista" component={HospitaisScreen} />
            <Stack.Screen name="MapaTela" component={GeoLocalizacaoScreen} />
            <Stack.Screen name="HospitalDetalhe" component={HospitalDetalheScreen} />
            <Stack.Screen name="SugerirHospital" component={SugerirHospitalScreen} />
            <Stack.Screen name="VisitaEmAndamento" component={VisitaEmAndamentoScreen} />
        </Stack.Navigator>
    );
}

function RankingStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="RankingTela" component={RankingScreen} />
            <Stack.Screen name="HospitalDetalhe" component={HospitalDetalheScreen} />
        </Stack.Navigator>
    );
}

function VisitasStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Historico" component={HistoricoScreen} />
        </Stack.Navigator>
    );
}

// Stack da aba Perfil (Épico 05 — conta, consentimento, privacidade; F0-05).
function PerfilStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Perfil" component={PerfilScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="EsqueciSenha" component={EsqueciSenhaScreen} />
            <Stack.Screen name="ConfirmarEmail" component={ConfirmarEmailScreen} />
            <Stack.Screen name="Cadastro" component={UserScreen} />
            <Stack.Screen name="Privacidade" component={PrivacidadeScreen} />
            <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
        </Stack.Navigator>
    );
}

// Stack do Épico 03 — Feedback Pós-Saída (F-05). Aberta via notificação local
// pós-saída (E3-01) ou direto do app; sem aba (acesso por fluxo/notificação).
function FeedbackStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="FeedbackForm" component={FeedbackFormScreen} />
        </Stack.Navigator>
    );
}

// Ícone da aba dentro da pílula: verde-claro quando a aba está ativa (novo layout).
function iconeDaAba(Icone) {
    return function IconeDaAba({ focused, color, size }) {
        return (
            <View style={[estiloAbas.pilula, focused && estiloAbas.pilulaAtiva]} testID={focused ? "aba-ativa" : undefined}>
                <Icone color={color} size={size} />
            </View>
        );
    };
}

const IconeInicio = iconeDaAba(MapPin);
const IconeRanking = iconeDaAba(Trophy);
const IconeVisitas = iconeDaAba(ClipboardList);
const IconePerfil = iconeDaAba(UserIcon);

const estiloAbas = StyleSheet.create({
    pilula: { width: 64, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    pilulaAtiva: { backgroundColor: colors.primaryContainer },
});

function voltarParaRaiz(navigation, aba, raiz) {
    const state = navigation.getState();
    const rota = state?.routes?.find((r) => r.name === aba);
    const interna = rota?.state?.routes?.[rota.state.index ?? 0]?.name;
    if (interna && interna !== raiz) {
        navigation.navigate(aba, { screen: raiz });
    }
}

// Navegação por Bottom Tabs (E6-01), com as 4 abas do novo layout: Início, Ranking,
// Visitas e Perfil. A aba ativa ganha a pílula verde do design.
function Tabs() {
    // Barra de sistema (Android, botões na tela — não gestos): o `BottomTabBar` da lib
    // soma `insets.bottom` sozinho à altura E ao paddingBottom padrão, mas SÓ quando a
    // tela não define os dois no `tabBarStyle` — um `tabBarStyle` com valores fixos entra
    // DEPOIS no array de estilos e sobrescreve os dois, jogando fora o inset. Sem essa
    // soma, o conteúdo da barra ficava atrás dos botões do sistema em aparelhos com barra
    // de navegação clássica (relatado pelo PO, com captura de tela do físico — a barra
    // de gestos, sem essa barra, não expõe o bug porque o inset é ~0).
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.onPrimaryContainer,
                tabBarInactiveTintColor: colors.onSurfaceVariant,
                tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
                tabBarStyle: {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderTopColor: colors.outlineVariant,
                    height: 72 + insets.bottom,
                    paddingBottom: 8 + insets.bottom,
                    paddingTop: 8,
                },
            }}
        >
            <Tab.Screen
                name="Inicio"
                component={InicioStack}
                options={{
                    tabBarLabel: "Início",
                    tabBarAccessibilityLabel: "Início — hospitais perto de você",
                    tabBarIcon: IconeInicio,
                }}
                listeners={({ navigation }) => ({
                    // Item 07 (revisão de UX): ao reabrir a aba, volta para a raiz — nunca
                    // para o detalhe que estava no topo da pilha quando o usuário trocou de aba.
                    tabPress: () => voltarParaRaiz(navigation, "Inicio", "HospitaisLista"),
                })}
            />
            <Tab.Screen
                name="Ranking"
                component={RankingStack}
                options={{
                    tabBarLabel: "Ranking",
                    tabBarAccessibilityLabel: "Ranking — melhores hospitais",
                    tabBarIcon: IconeRanking,
                }}
                listeners={({ navigation }) => ({
                    tabPress: () => voltarParaRaiz(navigation, "Ranking", "RankingTela"),
                })}
            />
            <Tab.Screen
                name="Visitas"
                component={VisitasStack}
                options={{
                    tabBarLabel: "Visitas",
                    tabBarAccessibilityLabel: "Visitas — histórico e avaliações pendentes",
                    tabBarIcon: IconeVisitas,
                }}
            />
            <Tab.Screen
                name="Perfil"
                component={PerfilStack}
                options={{
                    tabBarLabel: "Perfil",
                    tabBarAccessibilityLabel: "Perfil — conta e privacidade",
                    tabBarIcon: IconePerfil,
                }}
            />
        </Tab.Navigator>
    );
}

export default function App() {
    const navigationRef = useRef(null);
    // Cold start (bug: "Fechar tudo" → notificação → app abria na tela inicial): quando o
    // toque na notificação INICIA o app do zero, a resposta chega antes de a árvore de
    // navegação montar. Estes refs seguram o destino até o NavigationContainer ficar pronto.
    const navegacaoPronta = useRef(false);
    const feedbackPendente = useRef(null);

    const abrirFeedback = useCallback((params) => {
        if (navegacaoPronta.current && navigationRef.current) {
            navigationRef.current.navigate("Feedback", { screen: "FeedbackForm", params });
        } else {
            // Ainda montando (cold start): guarda para o onReady do container despachar.
            feedbackPendente.current = params;
        }
    }, []);

    const tratarResposta = useCallback(
        async (resposta) => {
            // E3-01/E3-03: abre o formulário de feedback quando o usuário toca na
            // notificação local de feedback pós-saída.
            const data = resposta?.notification?.request?.content?.data;
            if (!data?.abrirFeedback || !data?.visitaId) {
                return;
            }
            // RN-09: cada visita encerrada tem a sua pendência, e a notificação tocada só
            // abre o formulário se a pendência DESTA visita ainda estiver na janela de
            // 24h — nunca com dados de outra visita/hospital (achado do code-review de
            // 08/09/2026, quando havia uma única pendência guardada).
            const pendencia = await pendenciaDaVisita(data.visitaId);
            if (!pendencia) {
                return;
            }
            // Navega PRIMEIRO — o toque é a ação crítica. O lembrete (RN-09/E3-03) é
            // efeito colateral: se `agendarLembrete` falhar ou travar, não pode impedir
            // a abertura do formulário. Antes ele era aguardado ANTES do navigate, então
            // uma falha ali deixava o usuário na tela em que estava (bug relatado em
            // foreground) sem nunca chegar ao feedback.
            abrirFeedback({ visitaId: data.visitaId, hospitalNome: pendencia.hospitalNome });
            agendarLembrete({ visitaId: data.visitaId, hospitalNome: pendencia.hospitalNome }).catch(
                () => {}
            );
        },
        [abrirFeedback]
    );

    useEffect(() => {
        const subscricao = Notifications.addNotificationResponseReceivedListener(tratarResposta);

        // Cold start: a resposta que abriu o app do zero não passa pelo listener acima
        // (ela ocorreu antes de o listener existir) — é entregue por
        // getLastNotificationResponseAsync. Sem isto, tocar a notificação com o app
        // fechado abria a tela inicial em vez do feedback (relatado após "Fechar tudo").
        const ultima = Notifications.getLastNotificationResponseAsync?.();
        if (ultima?.then) {
            ultima.then((resposta) => resposta && tratarResposta(resposta)).catch(() => {});
        }

        return () => subscricao.remove();
    }, [tratarResposta]);

    useEffect(() => {
        // Sessão global (SDD de TanStack Query e Zustand): lê o usuário persistido uma vez
        // e liga o cache de queries ao foco do app, à conexão e ao logout.
        // Não rejeita: falha na leitura do armazenamento segue anônimo (`sessaoStore`).
        void hidratarSessao();
        return configurarQueryNoApp(queryClient);
    }, []);

    useEffect(() => {
        // OPS-05: check-in e checkout registrados sem internet ficam na fila
        // offline. Os dois momentos em que vale tentar de novo são a volta ao
        // primeiro plano e o retorno da conexão — o segundo cobre o aparelho que
        // ficou aberto na tela enquanto o sinal voltava.
        const tentar = () => { sincronizar().catch(() => {}); };

        tentar();

        const inscricaoApp = AppState.addEventListener("change", (estado) => {
            if (estado === "active") {
                tentar();
            }
        });

        // Disponível a partir do expo-network 6; a chamada é opcional para não
        // quebrar em plataforma sem suporte (web) nem no ambiente de teste.
        const inscricaoRede = Network.addNetworkStateListener?.((estado) => {
            if (estado?.isConnected) {
                tentar();
            }
        });

        return () => {
            inscricaoApp.remove();
            inscricaoRede?.remove?.();
        };
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            {/* Heartbeat e geofencing seguem a visita ativa em qualquer tela (§4.2.2). */}
            <VisitaAtivaSync />
            <SafeAreaProvider>
                {/* APP-03: abaixo da versão mínima, a navegação dá lugar à tela de atualização. */}
                <AtualizacaoObrigatoria>
                    <NavigationContainer
                        ref={navigationRef}
                        onReady={() => {
                            navegacaoPronta.current = true;
                            // Despacha o feedback que chegou por cold start antes de a navegação montar.
                            if (feedbackPendente.current) {
                                navigationRef.current?.navigate("Feedback", {
                                    screen: "FeedbackForm",
                                    params: feedbackPendente.current,
                                });
                                feedbackPendente.current = null;
                            }
                        }}
                    >
                        <Stack.Navigator screenOptions={{ headerShown: false }}>
                            <Stack.Screen name="Tabs" component={Tabs} />
                            <Stack.Screen name="Feedback" component={FeedbackStack} />
                        </Stack.Navigator>
                    </NavigationContainer>
                </AtualizacaoObrigatoria>
            </SafeAreaProvider>
        </QueryClientProvider>
    );
}