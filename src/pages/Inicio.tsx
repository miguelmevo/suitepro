import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";
import { ReunionPublicaSemanal } from "@/components/programa/ReunionPublicaSemanal";
import { MisAsignaciones } from "@/components/programa/MisAsignaciones";

const Inicio = () => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-0.5 md:space-y-2">
        <h1 className="font-display text-xl md:text-3xl font-bold tracking-tight text-primary">
          <span className="md:hidden">Programa Semanal</span>
          <span className="hidden md:inline">Programación de la Semana</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Consulta las actividades programadas
        </p>
      </div>

      <div className="max-w-4xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* En móvil/tablet: Asignaciones primero. En desktop: Predicación primero */}
        <div className="order-2 lg:order-1 flex-1 space-y-6">
          <ProgramaSemanal />
          <ReunionPublicaSemanal />
        </div>
        <div className="order-1 lg:order-2 w-full lg:w-64 flex-shrink-0">
          <MisAsignaciones />
        </div>
      </div>
    </div>
  );
};

export default Inicio;