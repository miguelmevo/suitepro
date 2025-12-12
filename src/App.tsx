import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProgramaMensual from "./pages/predicacion/ProgramaMensual";
import PuntosEncuentro from "./pages/predicacion/PuntosEncuentro";
import Territorios from "./pages/predicacion/Territorios";
import DiasEspeciales from "./pages/predicacion/DiasEspeciales";
import Historial from "./pages/predicacion/Historial";
import Participantes from "./pages/configuracion/Participantes";
import Usuarios from "./pages/configuracion/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/predicacion/programa" element={<ProgramaMensual />} />
                      <Route path="/predicacion/puntos" element={<PuntosEncuentro />} />
                      <Route path="/predicacion/territorios" element={<Territorios />} />
                      <Route path="/predicacion/especiales" element={<DiasEspeciales />} />
                      <Route path="/predicacion/historial" element={<Historial />} />
                      <Route
                        path="/configuracion/participantes"
                        element={
                          <ProtectedRoute requiredRoles={["admin", "editor"]}>
                            <Participantes />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/configuracion/usuarios"
                        element={
                          <ProtectedRoute requiredRoles={["admin"]}>
                            <Usuarios />
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
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
