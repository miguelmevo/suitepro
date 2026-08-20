import { Fragment, useState } from "react";
import { ScrollText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuditLog, TABLAS_AUDITADAS, AuditLogEntry } from "@/hooks/useAuditLog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const OPERACION_LABEL: Record<string, string> = {
  INSERT: "Creó",
  UPDATE: "Modificó",
  DELETE: "Eliminó",
};

const OPERACION_COLOR: Record<string, string> = {
  INSERT: "text-emerald-600 bg-emerald-500/10",
  UPDATE: "text-amber-600 bg-amber-500/10",
  DELETE: "text-red-600 bg-red-500/10",
};

function FilaDetalle({ entrada }: { entrada: AuditLogEntry }) {
  if (entrada.operacion === "UPDATE") {
    const campos = entrada.campos_modificados || [];
    if (campos.length === 0) {
      return <p className="text-sm text-muted-foreground">No se detectaron campos cambiados.</p>;
    }
    return (
      <div className="space-y-2">
        {campos.map((campo) => (
          <div key={campo} className="grid grid-cols-[140px_1fr_auto_1fr] items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">{campo}</span>
            <span className="rounded bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1 truncate">
              {formatValor(entrada.datos_anteriores?.[campo])}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 truncate">
              {formatValor(entrada.datos_nuevos?.[campo])}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const datos = entrada.operacion === "DELETE" ? entrada.datos_anteriores : entrada.datos_nuevos;
  if (!datos) return null;

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {Object.entries(datos)
        .filter(([k]) => !["id", "created_at", "updated_at"].includes(k))
        .map(([key, value]) => (
          <div key={key} className="flex gap-2 min-w-0">
            <span className="font-medium text-muted-foreground shrink-0">{key}:</span>
            <span className="truncate">{formatValor(value)}</span>
          </div>
        ))}
    </div>
  );
}

function formatValor(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export default function Auditoria() {
  const [tabla, setTabla] = useState<string>("");
  const [operacion, setOperacion] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [expandido, setExpandido] = useState<string | null>(null);

  const { entradas, total, isLoading, pageSize } = useAuditLog({
    tabla: tabla || undefined,
    operacion: operacion || undefined,
    busqueda: busqueda || undefined,
    pagina,
  });

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoría</h1>
        <p className="text-muted-foreground">
          Quién hizo qué cambio, cuándo y en qué registro — en todo el sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-4 w-4 text-muted-foreground" />
            Registro de cambios
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </CardTitle>
          <CardDescription>Se guarda automáticamente en cada creación, edición o eliminación.</CardDescription>

          <div className="flex flex-wrap gap-2 pt-3">
            <Select value={tabla || "todas"} onValueChange={(v) => { setTabla(v === "todas" ? "" : v); setPagina(0); }}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Todas las tablas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las tablas</SelectItem>
                {TABLAS_AUDITADAS.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={operacion || "todas"} onValueChange={(v) => { setOperacion(v === "todas" ? "" : v); setPagina(0); }}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Toda operación" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda operación</SelectItem>
                <SelectItem value="INSERT">Creaciones</SelectItem>
                <SelectItem value="UPDATE">Modificaciones</SelectItem>
                <SelectItem value="DELETE">Eliminaciones</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Buscar por email del usuario..."
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(0); }}
              className="w-[240px]"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : entradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay registros con estos filtros.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8" />
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Tabla</TableHead>
                    <TableHead>Fecha</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entradas.map((e) => (
                    <Fragment key={e.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => setExpandido(expandido === e.id ? null : e.id)}
                      >
                        <TableCell>
                          {expandido === e.id ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">{e.user_email || "Sistema"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={cn(OPERACION_COLOR[e.operacion])}>
                            {OPERACION_LABEL[e.operacion] || e.operacion}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">{e.tabla}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(e.created_at), "d MMM yyyy, HH:mm:ss", { locale: es })}
                        </TableCell>
                      </TableRow>
                      {expandido === e.id && (
                        <TableRow>
                          <TableCell colSpan={5} className="bg-muted/30">
                            <FilaDetalle entrada={e} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Página {pagina + 1} de {totalPaginas}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" disabled={pagina + 1 >= totalPaginas} onClick={() => setPagina((p) => p + 1)}>
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
