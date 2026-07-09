import type { CSSProperties, ReactNode } from "react";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useIsTablet } from "@/hooks/use-tablet";
import { cn } from "@/lib/utils";

interface BottomNavPageProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function BottomNavPage({ children, className, contentClassName }: BottomNavPageProps) {
  const { user } = useAuthContext();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const hasBottomNav = isMobile || (!user && (isTablet || !isMobile));

  const containerStyle: CSSProperties = hasBottomNav
    ? { height: "calc(100dvh - 4rem - env(safe-area-inset-bottom))" }
    : { minHeight: "100dvh" };

  return (
    <div
      className={cn("bg-background", hasBottomNav && "overflow-y-auto", className)}
      style={containerStyle}
    >
      <div className={cn(hasBottomNav && "min-h-full", contentClassName)}>{children}</div>
    </div>
  );
}