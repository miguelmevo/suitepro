import { useViewport } from "@/contexts/ForceDesktopViewContext";

export function useIsMobile() {
  return useViewport().isMobile;
}
