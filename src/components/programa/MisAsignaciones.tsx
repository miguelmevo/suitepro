import { format, startOfMonth, endOfMonth, parseISO, isAfter, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Calendar, Clock } from "lucide-react";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export function MisAsignaciones() {
  const { user } = useAuth();
  const hoy = new Date();
  const hoyStr = format(hoy, "yyyy-MM-dd");
  const fechaInicio = format(startOfMonth(hoy), "yyyy-MM-dd");
  const fechaFin = format(endOfMonth(hoy), "yyyy-MM-dd");

  const { programa, horarios, isLoading: loadingPrograma } = useProgramaPredicacion(fechaInicio, fechaFin);
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();

  const isLoading = loadingPrograma || loadingParticipantes;

  // Encontrar el participante asociado al usuario actual por email
  const miParticipante = participantes.find(p => {
    if (!user) return false;
    
    const userMetadata = user.user_metadata;
    const nombre = userMetadata?.nombre || "";
    const apellido = userMetadata?.apellido || "";
    
    if (nombre && apellido) {
      return p.nombre.toLowerCase() === nombre.toLowerCase() && 
             p.apellido.toLowerCase() === apellido.toLowerCase();
    }
    
    return false;
  });

  // Obtener asignaciones de capitán futuras (desde hoy en adelante)
  const misAsignacionesCapitan = programa.filter(p => {
    // Solo fechas futuras o de hoy
    if (p.fecha < hoyStr) return false;
    
    // Verificar si es capitán directo de la entrada
    if (p.capitan_id === miParticipante?.id) return true;
    
    // Verificar si es capitán en algún grupo
    if (p.asignaciones_grupos && Array.isArray(p.asignaciones_grupos)) {
      return p.asignaciones_grupos.some((asig: any) => asig.capitan_id === miParticipante?.id);
    }
    
    return false;
  });

  // Agrupar por tipo de asignación
  const asignacionesPorTipo = {
    capitan: misAsignacionesCapitan.map(entrada => {
      const horario = horarios.find(h => h.id === entrada.horario_id);
      const fecha = parseISO(entrada.fecha);
      return {
        id: entrada.id,
        fecha: entrada.fecha,
        fechaFormateada: format(fecha, "EEEE d", { locale: es }),
        hora: horario?.hora.slice(0, 5) || "",
        tipo: "Capitán"
      };
    }).sort((a, b) => a.fecha.localeCompare(b.fecha))
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4 text-primary" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            Inicia sesión para ver tus asignaciones
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!miParticipante) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base uppercase">
            <User className="h-4 w-4 text-primary" />
            Mis Asignaciones
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-xs text-muted-foreground text-center">
            No se encontró un participante asociado a tu cuenta
          </p>
        </CardContent>
      </Card>
    );
  }

  const tieneAsignaciones = asignacionesPorTipo.capitan.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base uppercase">
          <User className="h-4 w-4 text-primary" />
          Mis Asignaciones
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {miParticipante.nombre} {miParticipante.apellido}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!tieneAsignaciones ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            No tienes asignaciones próximas
          </p>
        ) : (
          <>
            {/* Asignaciones de Capitán */}
            {asignacionesPorTipo.capitan.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Capitanías - {format(hoy, "MMMM yyyy", { locale: es })}</span>
                </div>
                <div className="space-y-1 pl-5">
                  {asignacionesPorTipo.capitan.map(asig => (
                    <div 
                      key={asig.id} 
                      className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                    >
                      <span className="font-medium capitalize">{asig.fechaFormateada}</span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{asig.hora}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}