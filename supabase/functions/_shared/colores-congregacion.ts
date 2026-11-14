// Color principal de cada tema de congregación (mismos ids que
// src/lib/congregation-colors.ts, valor "light.primary" en HSL). Se usa para
// que los correos vengan con el color elegido por la congregación.
const PRIMARIOS_HSL: Record<string, string> = {
  blue: "217 91% 53%",
  emerald: "160 84% 39%",
  violet: "263 70% 50%",
  rose: "346 77% 50%",
  amber: "38 92% 50%",
  cyan: "186 94% 41%",
  indigo: "239 84% 67%",
  teal: "173 80% 40%",
  orange: "25 95% 53%",
  fuchsia: "292 84% 61%",
  lime: "84 81% 44%",
  slate: "215 20% 45%",
};

function hslAHex(hsl: string): string {
  const [h, s, l] = hsl.replace(/%/g, "").split(/\s+/).map(Number);
  const sat = s / 100;
  const lum = l / 100;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lum - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** Color principal en hex para el id de tema de la congregación (azul si no existe). */
export function colorPrimarioHex(colorId: string | null | undefined): string {
  return hslAHex(PRIMARIOS_HSL[colorId ?? ""] ?? PRIMARIOS_HSL.blue);
}
