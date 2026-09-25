import { useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface FilaPapelera {
  id: string;
  territorio_id: string;
  ciclo: { ciclo_numero: number; fecha_inicio: string; fecha_fin: string | null; completado: boolean };
  manzanas: { fecha_trabajada: string }[];
  eliminado_por: string | null;
  eliminado_at: string;
  purgar_despues: string;
}

const fmt = (d: string) => format(new Date(d.slice(0, 10) + "T12:00:00"), "dd/MM/yyyy");

interface Props {
  congregacionId: string;
  /** id de territorio → número, para mostrar de cuál era cada ciclo. */
  numeroDeTerritorio: (id: string) => string;
}

/**
 * Ciclos eliminados o reiniciados: se conservan 6 meses y un administrador
 * puede restituirlos. Solo la ven administradores (y el super admin).
 */
export function PapeleraCiclos({ congregacionId, numeroDeTerritorio }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, isSuperAdmin, getRoleInCongregacion } = useAuthContext();
  const veLaPapelera = isSuperAdmin() || isAdmin() || getRoleInCongregacion(congregacionId) === "admin";
  const [aRestituir, setARestituir] = useState<FilaPapelera | null>(null);
  const [errorRestituir, setErrorRestituir] = useState<string | null>(null);

  const { data: filas = [], isLoading } = useQuery({
    queryKey: ["papelera-ciclos", congregacionId],
    enabled: veLaPapelera,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ciclos_territorio_papelera" as any)
        .select("id, territorio_id, ciclo, manzanas, eliminado_por, eliminado_at, purgar_despues")
        .eq("congregacion_id", congregacionId)
        .order("eliminado_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FilaPapelera[];
    },
  });

  const { data: nombres = {} } = useQuery({
    queryKey: ["papelera-ciclos-nombres", filas.map((f) => f.eliminado_por).join(",")],
    enabled: filas.length > 0,
    queryFn: async () => {
      const ids = [...new Set(filas.map((f) => f.eliminado_por).filter(Boolean))] as string[];
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("id, nombre, apellido").in("id", ids);
      return Object.fromEntries((data ?? []).map((p) => [p.id, `${p.nombre ?? ""} ${p.apellido ?? ""}`.trim()]));
    },
  });

  const restituir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.rpc as any)("restituir_ciclo_territorio", { _papelera_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of [
        "papelera-ciclos", "historial-ciclos-admin", "manzanas-trabajadas-activas", "ciclo-activo",
        "manzanas-trabajadas", "s13-ciclos", "s13-terminado-por",
      ]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({ title: "Ciclo restituido" });
      setARestituir(null);
    },
    onError: (e: Error) => {
      setARestituir(null);
      setErrorRestituir(e.message);
    },
  });

  if (!veLaPapelera) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Trash2 className="h-4 w-4" />
            Papelera de ciclos
          </CardTitle>
          <CardDescription>
            Ciclos eliminados o reiniciados. Se conservan 6 meses y luego se borran definitivamente. Solo los ven los administradores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filas.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">La papelera está vacía.</p>
          ) : (
            <div className="divide-y rounded-md border">
              {filas.map((f) => {
                const fechas = f.manzanas.map((m) => m.fecha_trabajada).sort();
                const desde = fechas[0] ?? f.ciclo.fecha_inicio;
                const hasta = f.ciclo.completado ? (fechas[fechas.length - 1] ?? f.ciclo.fecha_fin ?? desde) : null;
                return (
                  <div key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">
                        Territorio {numeroDeTerritorio(f.territorio_id)} · Ciclo #{f.ciclo.ciclo_numero}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({f.ciclo.completado ? "cerrado" : "en progreso"}, {f.manzanas.length} manzana{f.manzanas.length !== 1 ? "s" : ""})
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {fmt(desde)} al {hasta ? fmt(hasta) : "sin terminar"} · eliminado el {fmt(f.eliminado_at)}
                        {f.eliminado_por && nombres[f.eliminado_por] ? ` por ${nombres[f.eliminado_por]}` : ""} · se borra el {fmt(f.purgar_despues)}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1.5" disabled={restituir.isPending} onClick={() => setARestituir(f)}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      Restituir
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!aRestituir} onOpenChange={(v) => !v && !restituir.isPending && setARestituir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restituir este ciclo?</AlertDialogTitle>
            <AlertDialogDescription>
              {aRestituir && `El ciclo #${aRestituir.ciclo.ciclo_numero} del territorio ${numeroDeTerritorio(aRestituir.territorio_id)} volverá al historial con sus manzanas. Solo se puede si sus fechas no coinciden con otro ciclo del territorio.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restituir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={restituir.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (aRestituir) restituir.mutate(aRestituir.id);
              }}
            >
              {restituir.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Restituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!errorRestituir} onOpenChange={(v) => !v && setErrorRestituir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>No se pudo restituir</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{errorRestituir}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorRestituir(null)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
