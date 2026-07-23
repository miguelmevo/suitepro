import { History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HistorialVidaMinisterio } from "@/components/vida-ministerio/HistorialVidaMinisterio";
import { EstadisticasVidaMinisterio } from "@/components/vida-ministerio/EstadisticasVidaMinisterio";

export default function HistorialVidaMinisterioPage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="historial">
        <div className="flex items-center flex-wrap gap-6">
          <div className="flex items-center gap-3">
            <History className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Historial Vida y Ministerio</h1>
              <p className="text-sm text-muted-foreground">
                Última participación por categoría e importación inicial de datos históricos.
              </p>
            </div>
          </div>
          <TabsList>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="historial" className="mt-4">
          <HistorialVidaMinisterio />
        </TabsContent>
        <TabsContent value="estadisticas" className="mt-4">
          <EstadisticasVidaMinisterio />
        </TabsContent>
      </Tabs>
    </div>
  );
}
