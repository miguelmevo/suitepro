import { History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistorialReunionPublica } from "@/components/reunion-publica/HistorialReunionPublica";
import { EstadisticasReunionPublica } from "@/components/reunion-publica/EstadisticasReunionPublica";

export default function HistorialReunionPublicaPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="historial">
        <div className="flex items-center flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <History className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Historial Reunión Pública</h1>
              <p className="text-sm text-muted-foreground">
                Última participación en Presidencia, Orador (local) y Lector de la Atalaya.
              </p>
            </div>
          </div>
          <TabsList>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="historial" className="mt-4">
          <HistorialReunionPublica />
        </TabsContent>
        <TabsContent value="estadisticas" className="mt-4">
          <EstadisticasReunionPublica />
        </TabsContent>
      </Tabs>
    </div>
  );
}
