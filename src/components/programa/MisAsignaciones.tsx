import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Calendar, Clock, BookOpen } from "lucide-react";
import { useProgramaPredicacion } from "@/hooks/useProgramaPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useReunionPublica } from "@/hooks/useReunionPublica";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface AsignacionItem {
  id: string;
  fecha: string;
  fechaFormateada: string;
  hora?: string;
  tipo: string;
  tipoAsignacion: "predicacion" | "reunion_publica";
}

export function MisAsignaciones() {
  const { user } = useAuth();
  const hoy = new Date();
  const hoyStr = format(hoy, "yyyy-MM-dd");
  const fechaInicio = format(startOfMonth(hoy), "yyyy-MM-dd");
  const fechaFin = format(endOfMonth(hoy), "yyyy-MM-dd");

  const { programa: programaPredicacion, horarios, isLoading: loadingPrograma } = useProgramaPredicacion(fechaInicio, fechaFin);
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const { programa: programaReunion, isLoading: loadingReunion } = useReunionPublica(hoy.getMonth(), hoy.getFullYear());

  const isLoading = loadingPrograma || loadingParticipantes || loadingReunion;

  // Encontrar el participante asociado al usuario actual por nombre y apellido
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
  const asignacionesPredicacion: AsignacionItem[] = programaPredicacion
    .filter(p => {
      // Solo fechas futuras o de hoy
      if (p.fecha < hoyStr) return false;
      
      // Verificar si es capitán directo de la entrada
      if (p.capitan_id === miParticipante?.id) return true;
      
      // Verificar si es capitán en algún grupo
      if (p.asignaciones_grupos && Array.isArray(p.asignaciones_grupos)) {
        return p.asignaciones_grupos.some((asig: any) => asig.capitan_id === miParticipante?.id);
      }
      
      return false;
    })
    .map(entrada => {
      const horario = horarios.find(h => h.id === entrada.horario_id);
      const fecha = parseISO(entrada.fecha);
      return {
        id: entrada.id,
        fecha: entrada.fecha,
        fechaFormateada: format(fecha, "EEEE d", { locale: es }),
        hora: horario?.hora.slice(0, 5) || "",
        tipo: "Capitán",
        tipoAsignacion: "predicacion" as const
      };
    });

  // Obtener asignaciones de Reunión Pública
  const asignacionesReunionPublica: AsignacionItem[] = [];
  
  if (miParticipante && programaReunion) {
    programaReunion.forEach(entrada => {
      // Solo fechas futuras o de hoy
      if (entrada.fecha < hoyStr) return;
      
      const fecha = parseISO(entrada.fecha);
      const fechaFormateada = format(fecha, "EEEE d", { locale: es });
      
      // Verificar cada tipo de asignación
      if (entrada.presidente_id === miParticipante.id) {
        asignacionesReunionPublica.push({
          id: `${entrada.id}-presidente`,
          fecha: entrada.fecha,
          fechaFormateada,
          tipo: "Presidente",
          tipoAsignacion: "reunion_publica"
        });
      }
      
      if (entrada.orador_suplente_id === miParticipante.id) {
        asignacionesReunionPublica.push({
          id: `${entrada.id}-orador-suplente`,
          fecha: entrada.fecha,
          fechaFormateada,
          tipo: "Orador Suplente",
          tipoAsignacion: "reunion_publica"
        });
      }
      
      if (entrada.orador_saliente_id === miParticipante.id) {
        asignacionesReunionPublica.push({
          id: `${entrada.id}-orador-saliente`,
          fecha: entrada.fecha,
          fechaFormateada,
          tipo: "Orador Saliente",
          tipoAsignacion: "reunion_publica"
        });
      }
      
      if (entrada.conductor_atalaya_id === miParticipante.id) {
        asignacionesReunionPublica.push({
          id: `${entrada.id}-conductor`,
          fecha: entrada.fecha,
          fechaFormateada,
          tipo: "Conductor Atalaya",
          tipoAsignacion: "reunion_publica"
        });
      }
      
      if (entrada.lector_atalaya_id === miParticipante.id) {
        asignacionesReunionPublica.push({
          id: `${entrada.id}-lector`,
          fecha: entrada.fecha,
          fechaFormateada,
          tipo: "Lector Atalaya",
          tipoAsignacion: "reunion_publica"
        });
      }
    });
  }

  // Ordenar asignaciones por fecha
  const todasAsignaciones = [...asignacionesPredicacion, ...asignacionesReunionPublica]
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const tieneAsignaciones = todasAsignaciones.length > 0;

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
          <div className="space-y-3">
            {/* Asignaciones de Predicación */}
            {asignacionesPredicacion.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Predicación</span>
                </div>
                <div className="space-y-1 pl-5">
                  {asignacionesPredicacion.map(asig => (
                    <div 
                      key={asig.id} 
                      className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                    >
                      <span className="font-medium capitalize">{asig.fechaFormateada}</span>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{asig.hora}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {asig.tipo}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Asignaciones de Reunión Pública */}
            {asignacionesReunionPublica.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs font-medium">Reunión Pública</span>
                </div>
                <div className="space-y-1 pl-5">
                  {asignacionesReunionPublica.map(asig => (
                    <div 
                      key={asig.id} 
                      className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1"
                    >
                      <span className="font-medium capitalize">{asig.fechaFormateada}</span>
                      <Badge variant="secondary" className="text-[10px] px-1 py-0">
                        {asig.tipo}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
