import { Radio, History, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUsuariosConectados } from "@/hooks/useUserPresence";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

export default function Sesiones() {
  const {
    usuariosConectados,
    historialSesiones,
    loadingPresence,
    loadingHistorial,
    congregacionesMap,
  } = useUsuariosConectados();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sesiones</h1>
        <p className="text-muted-foreground">
          Quién está conectado ahora y el historial de inicios de sesión
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radio className="h-4 w-4 text-emerald-500" />
            Usuarios conectados
          </CardTitle>
          <CardDescription>
            Se considera "conectado" a quien tuvo actividad en los últimos 5 minutos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingPresence ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : usuariosConectados.length === 0 ? (
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
                  <TableHead>Última actividad</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usuariosConectados.map((u) => (
                  <TableRow key={u.id}>
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
                      {formatDistanceToNow(new Date(u.last_seen), { addSuffix: true, locale: es })}
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
            Historial de inicios de sesión
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
                  <TableHead>Fecha de inicio</TableHead>
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
