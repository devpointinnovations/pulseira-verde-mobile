import { StyleSheet } from "react-native";
import { colors, typography, spacing, radii } from "../../../../theme";

// Layout novo (Open Design): título grande, grupos em cartão com linhas de menu.
export default StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  titulo: {
    ...typography.displayMd,
    color: colors.onSurface,
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s4,
    paddingBottom: spacing.s2,
  },

  content: { padding: spacing.s4, paddingBottom: spacing.s8 },

  secao: {
    ...typography.titleMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s5,
    marginBottom: spacing.s2,
  },

  grupo: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    overflow: "hidden",
    marginBottom: spacing.s3,
  },

  conta: { flexDirection: "row", alignItems: "center", gap: spacing.s4, padding: spacing.s4 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.onPrimaryContainer, fontSize: 22, fontWeight: "800" },
  userName: { ...typography.titleLg, color: colors.onSurface, fontWeight: "700" },
  userEmail: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },

  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s4,
    padding: spacing.s4,
    borderBottomWidth: 1,
    borderBottomColor: colors.outlineVariant,
    minHeight: 64,
  },
  linhaUltima: { borderBottomWidth: 0 },
  linhaIcone: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.primaryContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  linhaIconePerigo: { backgroundColor: colors.errorContainer },
  linhaTextos: { flex: 1 },
  linhaTitulo: { ...typography.titleMd, color: colors.onSurface },
  linhaSubtitulo: { ...typography.bodyMd, color: colors.onSurfaceVariant },

  semAcesso: { alignItems: "center", padding: spacing.s5 },
  semAcessoTitle: { ...typography.titleLg, color: colors.onSurface, marginBottom: spacing.s2 },
  semAcessoText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginBottom: spacing.s4 },
  semAcessoActions: {
    flexDirection: "row",
    gap: spacing.s3,
    alignSelf: "stretch",
  },
  actionButton: { flex: 1 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.full,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    minHeight: 48,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.full,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    minHeight: 48,
  },
  buttonText: { color: colors.onPrimary, ...typography.bodyLg, fontWeight: "600" },
  buttonTextSecondary: { color: colors.onSurface, ...typography.bodyLg, fontWeight: "600" },

  footerNote: { ...typography.bodySm, color: colors.onSurfaceVariant, marginBottom: spacing.s3, lineHeight: 17 },
});
