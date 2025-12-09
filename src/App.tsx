import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import ProgramaMensual from "./pages/predicacion/ProgramaMensual";
import PuntosEncuentro from "./pages/predicacion/PuntosEncuentro";
import Territorios from "./pages/predicacion/Territorios";
import DiasEspeciales from "./pages/predicacion/DiasEspeciales";
import Historial from "./pages/predicacion/Historial";
import Participantes from "./pages/configuracion/Participantes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/predicacion/programa" element={<ProgramaMensual />} />
            <Route path="/predicacion/puntos" element={<PuntosEncuentro />} />
            <Route path="/predicacion/territorios" element={<Territorios />} />
            <Route path="/predicacion/especiales" element={<DiasEspeciales />} />
            <Route path="/predicacion/historial" element={<Historial />} />
            <Route path="/configuracion/participantes" element={<Participantes />} />
            {/* Redirect antiguo */}
            <Route path="/programa" element={<ProgramaMensual />} />
            <Route path="/grupos" element={<Index />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;