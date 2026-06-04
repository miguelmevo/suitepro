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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  territorioId: string | null;
  territorioLabel: string;
}

interface RawRow {
  id: string;
  letra: string;
  fecha_trabajada: string;
  marcado_por: string;
  responsable_nombre: string;
}

interface GroupedRow {
  key: string;
  letras: string[];
  fecha_trabajada: string;
  responsable: string;
}

export function HistorialManzanasModal({ open, onOpenChange, territorioId, territorioLabel }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["historial-manzanas-territorio-publico", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_historial_manzanas_territorio_publico", { _territorio_id: territorioId! });
      if (error) throw error;
      return (data || []) as RawRow[];
    },
    enabled: !!territorioId && open,
  });

  const grouped = useMemo<GroupedRow[]>(() => {
    const map = new Map<string, GroupedRow>();
    for (const r of rows) {
      const key = `${r.fecha_trabajada}|${r.marcado_por || r.responsable_nombre}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          letras: [],
          fecha_trabajada: r.fecha_trabajada,
          responsable: r.responsable_nombre,
        });
      }
      map.get(key)!.letras.push(r.letra);
    }
    // sort letras alfabéticamente; fecha ya viene desc del RPC
    const arr = Array.from(map.values()).map((g) => ({
      ...g,
      letras: [...g.letras].sort((a, b) => a.localeCompare(b)),
    }));
    arr.sort((a, b) => b.fecha_trabajada.localeCompare(a.fecha_trabajada));
    return arr;
  }, [rows]);

  const personas = useMemo(() => new Set(grouped.map((g) => g.responsable)).size, [grouped]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de manzanas — Territorio {territorioLabel}
          </DialogTitle>
          <DialogDescription>
            Registro de quién trabajó manzanas y cuándo, agrupado por fecha y responsable.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : grouped.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Aún no hay manzanas registradas en este territorio.
          </p>
        ) : (
          <>
            <div className="flex gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{grouped.length} {grouped.length === 1 ? "registro" : "registros"}</Badge>
              <Badge variant="secondary">{personas} {personas === 1 ? "persona" : "personas"}</Badge>
            </div>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Manzanas</TableHead>
                    <TableHead>Responsable</TableHead>
                    <TableHead className="w-[130px]">Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.map((g) => (
                    <TableRow key={g.key}>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {g.letras.map((l) => (
                            <Badge key={l} variant="outline" className="px-2 font-bold">{l}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{g.responsable}</TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(g.fecha_trabajada + "T12:00:00"), "dd MMM yyyy", { locale: es })}
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
