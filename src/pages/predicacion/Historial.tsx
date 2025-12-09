import { History } from "lucide-react";

export default function Historial() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Historial de Programas</h1>
        <p className="text-muted-foreground">
          Consulta programas anteriores
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <History className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Próximamente</h3>
        <p className="text-muted-foreground max-w-md">
          Aquí podrás ver el historial de todos los programas generados, 
          exportarlos o consultarlos para referencia.
        </p>
      </div>
    </div>
  );
}