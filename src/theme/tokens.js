/**
 * Design System — tokens. Paleta verde do novo layout Pulseira Verde (logo B,
 * proposta de 12/11/2026); escalas e espaçamentos do Padrao-UI-UX (§5).
 *
 * Tipografia (Manrope/Inter) ainda não é carregada via expo-font; as escalas
 * abaixo aplicam peso/tamanho/line-height/letterSpacing com a fonte do sistema.
 * O carregamento das famílias tipográficas fica para o épico de polimento (E6-02).
 */

export const colors = {
  // Primárias (verde da marca, logo B)
  primary: "#0B6B4F",
  onPrimary: "#ffffff",
  primaryContainer: "#D5EEE2",
  onPrimaryContainer: "#06402F",
  primaryFixed: "#D5EEE2",
  onPrimaryFixed: "#06402F",
  primaryFixedDim: "#CFE6D6",
  onPrimaryFixedVariant: "#06402F",

  // Secundárias
  secondary: "#2F6B57",
  onSecondary: "#ffffff",
  secondaryContainer: "#D5EEE2",
  onSecondaryContainer: "#06402F",

  // Terciárias (âmbar: nota e "falta avaliar")
  tertiary: "#8A5A00",
  onTertiary: "#ffffff",
  tertiaryContainer: "#FCEFD2",
  onTertiaryContainer: "#5A3B00",

  // Erro
  error: "#B3261E",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",

  // Superfícies (hierarquia tonal)
  surface: "#F4F7F5",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#E7EEE9",
  surfaceContainer: "#E6ECE8",
  surfaceContainerHigh: "#E1E8E4",
  surfaceContainerHighest: "#DDE9E1",
  surfaceVariant: "#E1E8E4",
  onSurface: "#13211B",
  onSurfaceVariant: "#4C5B54",
  outline: "#6B7A72",
  outlineVariant: "#D9E2DC",
  inverseSurface: "#24332C",
  inverseOnSurface: "#EEF3F0",
  inversePrimary: "#9ED8BE",
  background: "#F4F7F5",

  // Semânticos (contexto paciente)
  ratingFilled: "#E8A317",
  ratingEmpty: "#A9B8B0",
  geoActive: "#0B6B4F",
  geoInactive: "#4C5B54",
  successBg: "#D5EEE2",
  warningBg: "#FCEFD2",
  onWarning: "#5A3B00",
  skeleton: "#E1E8E4",
  overlayScrim: "rgba(19,33,27,0.4)",
};

export const gradients = {
  // Gradiente primário (assinatura): 135°.
  primary: ["#0B6B4F", "#06402F"],
  background: ["#F4F7F5", "#E7EEE9"],
};

/**
 * Fonte do layout novo: Inter. No Android ela é registrada como a família "Inter" no
 * MainApplication (res/font/inter.xml traz os pesos 400 a 800); no navegador, carregada por
 * `carregarFontes.web.js`. Todo estilo de texto leva a família, porque o React Native não
 * tem uma fonte padrão para o app inteiro.
 */
export const fontes = { texto: "Inter" };

export const typography = {
  displayLg: { fontFamily: fontes.texto, fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: -0.5 },
  displayMd: { fontFamily: fontes.texto, fontSize: 28, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5 },
  displaySm: { fontFamily: fontes.texto, fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.3 },
  headlineMd: { fontFamily: fontes.texto, fontSize: 22, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  headlineSm: { fontFamily: fontes.texto, fontSize: 20, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2 },
  titleLg: { fontFamily: fontes.texto, fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: -0.2 },
  titleMd: { fontFamily: fontes.texto, fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0 },
  bodyLg: { fontFamily: fontes.texto, fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  bodyMd: { fontFamily: fontes.texto, fontSize: 14, lineHeight: 21, fontWeight: "400", letterSpacing: 0 },
  bodySm: { fontFamily: fontes.texto, fontSize: 12, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
  labelLg: { fontFamily: fontes.texto, fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1 },
  labelMd: { fontFamily: fontes.texto, fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5 },
  labelSm: { fontFamily: fontes.texto, fontSize: 11, lineHeight: 16, fontWeight: "600", letterSpacing: 1 },
  numeric: { fontFamily: fontes.texto, fontWeight: "700", fontVariant: ["tabular-nums"] },
};

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const shadows = {
  cloud1: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  cloud2: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  primaryGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  glass: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
};

export const motion = {
  durationFast: 120,
  durationBase: 200,
  durationSlow: 300,
  easingStandard: [0.2, 0, 0, 1],
  easingEnter: [0.0, 0.0, 0.2, 1],
  easingExit: [0.4, 0, 1, 1],
};

export const touchTarget = {
  min: 48,
};

const theme = {
  colors,
  gradients,
  typography,
  spacing,
  radii,
  shadows,
  motion,
  touchTarget,
};

export default theme;
