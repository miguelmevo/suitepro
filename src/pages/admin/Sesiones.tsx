import { Fragment, useState } from "react";
import { Radio, History, ScrollText, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useUsuariosConectados } from "@/hooks/useUserPresence";
import { useAuditLog, TABLAS_AUDITADAS, labelDeCampo, AuditLogEntry } from "@/hooks/useAuditLog";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function formatValor(v: unknown, resolverMap: Record<string, string>): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string" && UUID_RE.test(v)) return resolverMap[v] || v;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function FilaDetalle({ entrada, resolverMap }: { entrada: AuditLogEntry; resolverMap: Record<string, string> }) {
  if (entrada.operacion === "UPDATE") {
    const campos = (entrada.campos_modificados || []).filter((c) => !["updated_at"].includes(c));
    if (campos.length === 0) {
      return <p className="text-sm text-muted-foreground">No se detectaron campos cambiados.</p>;
    }
    return (
      <div className="space-y-2">
        {campos.map((campo) => (
          <div key={campo} className="grid grid-cols-[160px_1fr_auto_1fr] items-center gap-2 text-sm">
            <span className="font-medium text-muted-foreground">{labelDeCampo(campo)}</span>
            <span className="rounded bg-red-500/10 text-red-700 dark:text-red-400 px-2 py-1 truncate">
              {formatValor(entrada.datos_anteriores?.[campo], resolverMap)}
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 truncate">
              {formatValor(entrada.datos_nuevos?.[campo], resolverMap)}
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
            <span className="font-medium text-muted-foreground shrink-0">{labelDeCampo(key)}:</span>
            <span className="truncate">{formatValor(value, resolverMap)}</span>
          </div>
        ))}
    </div>
  );
}

function TabAuditoria() {
  const [tabla, setTabla] = useState<string>("");
  const [operacion, setOperacion] = useState<string>("");
  const [busqueda, setBusqueda] = useState("");
  const [pagina, setPagina] = useState(0);
  const [expandido, setExpandido] = useState<string | null>(null);

  const { entradas, total, isLoading, pageSize, resolverMap } = useAuditLog({
    tabla: tabla || undefined,
    operacion: operacion || undefined,
    busqueda: busqueda || undefined,
    pagina,
  });

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
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
                          <FilaDetalle entrada={e} resolverMap={resolverMap} />
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
  );
}

function TabEnVivo() {
  const {
    usuariosConectados,
    historialSesiones,
    loadingHistorial,
    congregacionesMap,
  } = useUsuariosConectados();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-4 w-4 text-emerald-500 animate-pulse" />
            Usuarios conectados
            <Badge variant="secondary" className="ml-1">{usuariosConectados.length}</Badge>
          </CardTitle>
          <CardDescription>
            En vivo — se actualiza al instante cuando alguien entra o sale, sin necesidad de recargar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {usuariosConectados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay usuarios conectados en este momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Congregación</TableHead>
                  <TableHead>Página actual</TableHead>
                  <TableHead>Conectado desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosConectados.map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium">{u.nombre_completo || u.email}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      {u.congregacion_id ? congregacionesMap[u.congregacion_id] || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.current_page || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(u.online_at), { addSuffix: true, locale: es })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-4 w-4 text-muted-foreground" />
            Historial de sesiones
          </CardTitle>
          <CardDescription>Últimas 200 sesiones registradas, más recientes primero.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingHistorial ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : historialSesiones.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Todavía no hay sesiones registradas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Congregación</TableHead>
                  <TableHead>Entró</TableHead>
                  <TableHead>Salió</TableHead>
                  <TableHead>Dispositivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historialSesiones.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.nombre_completo || s.email}</div>
                      <div className="text-xs text-muted-foreground">{s.email}</div>
                    </TableCell>
                    <TableCell>
                      {s.congregacion_id ? congregacionesMap[s.congregacion_id] || "—" : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(s.fecha_login), "d MMM yyyy, HH:mm", { locale: es })}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.fecha_logout ? (
                        <span className="text-muted-foreground">
                          {format(new Date(s.fecha_logout), "d MMM yyyy, HH:mm", { locale: es })}
                        </span>
                      ) : (
                        <Badge variant="secondary" className="text-emerald-600 bg-emerald-500/10">
                          Activa
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={s.user_agent || undefined}>
                      {s.user_agent || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Sesiones() {
  return (
    <Tabs defaultValue="en-vivo" className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sesiones</h1>
          <p className="text-muted-foreground">
            Quién está conectado ahora, el historial de inicios/cierres de sesión, y la auditoría de cambios
          </p>
        </div>
        <TabsList className="shrink-0">
          <TabsTrigger value="en-vivo">Sesiones</TabsTrigger>
          <TabsTrigger value="auditoria">Auditoría</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="en-vivo" className="mt-0">
        <TabEnVivo />
      </TabsContent>
      <TabsContent value="auditoria" className="mt-0">
        <TabAuditoria />
      </TabsContent>
    </Tabs>
  );
}
