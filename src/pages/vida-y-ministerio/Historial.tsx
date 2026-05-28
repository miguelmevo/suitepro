import { History } from "lucide-react";
import { HistorialVidaMinisterio } from "@/components/vida-ministerio/HistorialVidaMinisterio";

export default function HistorialVidaMinisterioPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Historial Vida y Ministerio</h1>
          <p className="text-sm text-muted-foreground">
            Última participación por categoría e importación inicial de datos históricos.
          </p>
        </div>
      </div>
      <HistorialVidaMinisterio />
    </div>
  );
}
