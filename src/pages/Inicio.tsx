import { useEffect, useState } from "react";
import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";
import { ReunionPublicaSemanal } from "@/components/programa/ReunionPublicaSemanal";
import { VidaMinisterioSemanal } from "@/components/programa/VidaMinisterioSemanal";
import { AsignacionesServicioSemanal } from "@/components/programa/AsignacionesServicioSemanal";
import { MisAsignaciones } from "@/components/programa/MisAsignaciones";
import { useAuthContext } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const Inicio = () => {
  const { user, profile } = useAuthContext();
  const [puedeVerAsignacionesServicio, setPuedeVerAsignacionesServicio] = useState(false);

  // Regla: tarjeta "Asignación de Departamentos" solo para varones aprobados con sesión.
  useEffect(() => {
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
        const genero = (data?.genero || "").toLowerCase();
        setPuedeVerAsignacionesServicio(genero === "masculino" || genero === "hombre");
      }
    };
    verificar();
    return () => {
      cancelado = true;
    };
  }, [user?.id, profile?.aprobado]);

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

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
        {/* En móvil/tablet: Asignaciones primero. En desktop: Predicación primero */}
        <div className="order-2 lg:order-1 flex-1 space-y-6">
          <ProgramaSemanal />
          <VidaMinisterioSemanal />
          <div id="reunion-publica-semanal">
            <ReunionPublicaSemanal />
          </div>
          {puedeVerAsignacionesServicio && <AsignacionesServicioSemanal />}
        </div>
        <div className="order-1 lg:order-2 w-full lg:w-72 xl:w-80 2xl:w-96 flex-shrink-0">
          <MisAsignaciones />
        </div>
      </div>
    </div>
  );
};

export default Inicio;
