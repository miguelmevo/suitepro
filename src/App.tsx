import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CongregacionProvider } from "@/contexts/CongregacionContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";

import Inicio from "./pages/Inicio";
import ProgramasDelMes from "./pages/ProgramasDelMes";
import Auth from "./pages/Auth";
import ProgramaMensual from "./pages/predicacion/ProgramaMensual";
import PuntosEncuentro from "./pages/predicacion/PuntosEncuentro";
import Territorios from "./pages/predicacion/Territorios";
import Historial from "./pages/predicacion/Historial";
import Participantes from "./pages/configuracion/Participantes";
import Usuarios from "./pages/configuracion/Usuarios";
import AjustesSistema from "./pages/configuracion/AjustesSistema";
import GruposPredicacion from "./pages/configuracion/GruposPredicacion";
import MiCuenta from "./pages/configuracion/MiCuenta";
import Congregaciones from "./pages/admin/Congregaciones";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CongregacionProvider>
            <Routes>
              {/* Auth pública */}
              <Route path="/auth" element={<Auth />} />

              {/* App protegida (incluye /) */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <Routes>
                        {/* Inicio - Accesible para todos */}
                        <Route path="/" element={<Inicio />} />
                        <Route path="/programas-del-mes" element={<ProgramasDelMes />} />

                        {/* Predicación - Solo admin/editor/super_admin */}
                        <Route
                          path="/predicacion/programa"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
                              <ProgramaMensual />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/puntos"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
                              <PuntosEncuentro />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/territorios"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
                              <Territorios />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/historial"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
                              <Historial />
                            </ProtectedRoute>
                          }
                        />

                        {/* Configuración - Solo admin/editor/super_admin */}
                        <Route
                          path="/configuracion/participantes"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
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
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
                              <AjustesSistema />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/configuracion/grupos-predicacion"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin"]}>
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
                          path="/admin/congregaciones"
                          element={
                            <ProtectedRoute>
                              <Congregaciones />
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
          </CongregacionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
