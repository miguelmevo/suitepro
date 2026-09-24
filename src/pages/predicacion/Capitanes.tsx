import { useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Check, Loader2, Lock, Plus, Search, Trash2, UserCheck, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, SortableTableHead } from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePermisos } from "@/hooks/usePermisos";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useCapitanesAutorizados, type CapitanAutorizado } from "@/hooks/useCapitanesAutorizados";
import { QuitarCapitanDialog } from "@/components/predicacion/QuitarCapitanDialog";
import { cn } from "@/lib/utils";

type FiltroUsuario = "todos" | "con" | "sin";

const FILTROS: { value: FiltroUsuario; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "con", label: "Con usuario" },
  { value: "sin", label: "Sin usuario" },
];

const Marca = ({ ok }: { ok: boolean | null }) =>
  ok === null ? (
    <span className="text-muted-foreground">—</span>
  ) : ok ? (
    <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-label="Sí" />
  ) : (
    <X className="h-4 w-4 text-red-600 dark:text-red-400" aria-label="No" />
  );

function CapitanesEscritorio() {
  const { canCreate, canDelete } = usePermisos();
  const puedeCrear = canCreate("predicacion_capitanes_lista");
  const puedeEliminar = canDelete("predicacion_capitanes_lista");
  const soloLectura = !puedeCrear && !puedeEliminar;

  const { capitanes, isLoading, agregar, quitar } = useCapitanesAutorizados();
  const { participantes, isLoading: cargandoParticipantes } = useParticipantes();

  const [seleccionado, setSeleccionado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<FiltroUsuario>("todos");
  const [aQuitar, setAQuitar] = useState<CapitanAutorizado | null>(null);

  // Solo varones aprobados y activos que todavía no son capitanes.
  const disponibles = useMemo(
    () =>
      (participantes ?? [])
        .filter((p) => p.activo && p.estado_aprobado && (p as any).genero === "M" && !p.es_capitan_grupo)
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)),
    [participantes],
  );

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return capitanes
      .filter((c) => (filtro === "con" ? c.tiene_usuario : filtro === "sin" ? !c.tiene_usuario : true))
      .filter((c) => !q || `${c.apellido} ${c.nombre}`.toLowerCase().includes(q) || `${c.nombre} ${c.apellido}`.toLowerCase().includes(q))
      .map((c) => ({ ...c, email_orden: c.email ?? "", cuenta_orden: c.cuenta_activa === null ? -1 : c.cuenta_activa ? 1 : 0 }));
  }, [capitanes, busqueda, filtro]);

  const { sortedData, sortConfig, requestSort } = useTableSort(filas, { key: "apellido", direction: "asc" });

  const conUsuario = capitanes.filter((c) => c.tiene_usuario).length;

  const handleAgregar = async () => {
    if (!seleccionado) return;
    await agregar.mutateAsync(seleccionado);
    setSeleccionado("");
  };

  if (isLoading || cargandoParticipantes) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Capitanes</h1>

      {soloLectura && (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800/70 dark:text-amber-300/70">
            Solo puedes consultar la información.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Capitanes autorizados
          </CardTitle>
          <CardDescription>
            Participantes con "Capitán de Grupo" marcado en su ficha. Agregar o quitar un capitán aquí actualiza esa marca.
            {" "}{capitanes.length} en total, {conUsuario} con usuario en SuitePro.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Búsqueda, filtro y alta en una sola fila */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full sm:w-[260px]">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar capitán..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Filtrar por usuario">
              {FILTROS.map((f) => (
                <Button
                  key={f.value}
                  type="button"
                  size="sm"
                  variant={filtro === f.value ? "default" : "ghost"}
                  className={cn("h-7 px-3", filtro !== f.value && "text-muted-foreground")}
                  onClick={() => setFiltro(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {puedeCrear && (
              <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                <Select value={seleccionado} onValueChange={setSeleccionado}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Seleccionar participante..." />
                  </SelectTrigger>
                  <SelectContent>
                    {disponibles.length > 0 ? (
                      disponibles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.apellido}, {p.nombre}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="_none" disabled>
                        No hay más varones aprobados para agregar
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Button onClick={handleAgregar} disabled={!seleccionado || agregar.isPending} className="shrink-0">
                  {agregar.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Agregar
                </Button>
              </div>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead sortKey="apellido" currentSort={sortConfig} onSort={requestSort}>Nombre</SortableTableHead>
                <SortableTableHead sortKey="tiene_usuario" currentSort={sortConfig} onSort={requestSort} className="text-center">Usuario SuitePro</SortableTableHead>
                <SortableTableHead sortKey="cuenta_orden" currentSort={sortConfig} onSort={requestSort} className="text-center">Usuario activo</SortableTableHead>
                <SortableTableHead sortKey="email_orden" currentSort={sortConfig} onSort={requestSort}>Correo</SortableTableHead>
                {puedeEliminar && <TableHead className="w-[100px]">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length > 0 ? (
                sortedData.map((c) => (
                  <TableRow key={c.participante_id}>
                    <TableCell className="font-medium">{c.apellido}, {c.nombre}</TableCell>
                    <TableCell><div className="flex justify-center"><Marca ok={c.tiene_usuario} /></div></TableCell>
                    <TableCell><div className="flex justify-center"><Marca ok={c.tiene_usuario ? !!c.cuenta_activa : null} /></div></TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    {puedeEliminar && (
                      <TableCell>
                        <Button variant="ghost" size="icon" title="Quitar capitán" onClick={() => setAQuitar(c)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={puedeEliminar ? 5 : 4} className="text-center text-muted-foreground py-8">
                    {capitanes.length === 0
                      ? "No hay capitanes configurados. Agrega participantes con el selector de arriba."
                      : "Ningún capitán coincide con el filtro."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <QuitarCapitanDialog
        capitan={aQuitar}
        capitanes={capitanes}
        isPending={quitar.isPending}
        onCancel={() => setAQuitar(null)}
        onConfirm={async (reemplazos) => {
          if (!aQuitar) return;
          try {
            await quitar.mutateAsync({ participanteId: aQuitar.participante_id, reemplazos });
            setAQuitar(null);
          } catch {
            // el hook ya avisó el error; el diálogo queda abierto para reintentar
          }
        }}
      />
    </div>
  );
}


/** Lista sencilla para teléfono: Nombre | Usuario | Borrar, con lupa para buscar. */
function CapitanesMovil({ puedeCrear, puedeEliminar }: { puedeCrear: boolean; puedeEliminar: boolean }) {
  const { capitanes, isLoading, agregar, quitar } = useCapitanesAutorizados();
  const { participantes, isLoading: cargandoParticipantes } = useParticipantes();

  const [seleccionado, setSeleccionado] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [aQuitar, setAQuitar] = useState<CapitanAutorizado | null>(null);

  const disponibles = useMemo(
    () =>
      (participantes ?? [])
        .filter((p) => p.activo && p.estado_aprobado && (p as any).genero === "M" && !p.es_capitan_grupo)
        .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`)),
    [participantes],
  );

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return capitanes.filter(
      (c) => !q || `${c.apellido} ${c.nombre}`.toLowerCase().includes(q) || `${c.nombre} ${c.apellido}`.toLowerCase().includes(q),
    );
  }, [capitanes, busqueda]);

  const cerrarBusqueda = () => {
    setBuscando(false);
    setBusqueda("");
  };

  if (isLoading || cargandoParticipantes) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Capitanes <span className="text-sm font-normal text-muted-foreground">({capitanes.length})</span></h1>
        <Button variant="ghost" size="icon" onClick={() => (buscando ? cerrarBusqueda() : setBuscando(true))} aria-label={buscando ? "Cerrar búsqueda" : "Buscar"}>
          {buscando ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
        </Button>
      </div>

      {buscando && (
        <Input autoFocus placeholder="Buscar capitán..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      )}

      {puedeCrear && (
        <div className="flex items-center gap-2">
          <Select value={seleccionado} onValueChange={setSeleccionado}>
            <SelectTrigger className="flex-1 min-w-0">
              <SelectValue placeholder="Agregar capitán..." />
            </SelectTrigger>
            <SelectContent>
              {disponibles.length > 0 ? (
                disponibles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.apellido}, {p.nombre}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="_none" disabled>
                  No hay más varones aprobados para agregar
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Button
            size="icon"
            className="shrink-0"
            disabled={!seleccionado || agregar.isPending}
            aria-label="Agregar capitán"
            onClick={async () => {
              try {
                await agregar.mutateAsync(seleccionado);
                setSeleccionado("");
              } catch {
                // el hook ya avisó el error
              }
            }}
          >
            {agregar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
          <span>Nombre</span>
          <span className="w-14 text-center">Usuario</span>
          <span className="w-9 text-center">{puedeEliminar ? "Borrar" : ""}</span>
        </div>
        {filas.length > 0 ? (
          filas.map((c) => (
            <div key={c.participante_id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 border-b last:border-b-0">
              <span className="truncate text-sm">{c.apellido}, {c.nombre}</span>
              <span className="w-14 flex justify-center"><Marca ok={c.tiene_usuario} /></span>
              <span className="w-9 flex justify-center">
                {puedeEliminar && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Quitar capitán" onClick={() => setAQuitar(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </span>
            </div>
          ))
        ) : (
          <p className="text-center text-sm text-muted-foreground py-6">
            {capitanes.length === 0 ? "No hay capitanes configurados." : "Ningún capitán coincide con la búsqueda."}
          </p>
        )}
      </div>

      <QuitarCapitanDialog
        capitan={aQuitar}
        capitanes={capitanes}
        isPending={quitar.isPending}
        onCancel={() => setAQuitar(null)}
        onConfirm={async (reemplazos) => {
          if (!aQuitar) return;
          try {
            await quitar.mutateAsync({ participanteId: aQuitar.participante_id, reemplazos });
            setAQuitar(null);
          } catch {
            // el hook ya avisó el error; el diálogo queda abierto para reintentar
          }
        }}
      />
    </div>
  );
}

/**
 * Teléfono: lista sencilla, requiere el permiso "Capitanes (móvil)".
 * Tablet y escritorio: tabla completa, requiere "Capitanes autorizados".
 */
export default function Capitanes() {
  const isMobile = useIsMobile();
  const { loading, canView, canCreate, canDelete } = usePermisos();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isMobile) {
    if (!canView("predicacion_capitanes_movil")) {
      return (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
          <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-800/70 dark:text-amber-300/70">
            Esta página no está disponible en la versión móvil para tu usuario.
          </AlertDescription>
        </Alert>
      );
    }
    return (
      <CapitanesMovil
        puedeCrear={canCreate("predicacion_capitanes_movil")}
        puedeEliminar={canDelete("predicacion_capitanes_movil")}
      />
    );
  }

  if (!canView("predicacion_capitanes_lista")) return <Navigate to="/" replace />;
  return <CapitanesEscritorio />;
}
