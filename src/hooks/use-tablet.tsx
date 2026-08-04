import * as React from "react";
import { useForceDesktopView } from "@/contexts/ForceDesktopViewContext";

const TABLET_BREAKPOINT = 1024;
const MOBILE_BREAKPOINT = 768;

export function useIsTablet() {
  const { forced } = useForceDesktopView();
  const [isTablet, setIsTablet] = React.useState<boolean>(false);

  React.useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      setIsTablet(w >= MOBILE_BREAKPOINT && w < TABLET_BREAKPOINT);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (forced) return false;
  return isTablet;
}
