import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Trash2, Map as MapIcon, Printer, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useGruposPredicacion, GrupoPredicacion } from "@/hooks/useGruposPredicacion";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useCatalogos } from "@/hooks/useCatalogos";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { AgregarParticipanteGrupoModal } from "@/components/grupos-predicacion/AgregarParticipanteGrupoModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { usePermisos } from "@/hooks/usePermisos";

type StatKey = "publicador" | "anciano" | "siervo_ministerial" | "precursor_regular" | "publicador_no_bautizado" | "PIN";

const STATS: { key: StatKey; abbr: string; label: string; color: string; cardBg?: string }[] = [
  { key: "publicador", abbr: "PB", label: "Total", color: "bg-sky-200 text-sky-800", cardBg: "bg-sky-100 border-sky-300" },
  { key: "anciano", abbr: "A", label: "Ancianos", color: "bg-green-200 text-green-800" },
  { key: "siervo_ministerial", abbr: "SM", label: "Siervos Ministeriales", color: "bg-orange-200 text-orange-800" },
  { key: "precursor_regular", abbr: "PR", label: "Precursores Regulares", color: "bg-yellow-200 text-yellow-800" },
  { key: "publicador_no_bautizado", abbr: "PNB", label: "Publicadores No Bautizados", color: "bg-indigo-200 text-indigo-800" },
  { key: "PIN", abbr: "PIN", label: "Publicadores Inactivos", color: "bg-red-200 text-red-800" },
];

function participanteMatches(m: any, key: StatKey): boolean {
  const resps: string[] = Array.isArray(m.responsabilidad) ? m.responsabilidad : [m.responsabilidad].filter(Boolean);
  if (key === "PIN") return !!m.es_publicador_inactivo;
  if (key === "publicador") return true;
  if (m.es_publicador_inactivo) return false;
  return resps.includes(key);
}

const RESPONSABILIDAD_COLORS: Record<string, string> = {
  anciano: "bg-green-500 text-white",
  siervo_ministerial: "bg-orange-400 text-white",
  precursor_regular: "bg-yellow-400 text-black",
  publicador: "bg-sky-400 text-white",
};

const RESPONSABILIDAD_BORDER_COLORS: Record<string, string> = {
  anciano: "border-green-500 text-green-600",
  siervo_ministerial: "border-orange-400 text-orange-500",
  precursor_regular: "border-yellow-400 text-yellow-500",
};

const RESPONSABILIDAD_ABBR: Record<string, string> = {
  anciano: "A",
  siervo_ministerial: "SM",
  precursor_regular: "PR",
  publicador: "P",
};

const BADGES_TO_SHOW = ["anciano", "siervo_ministerial", "precursor_regular"];

function getResponsabilidadBadges(responsabilidades: string | string[]): string[] {
  const arr = Array.isArray(responsabilidades) ? responsabilidades : [responsabilidades];
  return BADGES_TO_SHOW.filter(r => arr.includes(r));
}

function contarResponsabilidades(miembros: any[]): Record<string, number> {
  const counts: Record<string, number> = { anciano: 0, siervo_ministerial: 0, precursor_regular: 0 };
  miembros.forEach(m => {
    if (m.es_publicador_inactivo) return;
    const resps = Array.isArray(m.responsabilidad) ? m.responsabilidad : [m.responsabilidad];
    BADGES_TO_SHOW.forEach(r => { if (resps.includes(r)) counts[r]++; });
  });
  return counts;
}

