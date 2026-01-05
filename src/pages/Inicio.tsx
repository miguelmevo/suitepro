import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";
import { MisAsignaciones } from "@/components/programa/MisAsignaciones";

const Inicio = () => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-primary">
          Programación de la Semana
        </h1>
        <p className="text-muted-foreground">
          Consulta las actividades programadas
        </p>
      </div>

      <div className="max-w-4xl mx-auto flex flex-col md:flex-row gap-6">
        {/* En móvil: Asignaciones primero. En desktop: Predicación primero */}
        <div className="order-2 md:order-1 flex-1">
          <ProgramaSemanal />
        </div>
        <div className="order-1 md:order-2 w-full md:w-64 flex-shrink-0">
          <MisAsignaciones />
        </div>
      </div>
    </div>
  );
};

export default Inicio;