import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ValorPuesto {
  participante_id: string | null;
  grupo_id: string | null;
}

export interface PuestoAjuste {
  tipo: string;
  label: string;
  kind: "individual" | "grupo";
  /** Responsabilidad de la ficha que habilita a la persona para este puesto. */
  resp?: string;
  /** Valor que se ve hoy (programa + ajustes ya aceptados). */
  actual: ValorPuesto;
  /** Valor del programa del mes (sin ajustes). */
  base: ValorPuesto;
}

interface Props {
  congregacionId: string;
  fecha: string;
  puestos: PuestoAjuste[];
  /** Personas con esa responsabilidad (ya filtradas), más la asignada hoy si no estuviera. */
  opcionesPersonas: (resp: string | undefined, actualId: string | null) => { id: string; nombre: string }[];
  grupos: { id: string; numero: number }[];
  onCerrar: () => void;
}

const claveBorrador = (congregacionId: string, fecha: string) => `suitepro-ajustes-hoy:${congregacionId}:${fecha}`;

export function hayBorradorAjustes(congregacionId: string | null | undefined, fecha: string | undefined): boolean {
  if (!congregacionId || !fecha) return false;
  try {
    return !!localStorage.getItem(claveBorrador(congregacionId, fecha));
  } catch {
    return false;
  }
}

const norm = (v: string | null | undefined) => v || null;
const igual = (a: ValorPuesto, b: ValorPuesto) => norm(a.participante_id) === norm(b.participante_id) && norm(a.grupo_id) === norm(b.grupo_id);

/**
 * Edición temporal de las asignaciones de un día. Mientras no se acepta, los cambios son un
 * borrador solo de este navegador (se conserva si se recarga). Al aceptar se guardan como
 * "ajuste del día" y todos lo ven por encima del programa del mes, que no se modifica.
 */
export function AjustesHoyPanel({ congregacionId, fecha, puestos, opcionesPersonas, grupos, onCerrar }: Props) {
  const queryClient = useQueryClient();
  const clave = claveBorrador(congregacionId, fecha);
  const [valores, setValores] = useState<Record<string, ValorPuesto>>(() => {
    const base: Record<string, ValorPuesto> = {};
    puestos.forEach((p) => (base[p.tipo] = { ...p.actual }));
    try {
      const guardado = JSON.parse(localStorage.getItem(clave) || "null");
      if (guardado && typeof guardado === "object") {
        puestos.forEach((p) => {
          if (guardado[p.tipo]) base[p.tipo] = guardado[p.tipo];
        });
      }
    } catch {
      /* sin borrador */
    }
    return base;
  });
  const [guardando, setGuardando] = useState(false);

  const hayCambios = puestos.some((p) => !igual(valores[p.tipo] ?? p.actual, p.actual));

  useEffect(() => {
    try {
      if (hayCambios) localStorage.setItem(clave, JSON.stringify(valores));
      else localStorage.removeItem(clave);
    } catch {
      /* sin almacenamiento: el borrador solo vive en pantalla */
    }
  }, [valores, hayCambios, clave]);

  const cambiar = (tipo: string, v: ValorPuesto) => setValores((prev) => ({ ...prev, [tipo]: v }));

  const descartar = () => {
    try {
      localStorage.removeItem(clave);
    } catch {
      /* nada */
    }
    onCerrar();
  };

  const aceptar = async () => {
    setGuardando(true);
    try {
      const finales = puestos.map((p) => ({ p, v: valores[p.tipo] ?? p.actual }));
      // Ajustes = solo lo que difiere del programa del mes
      const ajustes = finales
        .filter(({ p, v }) => !igual(v, p.base))
        .map(({ p, v }) => ({ tipo: p.tipo, participante_id: v.participante_id, grupo_id: v.grupo_id }));
      const { error } = await (supabase as any).rpc("guardar_ajustes_servicio_dia", {
        _congregacion_id: congregacionId,
        _fecha: fecha,
        _ajustes: ajustes,
      });
      if (error) throw error;

      // Avisar solo a quien ENTRA a cubrir (distinto de quien estaba hoy)
      const entran = finales
        .filter(({ p, v }) => p.kind === "individual" && v.participante_id && v.participante_id !== p.actual.participante_id)
        .map(({ p, v }) => ({ participanteId: v.participante_id as string, tipo: p.tipo }));
      if (entran.length > 0) {
        supabase.functions
          .invoke("avisar-ajuste-servicio", { body: { congregacionId, fecha, entran } })
          .catch((e) => console.warn("No se pudo avisar a quienes entran:", e));
      }

      try {
        localStorage.removeItem(clave);
      } catch {
        /* nada */
      }
      await queryClient.invalidateQueries({ queryKey: ["asig-servicio-ajustes"] });
      await queryClient.invalidateQueries({ queryKey: ["mis-asignaciones-servicio"] });
      toast.success("Ajustes aceptados: ya los ven todos");
      onCerrar();
    } catch (e: any) {
      toast.error(e?.message === "not_authorized" ? "No tienes permiso para hacer ajustes" : "No se pudieron guardar los ajustes");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
      <div>
        <div className="text-sm font-bold uppercase tracking-wide">Ajustes para hoy</div>
        <p className="text-xs text-muted-foreground">
          Cambia quién cumple cada asignación solo por hoy. Hasta que aceptes, son un borrador tuyo; al aceptar los verá todo el mundo y el
          programa del mes no se modifica.
        </p>
      </div>

      <div className="space-y-2">
        {puestos.map((p) => {
          const v = valores[p.tipo] ?? p.actual;
          const cambiado = !igual(v, p.actual);
          return (
            <div key={p.tipo} className={`flex items-center gap-2 rounded-md p-1.5 ${cambiado ? "bg-amber-500/10 ring-1 ring-amber-500/40" : ""}`}>
              <span className="w-36 shrink-0 text-[13px] font-semibold leading-tight">{p.label}</span>
              {p.kind === "individual" ? (
                <Select
                  value={v.participante_id ?? "none"}
                  onValueChange={(x) => cambiar(p.tipo, { participante_id: x === "none" ? null : x, grupo_id: null })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin asignar —</SelectItem>
                    {opcionesPersonas(p.resp, p.actual.participante_id).map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={v.grupo_id ?? "none"}
                  onValueChange={(x) => cambiar(p.tipo, { participante_id: null, grupo_id: x === "none" ? null : x })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin asignar —</SelectItem>
                    {grupos.map((g) => (
                      <SelectItem key={g.id} value={g.id}>Grupo {g.numero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Restaurar esta línea al programa del mes"
                disabled={igual(v, p.base)}
                onClick={() => cambiar(p.tipo, { ...p.base })}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={descartar} disabled={guardando}>Descartar</Button>
        <Button size="sm" onClick={aceptar} disabled={guardando || !hayCambios}>
          {guardando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Aceptar y compartir con todos
        </Button>
      </div>
    </div>
  );
}
