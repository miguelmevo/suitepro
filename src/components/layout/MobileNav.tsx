import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  Menu, 
  LogOut,
  CalendarDays,
  Home,
  FileText,
  Map
} from "lucide-react";
import { useAuthContext } from "@/contexts/AuthProvider";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavProps {
  nombreCongregacion?: string;
}

export function MobileNav({ nombreCongregacion }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;
  const { profile, signOut, isAdminOrEditor, isSuperAdmin } = useAuthContext();
  const canViewTerritories = isAdminOrEditor() || isSuperAdmin();

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await signOut();
    setOpen(false);
    setIsSigningOut(false);
  };

  const handleNavigate = (url: string) => {
    navigate(url);
    setOpen(false);
  };

  return (
    <header className="h-14 flex items-center justify-between border-b bg-background px-4 sticky top-0 z-50">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-primary" />
        <span className="font-display font-bold text-primary">
          {nombreCongregacion || "SUITEPRO"}
        </span>
      </div>
      
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[280px] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <CalendarDays className="h-5 w-5 text-primary" />
              <span>{nombreCongregacion || "SUITEPRO"}</span>
            </SheetTitle>
          </SheetHeader>
          
          <div className="flex flex-col h-[calc(100vh-80px)]">
            <nav className="flex-1 overflow-y-auto p-4 space-y-1">
              <button
                onClick={() => handleNavigate("/")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentPath === "/" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <Home className="h-4 w-4" />
                <span>Inicio</span>
              </button>
              
              <button
                onClick={() => handleNavigate("/programas-del-mes")}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  currentPath === "/programas-del-mes" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Programas del Mes</span>
              </button>

              {canViewTerritories && (
                <button
                  onClick={() => handleNavigate("/predicacion/territorios")}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                    currentPath === "/predicacion/territorios" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
                  }`}
                >
                  <Map className="h-4 w-4" />
                  <span>Territorios</span>
                </button>
              )}
            </nav>

            <div className="border-t p-4 space-y-3">
              {profile && (
                <div className="text-sm">
                  <p className="font-medium truncate">
                    {profile.nombre} {profile.apellido}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                </div>
              )}
              <Button 
                variant="outline" 
                size="sm" 
                className="w-full"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