export default function GruposPredicacionPage() {
  const { grupos, isLoading: loadingGrupos, sincronizarGrupos } = useGruposPredicacion();
  const { participantes, isLoading: loadingParticipantes, actualizarParticipante } = useParticipantes();
  const { configuraciones, isLoading: loadingConfig } = useConfiguracionSistema("general");
  const { territorios } = useCatalogos();
  const { canEdit, canDelete } = usePermisos();
  const puedeEditar = canEdit("configuracion_grupos");
  const puedeEliminar = canDelete("configuracion_grupos");
  
  const [numeroGruposConfig, setNumeroGruposConfig] = useState<number | null>(null);
  const [modalAgregar, setModalAgregar] = useState<GrupoPredicacion | null>(null);
  const [confirmRemover, setConfirmRemover] = useState<{ id: string; nombre: string } | null>(null);
  const [configCargada, setConfigCargada] = useState(false);
  const [statModal, setStatModal] = useState<StatKey | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const territoriosPorGrupo = useMemo(() => {
    const map = new Map<string, string[]>();
    (territorios || []).forEach((t: any) => {
      (t.grupos_predicacion_ids || []).forEach((gid: string) => {
        if (!map.has(gid)) map.set(gid, []);
        map.get(gid)!.push(t.numero);
      });
    });
    map.forEach((arr, k) => {
      arr.sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return a.localeCompare(b);
      });
    });
    return map;
  }, [territorios]);

  const totalesGlobales = useMemo(() => {
    const out: Record<StatKey, number> = {
      precursor_regular: 0, anciano: 0, siervo_ministerial: 0,
      publicador: 0, publicador_no_bautizado: 0, PIN: 0,
    };
    (participantes || []).forEach((p: any) => {
      STATS.forEach(s => { if (participanteMatches(p, s.key)) out[s.key]++; });
    });
    return out;
  }, [participantes]);

  useEffect(() => {
    if (!loadingConfig && configuraciones) {
      const gruposConfig = configuraciones.find(
        (c) => c.programa_tipo === "general" && c.clave === "numero_grupos"
      );
      const cantidad = gruposConfig?.valor?.cantidad ?? 10;
      setNumeroGruposConfig(cantidad);
      setConfigCargada(true);
    }
  }, [configuraciones, loadingConfig]);

  useEffect(() => {
    if (configCargada && numeroGruposConfig !== null && numeroGruposConfig > 0 && puedeEditar) {
      sincronizarGrupos.mutate(numeroGruposConfig);
    }
  }, [numeroGruposConfig, configCargada, puedeEditar]);

  const isLoading = loadingGrupos || loadingParticipantes || loadingConfig;

  const getParticipantesPorGrupo = (grupoId: string) => {
    return participantes.filter(p => p.grupo_predicacion_id === grupoId);
  };

  const handleAsignar = (participanteId: string, grupoId: string) => {
    actualizarParticipante.mutate({ id: participanteId, grupo_predicacion_id: grupoId });
  };

  const handleRemover = () => {
    if (!confirmRemover) return;
    actualizarParticipante.mutate({ id: confirmRemover.id, grupo_predicacion_id: null });
    setConfirmRemover(null);
  };

  function renderStatsCards({ isPreview = false }: { isPreview?: boolean } = {}) {
    return (
      <div className="stats-grid grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {STATS.map(s => {
          const isTotal = s.key === "publicador";
          const statInner = (
            <>
              <span className={cn("stat-circle w-10 h-10 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0", s.color)}>
                {s.abbr}
              </span>
              {isTotal ? (
                <div className="flex flex-col items-center">
                  <div className="text-2xl font-extrabold leading-none text-sky-900">{totalesGlobales[s.key]}</div>
                  <div className="text-[10px] uppercase tracking-wide text-sky-800/80 font-semibold mt-1">{s.label}</div>
                </div>
              ) : (
                <div className={cn("text-2xl font-extrabold leading-none", s.key === "PIN" ? "text-red-800" : "text-sky-900")}>{totalesGlobales[s.key]}</div>
              )}
            </>
          );
          if (isPreview) {
            return (
              <div key={s.key} className={cn("stat-card border rounded-xl p-3 shadow-sm flex items-center gap-3", isTotal ? s.cardBg : "bg-card justify-center")}>
                {statInner}
              </div>
            );
          }
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatModal(s.key)}
              className={cn(
                "stat-card border rounded-xl p-3 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 flex items-center gap-3",
                isTotal ? s.cardBg : "bg-card justify-center"
              )}
              title={`Ver detalle por grupo · ${s.label}`}
            >
              {statInner}
            </button>
          );
        })}
      </div>
    );
  }

  function renderGruposGrid({ isPreview = false }: { isPreview?: boolean } = {}) {
    if (grupos && grupos.length === 0) {
      return (
        <div className="bg-primary/5 rounded-xl p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            No hay grupos configurados. Ve a Ajustes del Sistema → General para configurar el número de grupos.
          </p>
        </div>
      );
    }
    return (
      <div className="grupos-grid grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {grupos?.map((grupo) => {
          const miembros = getParticipantesPorGrupo(grupo.id);

          const sup = miembros.find(m => m.responsabilidad_adicional === "superintendente_grupo" && !(m as any).es_publicador_inactivo);
          const aux = miembros.find(m => m.responsabilidad_adicional === "auxiliar_grupo" && !(m as any).es_publicador_inactivo);
          const activos = miembros.filter(m =>
            m.responsabilidad_adicional !== "superintendente_grupo" &&
            m.responsabilidad_adicional !== "auxiliar_grupo" &&
            !(m as any).es_publicador_inactivo
          ).sort((a, b) => a.apellido.localeCompare(b.apellido));
          const inactivos = miembros.filter(m => (m as any).es_publicador_inactivo)
            .sort((a, b) => a.apellido.localeCompare(b.apellido));

          const listaOrdenada = [
            ...(sup ? [{ ...sup, rol: "SUP" as string | null }] : []),
            ...(aux ? [{ ...aux, rol: "AUX" as string | null }] : []),
            ...activos.map(m => ({ ...m, rol: null as string | null })),
            ...inactivos.map(m => ({ ...m, rol: null as string | null })),
          ];

          return (
            <div
              key={grupo.id}
              className="grupo-card bg-card border rounded-xl overflow-hidden shadow-sm"
            >
              <div className="grupo-header bg-sky-600 text-white px-3 py-2.5 flex items-center justify-between">
                <h3 className="text-sm font-extrabold">
                  GRUPO NRO. {grupo.numero}
                </h3>
                <div className="flex gap-1 items-center flex-wrap justify-end max-w-[65%]">
                  {(territoriosPorGrupo.get(grupo.id) || []).length === 0 ? (
                    <span className="text-[10px] text-white/70 italic flex items-center gap-1">
                      <MapIcon className="h-3 w-3" /> sin territorios
                    </span>
                  ) : (
                    <>
                      <span className="text-[9px] leading-tight text-white/90 font-semibold uppercase text-right mr-1">
                        Territorios<br/>Asignados
                      </span>
                      {(territoriosPorGrupo.get(grupo.id) || []).map(num => (
                        <span
                          key={num}
                          className="terr-chip min-w-[28px] h-7 px-1.5 rounded-full border-2 border-white/80 bg-white/95 text-sky-700 flex items-center justify-center text-[10px] font-bold"
                          title={`Territorio ${num}`}
                        >
                          {num}
                        </span>
                      ))}
                    </>
                  )}

                  {!isPreview && puedeEditar && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-white/20 hover:text-white ml-1 no-print"
                      onClick={() => setModalAgregar(grupo)}
                      title="Agregar participante"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className={cn(isPreview ? "" : "divide-y divide-border")}>
                {listaOrdenada.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground text-xs">
                    Sin miembros asignados
                  </div>
                ) : (
                  listaOrdenada.map((miembro, idx) => {
                    const badges = getResponsabilidadBadges(miembro.responsabilidad);
                    const isLeader = miembro.rol === "SUP" || miembro.rol === "AUX";
                    const isInactivo = (miembro as any).es_publicador_inactivo;

                    return (
                      <div
                        key={miembro.id}
                        className={cn(
                          "miembro-row flex items-center gap-2 px-3 py-1.5 group",
                          isLeader && "leader-row bg-green-50 dark:bg-green-950/30",
                          isInactivo && "bg-amber-50/50 dark:bg-amber-950/10 opacity-60"
                        )}
                      >
                        <span className="text-[11px] font-medium text-muted-foreground w-5">
                          {idx + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "text-[11px]",
                            isLeader && "font-bold",
                            isInactivo && "italic"
                          )}>
                            {miembro.apellido.toUpperCase()},
                          </span>
                          <span className={cn(
                            "text-[11px] ml-1",
                            isLeader && "font-bold",
                            isInactivo && "italic"
                          )}>
                            {miembro.nombre.toUpperCase()}
                            {miembro.rol && (
                              <span className="ml-1">({miembro.rol})</span>
                            )}
                          </span>
                          {isInactivo && (
                            <span className="ml-1.5 text-[9px] text-red-600 font-semibold">(INACTIVO)</span>
                          )}
                        </div>

                        <div className="flex gap-0.5 items-center">
                          {!isInactivo && badges.map(badge => (
                            <span
                              key={badge}
                              className={cn(
                                "resp-badge px-1.5 py-0.5 rounded text-[10px] font-bold min-w-[26px] text-center",
                                RESPONSABILIDAD_COLORS[badge]
                              )}
                            >
                              {RESPONSABILIDAD_ABBR[badge]}
                            </span>
                          ))}
                          {!isPreview && puedeEliminar && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 ml-1 no-print"
                              onClick={() => setConfirmRemover({ id: miembro.id, nombre: `${miembro.apellido}, ${miembro.nombre}` })}
                              title="Remover del grupo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderGruposBody({ isPreview = false }: { isPreview?: boolean } = {}) {
    return (
      <>
        {renderStatsCards({ isPreview })}
        <div className="mt-6">
          {renderGruposGrid({ isPreview })}
        </div>
      </>
    );
  }

  // Layout dedicado de impresión / vista previa:
  // Título centrado → Grupos (con separación) → Tarjetas al final
  function renderPrintLayout() {
    return (
      <div className="print-layout">
        <div className="print-title">
          <h1>GRUPOS DE PREDICACIÓN</h1>
          <p>Vista de grupos con sus miembros asignados</p>
        </div>
        <div className="print-grupos">
          {renderGruposGrid({ isPreview: true })}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" id="grupos-print-root">
      <style>{`
        /* ====== Estilos compartidos del layout impreso (preview + print) ====== */
        .print-layout {
          color: #000;
          font-size: 5.8px;
          line-height: 1.05;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .print-layout * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .print-layout .print-title { text-align: center; margin-bottom: 4px; }
        .print-layout .print-title h1 { font-size: 12px; font-weight: 800; margin: 0; letter-spacing: 0.3px; }
        .print-layout .print-title p { font-size: 7px; color: #555; margin: 1px 0 0; }
        .print-layout .print-grupos { margin-bottom: 0; }
        .print-layout .grupos-grid { display: grid !important; grid-template-columns: repeat(3, 1fr) !important; gap: 6px !important; }
        .print-layout .grupo-card { border: 1px solid #cbd5e1 !important; border-radius: 5px !important; overflow: hidden; box-shadow: none !important; background: #fff !important; break-inside: avoid; }
        .print-layout .grupo-header { background: #0284c7 !important; color: #fff !important; padding: 2px 5px !important; display: flex; align-items: center; justify-content: space-between; }
        .print-layout .grupo-header h3 { font-size: 8px !important; font-weight: 800; margin: 0; color: #fff !important; }
        .print-layout .grupo-header .terr-chip { background: #fff !important; color: #0369a1 !important; border: 1.5px solid #fff !important; min-width: 12px; height: 10px; padding: 0 2px; font-size: 6px !important; }
        .print-layout .grupo-header span.uppercase { font-size: 5px !important; line-height: 1 !important; }
        .print-layout .miembro-row { padding: 0 5px !important; gap: 3px !important; line-height: 1.05 !important; height: 11px !important; min-height: 11px !important; }
        .print-layout .miembro-row span { font-size: 5.8px !important; line-height: 1.05 !important; }
        .print-layout .leader-row { background: #dcfce7 !important; }
        .print-layout .resp-badge { font-size: 5px !important; padding: 0 2px !important; min-width: 11px !important; line-height: 1 !important; height: 8px !important; }
        .print-layout .resp-badge.bg-green-500 { background: #22c55e !important; color: #fff !important; }
        .print-layout .resp-badge.bg-orange-400 { background: #fb923c !important; color: #fff !important; }
        .print-layout .resp-badge.bg-yellow-400 { background: #facc15 !important; color: #000 !important; }

        /* ====== Print: ocultar página normal, mostrar solo print-only ====== */
        @media print {
          @page { size: letter portrait; margin: 0.3in; }
          html, body { background: #fff !important; }
          body * { visibility: hidden !important; }
          #grupos-print-root .print-only, #grupos-print-root .print-only * { visibility: visible !important; }
          #grupos-print-root .print-only { position: absolute !important; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; }
          .no-print { display: none !important; }
        }
        /* En pantalla, ocultar el bloque dedicado de impresión */
        @media screen { #grupos-print-root > .print-only { display: none; } }
      `}</style>

      {/* Bloque dedicado SOLO para impresión */}
      <div className="print-only">
        {renderPrintLayout()}
      </div>

      <div className="flex items-center gap-3 no-print">
        <Users className="h-7 w-7 text-primary" />
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">Grupos de Predicación</h1>
          <p className="text-sm text-muted-foreground">
            Vista de grupos con sus miembros asignados
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPreviewOpen(true)}
                className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
                aria-label="Vista previa"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Vista previa</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => window.print()}
                className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600"
                aria-label="Imprimir PDF"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Imprimir PDF</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="no-print">
        {renderGruposBody()}
      </div>

      {/* Modal agregar participante */}
      {modalAgregar && grupos && (
        <AgregarParticipanteGrupoModal
          open={!!modalAgregar}
          onOpenChange={(v) => !v && setModalAgregar(null)}
          grupoDestino={modalAgregar}
          participantes={participantes}
          grupos={grupos}
          onAsignar={handleAsignar}
        />
      )}

      {/* Confirmación remover */}
      <ConfirmDeleteDialog
        open={!!confirmRemover}
        onOpenChange={(v) => !v && setConfirmRemover(null)}
        onConfirm={handleRemover}
        title="¿Remover del grupo?"
        description={`¿Estás seguro que deseas remover a "${confirmRemover?.nombre}" de este grupo? El participante quedará sin grupo asignado.`}
      />

      {/* Modal detalle de estadística por grupo */}
      <Dialog open={!!statModal} onOpenChange={(v) => !v && setStatModal(null)}>
        <DialogContent className="max-w-md">
          {statModal && (() => {
            const stat = STATS.find(s => s.key === statModal)!;
            const filas = (grupos || []).map(g => {
              const miembros = (participantes || []).filter((p: any) => p.grupo_predicacion_id === g.id);
              const count = miembros.filter((m: any) => participanteMatches(m, stat.key)).length;
              return { id: g.id, numero: g.numero, count };
            });
            const total = filas.reduce((s, f) => s + f.count, 0);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold", stat.color)}>
                      {stat.abbr}
                    </span>
                    {stat.label} <span className="text-muted-foreground font-normal">· {total}</span>
                  </DialogTitle>
                </DialogHeader>
                <div className="mt-2 max-h-[60vh] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left px-3 py-2 font-bold uppercase text-xs">Grupo</th>
                        <th className="text-right px-3 py-2 font-bold uppercase text-xs">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map(f => (
                        <tr key={f.id} className="border-b last:border-0">
                          <td className="px-3 py-2">Grupo Nro. {f.numero}</td>
                          <td className="px-3 py-2 text-right font-semibold">{f.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/50 font-bold">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right">{total}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal Vista Previa: simula exactamente el PDF carta vertical */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa - Grupos de Predicación (Carta vertical)</DialogTitle>
          </DialogHeader>
          <div
            className="mx-auto bg-white shadow-lg"
            style={{ width: "8.5in", minHeight: "11in", padding: "0.4in", boxSizing: "border-box" }}
          >
            {renderPrintLayout()}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
