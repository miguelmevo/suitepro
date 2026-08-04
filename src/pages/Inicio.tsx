import { useEffect, useState } from "react";
import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";
import { ReunionPublicaSemanal } from "@/components/programa/ReunionPublicaSemanal";
import { VidaMinisterioSemanal } from "@/components/programa/VidaMinisterioSemanal";
import { AsignacionesServicioSemanal } from "@/components/programa/AsignacionesServicioSemanal";
import { MisAsignaciones } from "@/components/programa/MisAsignaciones";
import { EventosProximos } from "@/components/programa/EventosProximos";
import { useAuthContext } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAccordionCards } from "@/hooks/useAccordionCards";
import { useIsMobile } from "@/hooks/use-mobile";

const Inicio = () => {
  const { user, profile, isSuperAdmin } = useAuthContext();
  const [puedeVerAsignacionesServicio, setPuedeVerAsignacionesServicio] = useState(false);
  const { isOpen, toggle } = useAccordionCards("predicacion");
  const isMobile = useIsMobile();

  // Regla: tarjeta "Asignación de Departamentos" solo para varones aprobados con sesión.
  // El super_admin siempre la ve, tenga el género que tenga registrado.
  useEffect(() => {
    if (isSuperAdmin()) {
      setPuedeVerAsignacionesServicio(true);
      return;
    }
    let cancelado = false;
    const verificar = async () => {
      if (!user?.id || !profile?.aprobado) {
        if (!cancelado) setPuedeVerAsignacionesServicio(false);
        return;
      }
      const { data } = await supabase
        .from("participantes")
        .select("genero, activo")
        .eq("user_id", user.id)
        .eq("activo", true)
        .maybeSingle();
      if (!cancelado) {
        const genero = (data?.genero || "").toUpperCase();
        setPuedeVerAsignacionesServicio(genero === "M" || genero === "MASCULINO" || genero === "HOMBRE");
      }
    };
    verificar();
    return () => {
      cancelado = true;
    };
  }, [user?.id, profile?.aprobado, isSuperAdmin]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-0.5 md:space-y-2">
        <h1 className="font-display text-xl md:text-[27px] font-bold tracking-tight text-primary">
          <span className="md:hidden">Programa Semanal</span>
          <span className="hidden md:inline">Programación de la Semana</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Consulta las actividades programadas
        </p>
      </div>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* En móvil/tablet: Asignaciones primero. En desktop: Predicación primero */}
        <div className="order-2 lg:order-1 flex-1 space-y-6">
          <ProgramaSemanal isOpen={isOpen("predicacion")} onToggle={() => toggle("predicacion")} />
          <div id="card-vym-semanal">
            <VidaMinisterioSemanal isOpen={isOpen("vym")} onToggle={() => toggle("vym")} />
          </div>
          <div id="card-reunion-publica-semanal">
            <ReunionPublicaSemanal isOpen={isOpen("reunion-publica")} onToggle={() => toggle("reunion-publica")} />
          </div>
          {puedeVerAsignacionesServicio && (
            <AsignacionesServicioSemanal isOpen={isOpen("asignaciones-servicio")} onToggle={() => toggle("asignaciones-servicio")} />
          )}
        </div>
        <div className="order-1 lg:order-2 w-full lg:w-72 xl:w-80 2xl:w-96 flex-shrink-0 space-y-6">
          <MisAsignaciones />
          {/* En móvil forma parte del acordeón (se cierra al abrir otra); en desktop queda
              siempre abierta por defecto e independiente, sin competir por espacio. */}
          {isMobile ? (
            <EventosProximos isOpen={isOpen("eventos")} onToggle={() => toggle("eventos")} />
          ) : (
            <EventosProximos />
          )}
        </div>
      </div>
    </div>
  );
};

export default Inicio;
