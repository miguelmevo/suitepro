import { useState, useEffect } from "react";

const FONT_SIZE_KEY = "app-font-size";
const SIZES = ["normal", "large", "x-large"] as const;
type FontSize = typeof SIZES[number];

const SIZE_VALUES: Record<FontSize, string> = {
  normal: "16px",
  large: "18px",
  "x-large": "20px",
};

const SIZE_LABELS: Record<FontSize, string> = {
  normal: "A+",
  large: "A++",
  "x-large": "A−",
};

export function useFontSize() {
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return (saved as FontSize) || "normal";
  });

  useEffect(() => {
    document.documentElement.style.fontSize = SIZE_VALUES[fontSize];
    localStorage.setItem(FONT_SIZE_KEY, fontSize);
  }, [fontSize]);

  const cycle = () => {
    const idx = SIZES.indexOf(fontSize);
    setFontSize(SIZES[(idx + 1) % SIZES.length]);
  };

  return { fontSize, label: SIZE_LABELS[fontSize], cycle };
}
