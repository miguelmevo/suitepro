import { Star } from "lucide-react";

export default function DiasEspeciales() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Días Especiales</h1>
        <p className="text-muted-foreground">
          Configura días especiales y mensajes para el programa
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Star className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-2">Próximamente</h3>
        <p className="text-muted-foreground max-w-md">
          Aquí podrás configurar días especiales como asambleas, memoriales, 
          días de actividad especial, etc. que aparecerán automáticamente en el programa.
        </p>
      </div>
    </div>
  );
}