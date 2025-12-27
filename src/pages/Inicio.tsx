import { FileText, Megaphone, BookOpen, Users, Plus, Download, Calendar } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useProgramasPublicados } from "@/hooks/useProgramasPublicados";
import { useAuthContext } from "@/contexts/AuthContext";
import { PublicarProgramaModal } from "@/components/programa/PublicarProgramaModal";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Tipos de programas que pueden ser publicados
const tiposPrograma = [
  {
    id: "predicacion",
    nombre: "Programa de Predicación",
    descripcion: "Programa mensual de predicación con horarios, territorios y capitanes",
    icon: Megaphone,
    disponible: true,
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
  const { programas, isLoading } = useProgramasPublicados();
  const { isAdminOrEditor, user } = useAuthContext();
  const canPublish = isAdminOrEditor();

  // Obtener el programa publicado más reciente por tipo
  const getProgramaPublicado = (tipoId: string) => {
    return programas.find((p) => p.tipo_programa === tipoId);
  };

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-primary">
          PROGRAMAS PUBLICADOS
        </h1>
        <p className="text-muted-foreground text-lg">
          Consulta los programas disponibles
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {tiposPrograma.map((tipo) => {
          const programaPublicado = tipo.disponible ? getProgramaPublicado(tipo.id) : null;
          
          return (
            <Card 
              key={tipo.id}
              className={`hover:shadow-lg transition-shadow ${!tipo.disponible ? 'border-dashed opacity-60' : ''}`}
            >
              <CardHeader>
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg mb-2 ${
                  tipo.disponible ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  <tipo.icon className="h-6 w-6" />
                </div>
                <CardTitle className={!tipo.disponible ? 'text-muted-foreground' : ''}>
                  {tipo.nombre}
                </CardTitle>
                <CardDescription>{tipo.descripcion}</CardDescription>
                
                {tipo.disponible ? (
                  <div className="mt-4 space-y-3">
                    {/* Mostrar información del programa publicado */}
                    {programaPublicado ? (
                      <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium capitalize">{programaPublicado.periodo}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Publicado: {format(new Date(programaPublicado.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                        </p>
                        <Button
                          variant="default"
                          className="w-full gap-2"
                          asChild
                        >
                          <a href={programaPublicado.pdf_url} target="_blank" rel="noopener noreferrer" download>
                            <Download className="h-4 w-4" />
                            Descargar PDF
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-muted/30 p-3 rounded-lg text-center">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">Sin programas publicados</p>
                      </div>
                    )}

                    {/* Botón de publicar solo para admin/editor */}
                    {canPublish && user && (
                      <PublicarProgramaModal
                        tipoProgramaId={tipo.id}
                        tipoProgramaNombre={tipo.nombre}
                        programaPublicado={programaPublicado}
                      />
                    )}
                  </div>
                ) : (
                  <Button variant="outline" disabled className="mt-4 gap-2">
                    <Plus className="h-4 w-4" />
                    Próximamente
                  </Button>
                )}
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-sm text-muted-foreground">
        <p>Los programas publicados por los administradores aparecerán aquí para su consulta.</p>
      </div>
    </div>
  );
};

export default Inicio;
