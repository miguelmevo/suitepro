import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Loader2, History } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCongregacionId } from "@/contexts/CongregacionContext";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territorioId: string | null;
  territorioLabel: string;
}

interface Row {
  id: string;
  letra: string;
  fecha_trabajada: string;
  marcado_por: string;
  ciclo_numero: number | null;
}

export function HistorialManzanasModal({ open, onOpenChange, territorioId, territorioLabel }: Props) {
  const congregacionId = useCongregacionId();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["historial-manzanas-territorio", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_trabajadas")
        .select("id, fecha_trabajada, marcado_por, manzanas_territorio!inner(letra), ciclos_territorio(ciclo_numero)")
        .eq("territorio_id", territorioId!)
        .eq("congregacion_id", congregacionId!)
        .order("fecha_trabajada", { ascending: false });
      if (error) throw error;

      const userIds = Array.from(new Set((data || []).map((d: any) => d.marcado_por).filter(Boolean)));
      const nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: parts } = await supabase
          .from("participantes")
          .select("user_id, nombre, apellido")
          .in("user_id", userIds);
        (parts || []).forEach((p: any) => {
          if (p.user_id) nameMap[p.user_id] = `${p.nombre} ${p.apellido}`;
        });
      }

      return (data || []).map((d: any) => ({
        id: d.id,
        letra: d.manzanas_territorio?.letra ?? "—",
        fecha_trabajada: d.fecha_trabajada,
        marcado_por: nameMap[d.marcado_por] || "—",
        ciclo_numero: d.ciclos_territorio?.ciclo_numero ?? null,
      })) as Row[];
    },
    enabled: !!territorioId && !!congregacionId && open,
  });

  const totalManzanas = useMemo(() => rows.length, [rows]);
  const personas = useMemo(() => new Set(rows.map((r) => r.marcado_por)).size, [rows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de manzanas — Territorio {territorioLabel}
          </DialogTitle>
          <DialogDescription>
            Registro completo de quién trabajó cada manzana y cuándo, a través de todos los ciclos.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no hay manzanas registradas en este territorio.
          </p>
        ) : (
          <>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{totalManzanas} registros</Badge>
              <Badge variant="secondary">{personas} {personas === 1 ? "persona" : "personas"}</Badge>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Manzana</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="w-[130px]">Fecha</TableHead>
                    <TableHead className="w-[80px] text-center">Ciclo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <Badge variant="outline" className="px-2 font-bold">{r.letra}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{r.marcado_por}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(r.fecha_trabajada + "T12:00:00"), "dd MMM yyyy", { locale: es })}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {r.ciclo_numero ? `#${r.ciclo_numero}` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
