import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";

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

      <div className="max-w-xl mx-auto">
        <ProgramaSemanal />
      </div>
    </div>
  );
};

export default Inicio;