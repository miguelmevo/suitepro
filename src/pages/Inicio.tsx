import { FileText, Megaphone, BookOpen, Users, Plus } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Tipos de programas que pueden ser publicados
const programasPublicados = [
  {
    id: "predicacion",
    nombre: "Programa de Predicación",
    descripcion: "Programa mensual de predicación con horarios, territorios y capitanes",
    icon: Megaphone,
    disponible: true,
    pdfUrl: null, // Se llenará cuando haya programas publicados
  },
  {
    id: "vida-ministerio",
    nombre: "Vida y Ministerio Cristiano",
    descripcion: "Programa semanal de la reunión Vida y Ministerio",
    icon: BookOpen,
    disponible: false,
  },
  {
    id: "reunion-publica",
    nombre: "Reunión Pública",
    descripcion: "Programa de discursos públicos y estudios de la Atalaya",
    icon: Users,
    disponible: false,
  },
  {
    id: "asignaciones-servicio",
    nombre: "Asignaciones de Servicio",
    descripcion: "Programa de asignaciones de servicio en el Salón del Reino",
    icon: FileText,
    disponible: false,
  },
];

const Inicio = () => {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-[hsl(217,91%,35%)]">
          PROGRAMAS PUBLICADOS
        </h1>
        <p className="text-muted-foreground text-lg">
          Consulta los programas disponibles
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {programasPublicados.map((programa) => (
          <Card 
            key={programa.id}
            className={`hover:shadow-lg transition-shadow ${!programa.disponible ? 'border-dashed opacity-60' : ''}`}
          >
            <CardHeader>
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg mb-2 ${
                programa.disponible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                <programa.icon className="h-6 w-6" />
              </div>
              <CardTitle className={!programa.disponible ? 'text-muted-foreground' : ''}>
                {programa.nombre}
              </CardTitle>
              <CardDescription>{programa.descripcion}</CardDescription>
              
              {programa.disponible ? (
                <Button variant="outline" className="mt-4 gap-2" disabled>
                  <FileText className="h-4 w-4" />
                  Sin programas publicados
                </Button>
              ) : (
                <Button variant="outline" disabled className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  Próximamente
                </Button>
              )}
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Los programas publicados por los administradores aparecerán aquí para su consulta.</p>
      </div>
    </div>
  );
};

export default Inicio;
