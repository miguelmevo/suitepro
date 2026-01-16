import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthProvider";
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
import IndisponibilidadGeneral from "./pages/configuracion/IndisponibilidadGeneral";
import Conexiones from "./pages/configuracion/Conexiones";
import Congregaciones from "./pages/admin/Congregaciones";
import TerritorioDetalle from "./pages/TerritorioDetalle";
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
              {/* Página pública de territorio */}
              <Route path="/territorio/:territorioId" element={<TerritorioDetalle />} />
              
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

                        {/* Predicación - admin/editor/super_admin/viewer (viewer solo lectura) */}
                        <Route
                          path="/predicacion/programa"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                              <ProgramaMensual />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/puntos"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                              <PuntosEncuentro />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/territorios"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                              <Territorios />
                            </ProtectedRoute>
                          }
                        />
                        <Route
                          path="/predicacion/historial"
                          element={
                            <ProtectedRoute requiredRoles={["admin", "editor", "super_admin", "viewer"]}>
                              <Historial />
                            </ProtectedRoute>
                          }
                        />

                        {/* Configuración - admin/editor/super_admin/viewer (viewer solo lectura, sin usuarios) */}
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
                          path="/configuracion/conexiones"
                          element={
                            <ProtectedRoute requiredRoles={["super_admin"]}>
                              <Conexiones />
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
