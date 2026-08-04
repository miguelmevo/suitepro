import { useViewport } from "@/contexts/ForceDesktopViewContext";

export function useIsTablet() {
  return useViewport().isTablet;
}
