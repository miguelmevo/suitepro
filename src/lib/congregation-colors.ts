// Paleta de colores predefinidos para congregaciones
// Cada color tiene variantes para light y dark mode

export interface ColorTheme {
  id: string;
  name: string;
  // HSL values without the "hsl()" wrapper
  light: {
    primary: string;
    ring: string;
    brand: string;
    sidebar: string;
    sidebarAccent: string;
  };
  dark: {
    primary: string;
    ring: string;
    brand: string;
    sidebar: string;
    sidebarAccent: string;
  };
  // Preview color for the selector (full HSL)
  preview: string;
  // Colores concretos para PDF (sin variables CSS)
  pdf: {
    headerDark: string;  // Para headers principales (HORARIO MAÑANA/TARDE)
    headerLight: string; // Para sub-headers (HORA, GRUPOS, etc.)
    rowAlt: string;      // Filas alternadas
    link: string;        // Links
    title: string;       // Título
  };
}

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: "blue",
    name: "Azul",
    light: {
      primary: "217 91% 53%",
      ring: "217 91% 60%",
      brand: "217 91% 53%",
      sidebar: "217 91% 35%",
      sidebarAccent: "217 91% 28%",
    },
    dark: {
      primary: "217 91% 53%",
      ring: "217 91% 53%",
      brand: "217 91% 53%",
      sidebar: "217 91% 25%",
      sidebarAccent: "217 91% 20%",
    },
    preview: "hsl(217, 91%, 53%)",
    pdf: {
      headerDark: "#1a5276",
      headerLight: "#2980b9",
      rowAlt: "rgba(41, 128, 185, 0.1)",
      link: "#2980b9",
      title: "#1a5276",
    },
  },
  {
    id: "emerald",
    name: "Esmeralda",
    light: {
      primary: "160 84% 39%",
      ring: "160 84% 45%",
      brand: "160 84% 39%",
      sidebar: "160 84% 30%",
      sidebarAccent: "160 84% 23%",
    },
    dark: {
      primary: "160 84% 39%",
      ring: "160 84% 39%",
      brand: "160 84% 39%",
      sidebar: "160 84% 22%",
      sidebarAccent: "160 84% 17%",
    },
    preview: "hsl(160, 84%, 39%)",
    pdf: {
      headerDark: "#0d7a5f",
      headerLight: "#10b981",
      rowAlt: "rgba(16, 185, 129, 0.1)",
      link: "#10b981",
      title: "#0d7a5f",
    },
  },
  {
    id: "violet",
    name: "Violeta",
    light: {
      primary: "263 70% 50%",
      ring: "263 70% 56%",
      brand: "263 70% 50%",
      sidebar: "263 70% 38%",
      sidebarAccent: "263 70% 30%",
    },
    dark: {
      primary: "263 70% 50%",
      ring: "263 70% 50%",
      brand: "263 70% 50%",
      sidebar: "263 70% 28%",
      sidebarAccent: "263 70% 22%",
    },
    preview: "hsl(263, 70%, 50%)",
    pdf: {
      headerDark: "#5b21b6",
      headerLight: "#8b5cf6",
      rowAlt: "rgba(139, 92, 246, 0.1)",
      link: "#8b5cf6",
      title: "#5b21b6",
    },
  },
  {
    id: "rose",
    name: "Rosa",
    light: {
      primary: "346 77% 50%",
      ring: "346 77% 56%",
      brand: "346 77% 50%",
      sidebar: "346 77% 38%",
      sidebarAccent: "346 77% 30%",
    },
    dark: {
      primary: "346 77% 50%",
      ring: "346 77% 50%",
      brand: "346 77% 50%",
      sidebar: "346 77% 28%",
      sidebarAccent: "346 77% 22%",
    },
    preview: "hsl(346, 77%, 50%)",
    pdf: {
      headerDark: "#9f1239",
      headerLight: "#e11d48",
      rowAlt: "rgba(225, 29, 72, 0.1)",
      link: "#e11d48",
      title: "#9f1239",
    },
  },
  {
    id: "amber",
    name: "Ámbar",
    light: {
      primary: "38 92% 50%",
      ring: "38 92% 56%",
      brand: "38 92% 50%",
      sidebar: "38 92% 38%",
      sidebarAccent: "38 92% 30%",
    },
    dark: {
      primary: "38 92% 50%",
      ring: "38 92% 50%",
      brand: "38 92% 50%",
      sidebar: "38 92% 28%",
      sidebarAccent: "38 92% 22%",
    },
    preview: "hsl(38, 92%, 50%)",
    pdf: {
      headerDark: "#b45309",
      headerLight: "#f59e0b",
      rowAlt: "rgba(245, 158, 11, 0.1)",
      link: "#f59e0b",
      title: "#b45309",
    },
  },
  {
    id: "cyan",
    name: "Cian",
    light: {
      primary: "186 94% 41%",
      ring: "186 94% 47%",
      brand: "186 94% 41%",
      sidebar: "186 94% 32%",
      sidebarAccent: "186 94% 25%",
    },
    dark: {
      primary: "186 94% 41%",
      ring: "186 94% 41%",
      brand: "186 94% 41%",
      sidebar: "186 94% 24%",
      sidebarAccent: "186 94% 18%",
    },
    preview: "hsl(186, 94%, 41%)",
    pdf: {
      headerDark: "#0e7490",
      headerLight: "#06b6d4",
      rowAlt: "rgba(6, 182, 212, 0.1)",
      link: "#06b6d4",
      title: "#0e7490",
    },
  },
  {
    id: "indigo",
    name: "Índigo",
    light: {
      primary: "239 84% 67%",
      ring: "239 84% 73%",
      brand: "239 84% 67%",
      sidebar: "239 84% 50%",
      sidebarAccent: "239 84% 42%",
    },
    dark: {
      primary: "239 84% 67%",
      ring: "239 84% 67%",
      brand: "239 84% 67%",
      sidebar: "239 84% 35%",
      sidebarAccent: "239 84% 28%",
    },
    preview: "hsl(239, 84%, 67%)",
    pdf: {
      headerDark: "#3730a3",
      headerLight: "#6366f1",
      rowAlt: "rgba(99, 102, 241, 0.1)",
      link: "#6366f1",
      title: "#3730a3",
    },
  },
  {
    id: "teal",
    name: "Turquesa",
    light: {
      primary: "173 80% 40%",
      ring: "173 80% 46%",
      brand: "173 80% 40%",
      sidebar: "173 80% 30%",
      sidebarAccent: "173 80% 23%",
    },
    dark: {
      primary: "173 80% 40%",
      ring: "173 80% 40%",
      brand: "173 80% 40%",
      sidebar: "173 80% 22%",
      sidebarAccent: "173 80% 17%",
    },
    preview: "hsl(173, 80%, 40%)",
    pdf: {
      headerDark: "#0f766e",
      headerLight: "#14b8a6",
      rowAlt: "rgba(20, 184, 166, 0.1)",
      link: "#14b8a6",
      title: "#0f766e",
    },
  },
  {
    id: "orange",
    name: "Naranja",
    light: {
      primary: "25 95% 53%",
      ring: "25 95% 59%",
      brand: "25 95% 53%",
      sidebar: "25 95% 40%",
      sidebarAccent: "25 95% 32%",
    },
    dark: {
      primary: "25 95% 53%",
      ring: "25 95% 53%",
      brand: "25 95% 53%",
      sidebar: "25 95% 30%",
      sidebarAccent: "25 95% 24%",
    },
    preview: "hsl(25, 95%, 53%)",
    pdf: {
      headerDark: "#c2410c",
      headerLight: "#f97316",
      rowAlt: "rgba(249, 115, 22, 0.1)",
      link: "#f97316",
      title: "#c2410c",
    },
  },
  {
    id: "fuchsia",
    name: "Fucsia",
    light: {
      primary: "292 84% 61%",
      ring: "292 84% 67%",
      brand: "292 84% 61%",
      sidebar: "292 84% 45%",
      sidebarAccent: "292 84% 37%",
    },
    dark: {
      primary: "292 84% 61%",
      ring: "292 84% 61%",
      brand: "292 84% 61%",
      sidebar: "292 84% 32%",
      sidebarAccent: "292 84% 26%",
    },
    preview: "hsl(292, 84%, 61%)",
    pdf: {
      headerDark: "#a21caf",
      headerLight: "#d946ef",
      rowAlt: "rgba(217, 70, 239, 0.1)",
      link: "#d946ef",
      title: "#a21caf",
    },
  },
  {
    id: "lime",
    name: "Lima",
    light: {
      primary: "84 81% 44%",
      ring: "84 81% 50%",
      brand: "84 81% 44%",
      sidebar: "84 81% 32%",
      sidebarAccent: "84 81% 25%",
    },
    dark: {
      primary: "84 81% 44%",
      ring: "84 81% 44%",
      brand: "84 81% 44%",
      sidebar: "84 81% 24%",
      sidebarAccent: "84 81% 18%",
    },
    preview: "hsl(84, 81%, 44%)",
    pdf: {
      headerDark: "#4d7c0f",
      headerLight: "#84cc16",
      rowAlt: "rgba(132, 204, 22, 0.1)",
      link: "#84cc16",
      title: "#4d7c0f",
    },
  },
  {
    id: "slate",
    name: "Pizarra",
    light: {
      primary: "215 20% 45%",
      ring: "215 20% 51%",
      brand: "215 20% 45%",
      sidebar: "215 20% 35%",
      sidebarAccent: "215 20% 28%",
    },
    dark: {
      primary: "215 20% 55%",
      ring: "215 20% 55%",
      brand: "215 20% 55%",
      sidebar: "215 20% 25%",
      sidebarAccent: "215 20% 20%",
    },
    preview: "hsl(215, 20%, 45%)",
    pdf: {
      headerDark: "#475569",
      headerLight: "#64748b",
      rowAlt: "rgba(100, 116, 139, 0.1)",
      link: "#64748b",
      title: "#475569",
    },
  },
];

export function getColorTheme(colorId: string): ColorTheme {
  return COLOR_THEMES.find((c) => c.id === colorId) || COLOR_THEMES[0];
}

export function applyColorTheme(colorId: string): void {
  const theme = getColorTheme(colorId);
  const root = document.documentElement;
  const isDark = root.classList.contains("dark");
  const colors = isDark ? theme.dark : theme.light;

  root.style.setProperty("--primary", colors.primary);
  root.style.setProperty("--ring", colors.ring);
  root.style.setProperty("--brand", colors.brand);
  root.style.setProperty("--sidebar-background", colors.sidebar);
  root.style.setProperty("--sidebar-accent", colors.sidebarAccent);
  root.style.setProperty("--sidebar-border", colors.sidebarAccent);
  root.style.setProperty("--sidebar-primary-foreground", colors.sidebar);
}

export function resetColorTheme(): void {
  const root = document.documentElement;
  root.style.removeProperty("--primary");
  root.style.removeProperty("--ring");
  root.style.removeProperty("--brand");
  root.style.removeProperty("--sidebar-background");
  root.style.removeProperty("--sidebar-accent");
  root.style.removeProperty("--sidebar-border");
  root.style.removeProperty("--sidebar-primary-foreground");
}
