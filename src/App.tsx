import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuthContext } from "@/contexts/AuthProvider";
import { CongregacionProvider, useCongregacion } from "@/contexts/CongregacionContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

import Inicio from "./pages/Inicio";
import InicioPublico from "./pages/InicioPublico";
import ProgramasDelMes from "./pages/ProgramasDelMes";
import Auth from "./pages/Auth";
import ProgramaMensual from "./pages/predicacion/ProgramaMensual";
import PuntosEncuentro from "./pages/predicacion/PuntosEncuentro";
import Territorios from "./pages/predicacion/Territorios";
import Historial from "./pages/predicacion/Historial";
import Carritos from "./pages/predicacion/Carritos";

import Participantes from "./pages/configuracion/Participantes";
import Usuarios from "./pages/configuracion/Usuarios";
import AjustesSistema from "./pages/configuracion/AjustesSistema";
import GruposPredicacion from "./pages/configuracion/GruposPredicacion";
import MiCuenta from "./pages/configuracion/MiCuenta";
import IndisponibilidadGeneral from "./pages/configuracion/IndisponibilidadGeneral";

import Congregaciones from "./pages/admin/Congregaciones";
import PlantillasVidaMinisterio from "./pages/admin/PlantillasVidaMinisterio";
import LectoresEbc from "./pages/vida-y-ministerio/LectoresEbc";
import HistorialVidaMinisterioPage from "./pages/vida-y-ministerio/Historial";
import TerritorioDetalle from "./pages/TerritorioDetalle";
import SeleccionCongregacion from "./pages/SeleccionCongregacion";
import NotFound from "./pages/NotFound";
import RegistroExitoso from "./pages/RegistroExitoso";
import ProgramaReunionPublica from "./pages/reunion-publica/ProgramaReunionPublica";
import LectoresAtalaya from "./pages/reunion-publica/LectoresAtalaya";
import InstalarApp from "./pages/InstalarApp";
import ListaVidaMinisterio from "./pages/vida-y-ministerio/Lista";
import EditorVidaMinisterio from "./pages/vida-y-ministerio/Editor";
import ProgramaAsignacionesServicio from "./pages/asignaciones-servicio/ProgramaAsignacionesServicio";
import Onboarding from "./pages/Onboarding";
import TerritoriosPublico from "./pages/TerritoriosPublico";
import { BottomNav } from "@/components/layout/BottomNav";

const queryClient = new QueryClient();

// Gate para la ruta "/" — si no hay sesión, muestra Inicio público (con ?c=).
function HomeGate() {
  const { user, loading } = useAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Sin sesión → vista pública (validará el ?c=)
  if (!user) {
    return <InicioPublico />;
  }

  // Con sesión → app normal
  return (
    <ProtectedRoute>
      <AppLayout>
        <Inicio />
      </AppLayout>
    </ProtectedRoute>
  );
}

// Wrapper component to handle super_admin congregation selection
function AppRoutes() {
  const { requiresSelection, cambiarCongregacion, isLoading } = useCongregacion();

  // If super_admin needs to select a congregation, show selection screen
  if (requiresSelection && !isLoading) {
    return <SeleccionCongregacion onSelect={cambiarCongregacion} />;
  }

  return (
    <>
    <Routes>
      {/* Página pública: listado de territorios */}
      <Route path="/territorios" element={<TerritoriosPublico />} />

      {/* Página pública de territorio */}
      <Route path="/territorio/:territorioId" element={<TerritorioDetalle />} />
      
      {/* Página de instalación PWA */}
      <Route path="/install" element={<InstalarApp />} />
      
      <Route path="/auth" element={<Auth />} />
      <Route path="/registro-exitoso" element={<RegistroExitoso />} />

      {/* Onboarding (sin AppLayout, sin redirect loop) */}
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute skipOnboardingRedirect>
            <Onboarding />
          </ProtectedRoute>
        }
      />

      {/* Home: pública sin sesión, app con sesión */}
      <Route path="/" element={<HomeGate />} />

      {/* App protegida */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/programas-del-mes" element={<ProgramasDelMes />} />

                {/* Predicación */}
                <Route
                  path="/predicacion/programa"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "sservicio", "saservicio"]}>
                      <ProgramaMensual />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predicacion/puntos"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "sservicio", "saservicio"]}>
                      <PuntosEncuentro />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predicacion/territorios"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "sservicio", "saservicio"]}>
                      <Territorios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predicacion/historial"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "sservicio", "saservicio"]}>
                      <Historial />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/predicacion/carritos"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "sservicio", "saservicio"]}>
                      <Carritos />
                    </ProtectedRoute>
                  }
                />

                {/* Reunión Pública */}
                <Route
                  path="/reunion-publica/programa"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "srpublica", "saservicio"]}>
                      <ProgramaReunionPublica />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/reunion-publica/lectores"
                  element={
                     <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "srpublica", "saservicio"]}>
                      <LectoresAtalaya />
                    </ProtectedRoute>
                  }
                />

                {/* Vida y Ministerio */}
                <Route
                  path="/vida-y-ministerio"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "svministerio", "saservicio"]}>
                      <ListaVidaMinisterio />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vida-y-ministerio/historial"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "svministerio", "saservicio"]}>
                      <HistorialVidaMinisterioPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vida-y-ministerio/:fecha"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "svministerio", "saservicio"]}>
                      <EditorVidaMinisterio />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/vida-y-ministerio-lectores-ebc"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer", "svministerio", "saservicio"]}>
                      <LectoresEbc />
                    </ProtectedRoute>
                  }
                />

                {/* Asignaciones de Servicio */}
                <Route
                  path="/asignaciones-servicio"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "saservicio"]}>
                      <ProgramaAsignacionesServicio />
                    </ProtectedRoute>
                  }
                />

                {/* Configuración */}
                <Route
                  path="/configuracion/participantes"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                      <Participantes />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion/usuarios"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "super_admin"]}>
                      <Usuarios />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion/ajustes"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                      <AjustesSistema />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion/grupos-predicacion"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                      <GruposPredicacion />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion/mi-cuenta"
                  element={
                    <ProtectedRoute>
                      <MiCuenta />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/configuracion/indisponibilidad"
                  element={
                    <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                      <IndisponibilidadGeneral />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/congregaciones"
                  element={
                    <ProtectedRoute>
                      <Congregaciones />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/plantillas-vym"
                  element={
                    <ProtectedRoute requiredRoles={["super_admin"]}>
                      <PlantillasVidaMinisterio />
                    </ProtectedRoute>
                  }
                />


                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
    <BottomNav />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CongregacionProvider>
            <AppRoutes />
          </CongregacionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
