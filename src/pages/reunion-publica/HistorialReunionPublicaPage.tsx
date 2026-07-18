import { History } from "lucide-react";
import { HistorialReunionPublica } from "@/components/reunion-publica/HistorialReunionPublica";

export default function HistorialReunionPublicaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Historial Reunión Pública</h1>
          <p className="text-sm text-muted-foreground">
            Última participación en Presidencia, Orador (local) y Lector de la Atalaya.
          </p>
        </div>
      </div>
      <HistorialReunionPublica />
    </div>
  );
}
