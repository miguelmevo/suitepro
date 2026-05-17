import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
// Nota: navegación interna interceptada por listener de clicks (sin useBlocker).
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Gem,
  Wheat,
  Eraser,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ImpresionVidaMinisterio } from "@/components/vida-ministerio/ImpresionVidaMinisterio";
import { useParticipantes } from "@/hooks/useParticipantes";

// Icono simple de oveja (lucide no incluye uno)
const SheepIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <ellipse cx="12" cy="14" rx="7" ry="5" />
    <circle cx="7" cy="11" r="2.2" />
    <circle cx="6" cy="18" r="1.2" />
    <circle cx="9" cy="19.5" r="1.2" />
    <circle cx="15" cy="19.5" r="1.2" />
    <circle cx="18" cy="18" r="1.2" />
  </svg>
);

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

import { ParticipanteSelector } from "@/components/vida-ministerio/ParticipanteSelector";
import { MaestrosRepeater } from "@/components/vida-ministerio/MaestrosRepeater";
import { VidaCristianaRepeater } from "@/components/vida-ministerio/VidaCristianaRepeater";
import { DuracionInput, extraerMinutosDeTitulo } from "@/components/vida-ministerio/DuracionInput";

import {
  useGuardarProgramaVidaMinisterio,
  useProgramaVidaMinisterioByFecha,
} from "@/hooks/useProgramaVidaMinisterio";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

import type {
  EstudioBiblicoBlock,
  LecturaBiblicaBlock,
  MaestroDiscurso,
  TesorosBlock,
  VidaCristianaParte,
} from "@/types/vida-ministerio";

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function fechaInputToISO(s: string): string {
  return s;
}

export default function EditorVidaMinisterio() {
  const { fecha } = useParams<{ fecha: string }>();
  const navigate = useNavigate();
  const { roles, isAdminOrEditorInCongregacion } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || "";

  const fechaInicial = fecha || format(getMonday(new Date()), "yyyy-MM-dd");
  const [fechaSemana, setFechaSemana] = useState<string>(fechaInicial);

  // Sincronizar con URL cuando cambia el param (al confirmar navegación a otra semana)
  useEffect(() => {
    if (fecha && fecha !== fechaSemana) {
      setFechaSemana(fecha);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const { data: existente, isLoading } = useProgramaVidaMinisterioByFecha(fechaSemana);
  const guardar = useGuardarProgramaVidaMinisterio();
  const { getConfigValue, isLoading: isLoadingConfig } = useConfiguracionSistema("vida_ministerio");

  const isSuperAdmin = roles.includes("super_admin");
  const isSvMinisterio = roles.includes("svministerio");
  const canEdit =
    isSuperAdmin || isSvMinisterio || (congregacionId && isAdminOrEditorInCongregacion(congregacionId));

  // Estado del formulario
  const [presidenteId, setPresidenteId] = useState<string | null>(null);
  const [canticoInicial, setCanticoInicial] = useState<string>("");
  const [canticoIntermedio, setCanticoIntermedio] = useState<string>("");
  const [canticoFinal, setCanticoFinal] = useState<string>("");
  const [oracionInicialId, setOracionInicialId] = useState<string | null>(null);
  const [oracionFinalId, setOracionFinalId] = useState<string | null>(null);

  const [tesoros, setTesoros] = useState<TesorosBlock>({ titulo: "", participante_id: null });
  const [perlasId, setPerlasId] = useState<string | null>(null);
  const [lecturaBiblica, setLecturaBiblica] = useState<LecturaBiblicaBlock>({
    cita: "",
    participante_id: null,
  });

  const [maestros, setMaestros] = useState<MaestroDiscurso[]>([]);
  const [salasOverride, setSalasOverride] = useState<number | null>(null);
  const [encargadoSalaB, setEncargadoSalaB] = useState<string | null>(null);
  const [encargadoSalaC, setEncargadoSalaC] = useState<string | null>(null);

  const [vidaCristiana, setVidaCristiana] = useState<VidaCristianaParte[]>([]);
  const [estudioBiblico, setEstudioBiblico] = useState<EstudioBiblicoBlock>({
    titulo: "",
    conductor_id: null,
    lector_id: null,
  });

  const [notas, setNotas] = useState("");
  const [lecturaSemana, setLecturaSemana] = useState("");
  const [estado, setEstado] = useState<"borrador" | "completo">("borrador");

  const salasGlobales = (getConfigValue("salas_auxiliares")?.cantidad as number | undefined) ?? 0;
  const salasEffective = salasOverride ?? salasGlobales;

  // Snapshot original para detectar cambios
  const originalRef = useRef<string>("");

  const buildSnapshot = () =>
    JSON.stringify({
      presidenteId,
      canticoInicial,
      canticoIntermedio,
      canticoFinal,
      oracionInicialId,
      oracionFinalId,
      tesoros,
      perlasId,
      lecturaBiblica,
      maestros,
      salasOverride,
      encargadoSalaB,
      encargadoSalaC,
      vidaCristiana,
      estudioBiblico,
      notas,
      lecturaSemana,
      estado,
    });

  // Defaults de duración (configurables en Ajustes)
  const defCanticos = (getConfigValue("duracion_canticos")?.minutos as number | undefined) ?? 5;
  const defPalIni = (getConfigValue("duracion_palabras_iniciales")?.minutos as number | undefined) ?? 1;
  const defPalConc = (getConfigValue("duracion_palabras_conclusion")?.minutos as number | undefined) ?? 3;

  const buildTesorosVacio = (): TesorosBlock => ({
    titulo: "",
    participante_id: null,
    presidente_duracion: defPalIni,
    cantico_inicial_duracion: defCanticos,
    cantico_intermedio_duracion: defCanticos,
  });
  const buildEstudioVacio = (): EstudioBiblicoBlock => ({
    titulo: "",
    conductor_id: null,
    lector_id: null,
    palabras_conclusion_duracion: defPalConc,
    cantico_final_duracion: defCanticos,
  });

  const limpiarFormulario = () => {
    setPresidenteId(null);
    setCanticoInicial("");
    setCanticoIntermedio("");
    setCanticoFinal("");
    setOracionInicialId(null);
    setOracionFinalId(null);
    setTesoros(buildTesorosVacio());
    setPerlasId(null);
    setLecturaBiblica({ cita: "", participante_id: null });
    setMaestros([]);
    setSalasOverride(null);
    setEncargadoSalaB(null);
    setEncargadoSalaC(null);
    setVidaCristiana([]);
    setEstudioBiblico(buildEstudioVacio());
    setNotas("");
    setLecturaSemana("");
    setEstado("borrador");
  };

  const [confirmLimpiarOpen, setConfirmLimpiarOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [missingFieldsOpen, setMissingFieldsOpen] = useState(false);
  const { participantes = [] } = useParticipantes();
  const { getConfigValue: getConfigGeneral } = useConfiguracionSistema("general");
  const horaInicioVyM = (getConfigGeneral("dias_reunion") as { hora_entre_semana?: string } | undefined)?.hora_entre_semana || "19:30";
  const consejoMaestrosMins = (getConfigValue("consejo_presidente_maestros")?.minutos as number | undefined) ?? 0;
  const mesAnioVyM = useMemo(() => {
    try {
      const martes = addDays(parseISO(fechaSemana), 1);
      return format(martes, "MMMM yyyy", { locale: es });
    } catch {
      return "";
    }
  }, [fechaSemana]);

  // Cargar datos existentes (o resetear si está vacío)
  useEffect(() => {
    if (existente) {
      setPresidenteId(existente.presidente_id);
      setCanticoInicial(existente.cantico_inicial?.toString() ?? "");
      setCanticoIntermedio(existente.cantico_intermedio?.toString() ?? "");
      setCanticoFinal(existente.cantico_final?.toString() ?? "");
      setOracionInicialId(existente.oracion_inicial_id);
      setOracionFinalId(existente.oracion_final_id);
      setTesoros(existente.tesoros);
      setPerlasId(existente.perlas_id);
      setLecturaBiblica(existente.lectura_biblica);
      setMaestros(existente.maestros);
      setSalasOverride(existente.salas_auxiliares_override);
      setEncargadoSalaB(existente.encargado_sala_b_id);
      setEncargadoSalaC(existente.encargado_sala_c_id);
      setVidaCristiana(existente.vida_cristiana);
      setEstudioBiblico(existente.estudio_biblico);
      setNotas(existente.notas ?? "");
      setLecturaSemana((existente as any).lectura_semana ?? "");
      setEstado(existente.estado);
    } else if (!isLoading && !isLoadingConfig) {
      // Semana sin programa → formulario en blanco con defaults (esperar a que carguen las configs)
      limpiarFormulario();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existente, isLoading, isLoadingConfig, fechaSemana]);

  // Tomar snapshot original DESPUÉS de cargar datos
  useEffect(() => {
    if (isLoading) return;
    // Pequeño tick para asegurar que el estado se ha asentado
    const t = setTimeout(() => {
      originalRef.current = buildSnapshot();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, existente, fechaSemana]);

  const isDirty = originalRef.current !== "" && originalRef.current !== buildSnapshot();
  useUnsavedChangesGuard(isDirty);

  // Diálogo de cambios sin guardar
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const guardWith = (action: () => void) => {
    if (isDirty) {
      setPendingNav(() => action);
      setConfirmOpen(true);
    } else {
      action();
    }
  };

  // Interceptar clicks en enlaces internos (sidebar, menú) cuando hay cambios
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#") || anchor.target === "_blank") return;
      // Mismo path → no interceptar
      if (href === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingNav(() => () => navigate(href));
      setConfirmOpen(true);
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [navigate]);

  const rangoSemana = useMemo(() => {
    try {
      const lunes = parseISO(fechaSemana);
      const domingo = addDays(lunes, 6);
      return `${format(lunes, "EEEE d 'de' MMMM", { locale: es })} al ${format(
        domingo,
        "EEEE d 'de' MMMM yyyy",
        { locale: es }
      )}`;
    } catch {
      return "";
    }
  }, [fechaSemana]);

  const handleGuardar = async (nuevoEstado?: "borrador" | "completo") => {
    const targetEstado = nuevoEstado ?? estado;
    await guardar.mutateAsync({
      fecha_semana: fechaInputToISO(fechaSemana),
      presidente_id: presidenteId,
      cantico_inicial: canticoInicial ? parseInt(canticoInicial, 10) : null,
      cantico_intermedio: canticoIntermedio ? parseInt(canticoIntermedio, 10) : null,
      cantico_final: canticoFinal ? parseInt(canticoFinal, 10) : null,
      oracion_inicial_id: oracionInicialId,
      oracion_final_id: oracionFinalId,
      tesoros: tesoros as any,
      perlas_id: perlasId,
      lectura_biblica: lecturaBiblica as any,
      maestros: maestros as any,
      salas_auxiliares_override: salasOverride,
      encargado_sala_b_id: salasEffective >= 1 ? encargadoSalaB : null,
      encargado_sala_c_id: salasEffective >= 2 ? encargadoSalaC : null,
      vida_cristiana: vidaCristiana as any,
      estudio_biblico: estudioBiblico as any,
      notas: notas || null,
      lectura_semana: lecturaSemana || null,
      estado: targetEstado,
    } as any);
    setEstado(targetEstado);
    // Resetear snapshot al estado recién guardado
    setTimeout(() => {
      originalRef.current = buildSnapshot();
    }, 0);
  };

  // Lista de campos faltantes para "Marcar como completo"
  const missingFields = useMemo(() => {
    const m: string[] = [];
    if (!presidenteId) m.push("Presidente de la reunión");
    if (!lecturaSemana.trim()) m.push("Lectura Bíblica semanal");
    if (!canticoInicial) m.push("Cántico inicial");
    if (!oracionInicialId) m.push("Oración inicial");
    if (!tesoros.titulo.trim()) m.push("Tesoros de la Biblia: título");
    if (!tesoros.participante_id) m.push("Tesoros de la Biblia: asignado");
    if (!tesoros.duracion) m.push("Tesoros de la Biblia: minutos");
    if (!perlasId) m.push("Perlas escondidas: asignado");
    if (!lecturaBiblica.cita.trim()) m.push("Lectura Bíblica: cita");
    if (!lecturaBiblica.participante_id) m.push("Lectura Bíblica: estudiante");
    if (!lecturaBiblica.duracion) m.push("Lectura Bíblica: minutos");
    if (maestros.length === 0) m.push("Seamos Mejores Maestros: agregar al menos una parte");
    maestros.forEach((mm, i) => {
      if (!mm.titulo.trim()) m.push(`Maestros parte ${i + 1}: título`);
      if (!mm.titular_id) m.push(`Maestros parte ${i + 1}: titular`);
      if (!mm.duracion) m.push(`Maestros parte ${i + 1}: minutos`);
    });
    if (salasEffective >= 1 && !encargadoSalaB) m.push("Encargado Sala B");
    if (salasEffective >= 2 && !encargadoSalaC) m.push("Encargado Sala C");
    if (!canticoIntermedio) m.push("Cántico intermedio");
    if (vidaCristiana.length === 0) m.push("Nuestra Vida Cristiana: agregar al menos una parte");
    vidaCristiana.forEach((v, i) => {
      if (!v.titulo.trim()) m.push(`Vida Cristiana parte ${i + 1}: título`);
      if (!v.participante_id) m.push(`Vida Cristiana parte ${i + 1}: asignado`);
      if (!v.duracion) m.push(`Vida Cristiana parte ${i + 1}: minutos`);
    });
    if (estudioBiblico.visita_superintendente) {
      if (!estudioBiblico.titulo_discurso?.trim()) m.push("Estudio bíblico: título del discurso (SC)");
      if (!estudioBiblico.conductor_id) m.push("Estudio bíblico: asignado (SC)");
    } else {
      if (!estudioBiblico.titulo.trim()) m.push("Estudio bíblico: material / lectura");
      if (!estudioBiblico.conductor_id) m.push("Estudio bíblico: conductor");
      if (!estudioBiblico.lector_id) m.push("Estudio bíblico: lector");
    }
    if (!estudioBiblico.duracion) m.push("Estudio bíblico: minutos");
    if (!canticoFinal) m.push("Cántico final");
    if (!oracionFinalId) m.push("Oración final");
    return m;
  }, [
    presidenteId, canticoInicial, canticoIntermedio, canticoFinal,
    oracionInicialId, oracionFinalId, tesoros, perlasId, lecturaBiblica,
    lecturaSemana, maestros, salasEffective, encargadoSalaB, encargadoSalaC,
    vidaCristiana, estudioBiblico,
  ]);
  const isComplete = missingFields.length === 0;

  // Resetear validación visual al cambiar de semana o cargar
  useEffect(() => {
    setShowErrors(false);
  }, [fechaSemana]);

  // Auto-marcar como completo cuando todos los campos están llenos
  useEffect(() => {
    if (!canEdit) return;
    if (!isComplete) {
      if (estado === "completo") setEstado("borrador");
      return;
    }
    if (estado !== "completo" && !guardar.isPending) {
      handleGuardar("completo");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isComplete, canEdit]);

  // Al hacer clic en "Marcar como completo"
  const handleMarcarCompleto = () => {
    if (missingFields.length > 0) {
      setShowErrors(true);
      setMissingFieldsOpen(true);
      return;
    }
    handleGuardar("completo");
  };

  const irASemana = (deltaDias: number) => {
    const lunesActual = parseISO(fechaSemana);
    const nuevoLunes = addDays(lunesActual, deltaDias);
    const nuevaFecha = format(nuevoLunes, "yyyy-MM-dd");
    guardWith(() => navigate(`/vida-y-ministerio/${nuevaFecha}`));
  };

  const volverALista = () => {
    guardWith(() => navigate("/vida-y-ministerio"));
  };

  const handleConfirmGuardar = async () => {
    setConfirmOpen(false);
    await handleGuardar();
    pendingNav?.();
    setPendingNav(null);
  };

  const handleConfirmDescartar = () => {
    setConfirmOpen(false);
    // Forzar que no haya dirty: marcar snapshot como actual
    originalRef.current = buildSnapshot();
    pendingNav?.();
    setPendingNav(null);
  };

  const handleConfirmCancelar = () => {
    setConfirmOpen(false);
    setPendingNav(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={volverALista}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reunión Vida y Ministerio</h1>
            <p className="text-sm text-muted-foreground capitalize">{rangoSemana}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPreviewOpen(true)}
            className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
            aria-label="Vista previa"
            title="Vista previa"
          >
            <Eye className="h-4 w-4" />
          </Button>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setConfirmLimpiarOpen(true)}
              disabled={guardar.isPending}
              className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-600"
              aria-label="Limpiar programa"
              title="Vaciar todos los campos del programa"
            >
              <Eraser className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleGuardar("borrador")}
              disabled={guardar.isPending}
              className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600"
              aria-label="Guardar borrador"
              title="Guardar borrador"
            >
              <Save className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleMarcarCompleto}
              disabled={guardar.isPending || isComplete}
              className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600"
              aria-label="Marcar como completo"
              title="Marcar como completo"
            >
              {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            </Button>
          </>
        )}
        </div>
      </div>

      {/* Navegación entre semanas */}
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => irASemana(-7)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Semana anterior
        </Button>
        {!existente && (
          <span className="text-xs text-muted-foreground">
            Sin programa para esta semana — completa los campos y guarda.
          </span>
        )}
        <Button variant="outline" size="sm" onClick={() => irASemana(7)}>
          Semana siguiente
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {!canEdit && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 text-sm">
          Solo lectura: tu rol no permite modificar este programa.
        </div>
      )}

      {/* Cabecera semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">
            Datos de la semana
            {(() => {
              try {
                const martes = addDays(parseISO(fechaSemana), 1);
                return ` - ${format(martes, "EEEE dd 'de' MMMM", { locale: es })}`;
              } catch {
                return "";
              }
            })()}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Fila 1: Presidente | Mins | Lectura | Cántico inicial | Mins | Oración inicial */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_70px_1fr_110px_70px_1fr] gap-3">
            <div className="space-y-1">
              <Label className={showErrors && !presidenteId ? "text-destructive" : ""}>
                Presidente de la reunión{showErrors && !presidenteId && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={presidenteId}
                onChange={setPresidenteId}
                filtro="anciano"
                disabled={!canEdit}
                className={showErrors && !presidenteId ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={tesoros.presidente_duracion}
              onChange={(v) => setTesoros({ ...tesoros, presidente_duracion: v })}
              disabled={!canEdit}
            />
            <div className="space-y-1">
              <Label className={showErrors && !lecturaSemana.trim() ? "text-destructive" : ""}>
                Lectura Bíblia semanal{showErrors && !lecturaSemana.trim() && <span className="ml-1">*</span>}
              </Label>
              <Input
                value={lecturaSemana}
                onChange={(e) => setLecturaSemana(e.target.value)}
                disabled={!canEdit}
                placeholder="Ej: Proverbios 1-3"
                className={showErrors && !lecturaSemana.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <div className="space-y-1">
              <Label className={showErrors && !canticoInicial ? "text-destructive" : ""}>
                Cántico inicial{showErrors && !canticoInicial && <span className="ml-1">*</span>}
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={canticoInicial}
                onChange={(e) => setCanticoInicial(e.target.value)}
                disabled={!canEdit}
                className={showErrors && !canticoInicial ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={tesoros.cantico_inicial_duracion}
              onChange={(v) => setTesoros({ ...tesoros, cantico_inicial_duracion: v })}
              disabled={!canEdit}
            />
            <div className="space-y-1">
              <Label className={showErrors && !oracionInicialId ? "text-destructive" : ""}>
                Oración inicial{showErrors && !oracionInicialId && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={oracionInicialId}
                onChange={setOracionInicialId}
                filtro="aprobado"
                disabled={!canEdit}
                className={showErrors && !oracionInicialId ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
          </div>

          {/* Fila 2: Salas auxiliares con toggle */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Switch
                id="salas-toggle"
                checked={salasOverride !== null && salasOverride > 0}
                onCheckedChange={(checked) => setSalasOverride(checked ? 1 : 0)}
                disabled={!canEdit}
              />
              <Label htmlFor="salas-toggle" className="cursor-pointer">
                Usar salas auxiliares (esta semana)
              </Label>
            </div>
            {salasOverride !== null && salasOverride > 0 && (
              <div className="space-y-1 max-w-md">
                <Label>Cantidad de salas auxiliares</Label>
                <Select
                  value={String(salasOverride)}
                  onValueChange={(v) => setSalasOverride(parseInt(v, 10))}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 (Sala B)</SelectItem>
                    <SelectItem value="2">2 (Sala B y C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* TESOROS */}
      <Card className="border-[#3a6e6f]/30">
        <CardHeader style={{ backgroundColor: "#e8f0f0" }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "#3a6e6f" }}>
            <Gem className="h-5 w-5" />
            TESOROS DE LA BIBLIA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_minmax(0,1fr)] gap-3">
            <div className="space-y-1">
              <Label className={showErrors && !tesoros.titulo.trim() ? "text-destructive" : ""}>
                1. Tesoros de la Biblia (título){showErrors && !tesoros.titulo.trim() && <span className="ml-1">*</span>}
              </Label>
              <Input
                value={tesoros.titulo}
                onChange={(e) => {
                  const titulo = e.target.value;
                  const mins = tesoros.duracion ?? extraerMinutosDeTitulo(titulo);
                  setTesoros({ ...tesoros, titulo, duracion: mins });
                }}
                disabled={!canEdit}
                className={showErrors && !tesoros.titulo.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={tesoros.duracion}
              onChange={(v) => setTesoros({ ...tesoros, duracion: v })}
              disabled={!canEdit}
              error={showErrors && !tesoros.duracion}
            />
            <div className="space-y-1">
              <Label className={showErrors && !tesoros.participante_id ? "text-destructive" : ""}>
                Asignado{showErrors && !tesoros.participante_id && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={tesoros.participante_id}
                onChange={(v) => setTesoros({ ...tesoros, participante_id: v })}
                filtro="anciano_o_sm"
                disabled={!canEdit}
                className={showErrors && !tesoros.participante_id ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px] gap-3 items-end">
            <div className="space-y-1">
              <Label className={showErrors && !perlasId ? "text-destructive" : ""}>
                2. Perlas escondidas{showErrors && !perlasId && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={perlasId}
                onChange={setPerlasId}
                filtro="anciano_o_sm"
                disabled={!canEdit}
                className={showErrors && !perlasId ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={tesoros.perlas_duracion}
              onChange={(v) => setTesoros({ ...tesoros, perlas_duracion: v })}
              disabled={!canEdit}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_minmax(0,1fr)] gap-3">
            <div className="space-y-1">
              <Label className={showErrors && !lecturaBiblica.cita.trim() ? "text-destructive" : ""}>
                3. Lectura Bíblica (cita){showErrors && !lecturaBiblica.cita.trim() && <span className="ml-1">*</span>}
              </Label>
              <Input
                value={lecturaBiblica.cita}
                onChange={(e) => {
                  const cita = e.target.value;
                  const mins = lecturaBiblica.duracion ?? extraerMinutosDeTitulo(cita);
                  setLecturaBiblica({ ...lecturaBiblica, cita, duracion: mins });
                }}
                disabled={!canEdit}
                placeholder="Ej: Génesis 1:1-25"
                className={showErrors && !lecturaBiblica.cita.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={lecturaBiblica.duracion}
              onChange={(v) => setLecturaBiblica({ ...lecturaBiblica, duracion: v })}
              disabled={!canEdit}
              error={showErrors && !lecturaBiblica.duracion}
            />
            <div className="space-y-1">
              <Label className={showErrors && !lecturaBiblica.participante_id ? "text-destructive" : ""}>
                Estudiante{showErrors && !lecturaBiblica.participante_id && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={lecturaBiblica.participante_id}
                onChange={(v) => setLecturaBiblica({ ...lecturaBiblica, participante_id: v })}
                filtro="varon_publicador"
                disabled={!canEdit}
                className={showErrors && !lecturaBiblica.participante_id ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MAESTROS */}
      <Card className="border-[#a78028]/30">
        <CardHeader style={{ backgroundColor: "#f6efdc" }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "#a78028" }}>
            <Wheat className="h-5 w-5" />
            SEAMOS MEJORES MAESTROS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <MaestrosRepeater
            value={maestros}
            onChange={setMaestros}
            disabled={!canEdit}
            salasAuxiliares={salasEffective}
            showErrors={showErrors}
          />

          {salasEffective >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t mt-4">
              <div className="space-y-1">
                <Label className={showErrors && !encargadoSalaB ? "text-destructive" : ""}>
                  Encargado Sala B{showErrors && !encargadoSalaB && <span className="ml-1">*</span>}
                </Label>
                <ParticipanteSelector
                  value={encargadoSalaB}
                  onChange={setEncargadoSalaB}
                  filtro="anciano_o_sm"
                  disabled={!canEdit}
                  className={showErrors && !encargadoSalaB ? "border-destructive ring-1 ring-destructive" : ""}
                />
              </div>
              {salasEffective >= 2 && (
                <div className="space-y-1">
                  <Label className={showErrors && !encargadoSalaC ? "text-destructive" : ""}>
                    Encargado Sala C{showErrors && !encargadoSalaC && <span className="ml-1">*</span>}
                  </Label>
                  <ParticipanteSelector
                    value={encargadoSalaC}
                    onChange={setEncargadoSalaC}
                    filtro="anciano_o_sm"
                    disabled={!canEdit}
                    className={showErrors && !encargadoSalaC ? "border-destructive ring-1 ring-destructive" : ""}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIDA CRISTIANA */}
      <Card className="border-[#a52120]/30">
        <CardHeader style={{ backgroundColor: "#f5e3e1" }}>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: "#a52120" }}>
            <SheepIcon className="h-5 w-5" />
            NUESTRA VIDA CRISTIANA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-[1fr_100px] gap-3 max-w-xs">
            <div className="space-y-1">
              <Label className={showErrors && !canticoIntermedio ? "text-destructive" : ""}>
                Cántico intermedio{showErrors && !canticoIntermedio && <span className="ml-1">*</span>}
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={canticoIntermedio}
                onChange={(e) => setCanticoIntermedio(e.target.value)}
                disabled={!canEdit}
                className={showErrors && !canticoIntermedio ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={tesoros.cantico_intermedio_duracion}
              onChange={(v) => setTesoros({ ...tesoros, cantico_intermedio_duracion: v })}
              disabled={!canEdit}
            />
          </div>

          <VidaCristianaRepeater value={vidaCristiana} onChange={setVidaCristiana} disabled={!canEdit} showErrors={showErrors} />

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-semibold" style={{ color: "#a52120" }}>Estudio bíblico de la congregación</h4>
              <div className="flex items-center gap-2">
                <Switch
                  id="visita-sc"
                  checked={!!estudioBiblico.visita_superintendente}
                  onCheckedChange={(v) =>
                    setEstudioBiblico({
                      ...estudioBiblico,
                      visita_superintendente: v,
                      // Limpiar lector cuando se activa visita SC
                      lector_id: v ? null : estudioBiblico.lector_id,
                      // Reset campos opuestos
                      titulo: v ? "" : estudioBiblico.titulo,
                      titulo_discurso: v ? estudioBiblico.titulo_discurso ?? "" : "",
                      conductor_id: v ? null : estudioBiblico.conductor_id,
                    })
                  }
                  disabled={!canEdit}
                />
                <Label htmlFor="visita-sc" className="text-xs cursor-pointer">
                  Visita del Superintendente de Circuito
                </Label>
              </div>
            </div>
            <div className={`grid grid-cols-1 ${estudioBiblico.visita_superintendente ? "md:grid-cols-[1fr_80px_1fr]" : "md:grid-cols-[1fr_80px_1fr_1fr]"} gap-3`}>
              {estudioBiblico.visita_superintendente ? (
                <>
                  <div className="space-y-1">
                    <Label className={showErrors && !estudioBiblico.titulo_discurso?.trim() ? "text-destructive" : ""}>
                      Título del discurso{showErrors && !estudioBiblico.titulo_discurso?.trim() && <span className="ml-1">*</span>}
                    </Label>
                    <Input
                      value={estudioBiblico.titulo_discurso ?? ""}
                      onChange={(e) =>
                        setEstudioBiblico({ ...estudioBiblico, titulo_discurso: e.target.value })
                      }
                      disabled={!canEdit}
                      className={showErrors && !estudioBiblico.titulo_discurso?.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  </div>
                  <DuracionInput
                    value={estudioBiblico.duracion}
                    onChange={(v) => setEstudioBiblico({ ...estudioBiblico, duracion: v })}
                    disabled={!canEdit}
                  />
                  <div className="space-y-1">
                    <Label className={showErrors && !estudioBiblico.conductor_id ? "text-destructive" : ""}>
                      Asignado (SC){showErrors && !estudioBiblico.conductor_id && <span className="ml-1">*</span>}
                    </Label>
                    <ParticipanteSelector
                      value={estudioBiblico.conductor_id}
                      onChange={(v) => setEstudioBiblico({ ...estudioBiblico, conductor_id: v })}
                      filtro="superintendente_circuito"
                      disabled={!canEdit}
                      className={showErrors && !estudioBiblico.conductor_id ? "border-destructive ring-1 ring-destructive" : ""}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label className={showErrors && !estudioBiblico.titulo.trim() ? "text-destructive" : ""}>
                      Material / lectura{showErrors && !estudioBiblico.titulo.trim() && <span className="ml-1">*</span>}
                    </Label>
                    <Input
                      value={estudioBiblico.titulo}
                      onChange={(e) => setEstudioBiblico({ ...estudioBiblico, titulo: e.target.value })}
                      disabled={!canEdit}
                      className={showErrors && !estudioBiblico.titulo.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  </div>
                  <DuracionInput
                    value={estudioBiblico.duracion}
                    onChange={(v) => setEstudioBiblico({ ...estudioBiblico, duracion: v })}
                    disabled={!canEdit}
                  />
                  <div className="space-y-1">
                    <Label className={showErrors && !estudioBiblico.conductor_id ? "text-destructive" : ""}>
                      Conductor{showErrors && !estudioBiblico.conductor_id && <span className="ml-1">*</span>}
                    </Label>
                    <ParticipanteSelector
                      value={estudioBiblico.conductor_id}
                      onChange={(v) => setEstudioBiblico({ ...estudioBiblico, conductor_id: v })}
                      filtro="anciano"
                      disabled={!canEdit}
                      className={showErrors && !estudioBiblico.conductor_id ? "border-destructive ring-1 ring-destructive" : ""}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className={showErrors && !estudioBiblico.lector_id ? "text-destructive" : ""}>
                      Lector{showErrors && !estudioBiblico.lector_id && <span className="ml-1">*</span>}
                    </Label>
                    <ParticipanteSelector
                      value={estudioBiblico.lector_id}
                      onChange={(v) => setEstudioBiblico({ ...estudioBiblico, lector_id: v })}
                      filtro="lector_atalaya"
                      disabled={!canEdit}
                      className={showErrors && !estudioBiblico.lector_id ? "border-destructive ring-1 ring-destructive" : ""}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CIERRE: Cántico final y Oración final */}
      <Card>
        <CardHeader>
          <div className="flex items-end gap-3">
            <CardTitle className="text-base font-bold pb-2">Palabras de conclusión</CardTitle>
            <div className="w-20">
              <DuracionInput
                value={estudioBiblico.palabras_conclusion_duracion}
                onChange={(v) => setEstudioBiblico({ ...estudioBiblico, palabras_conclusion_duracion: v })}
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_1fr] gap-4">
            <div className="space-y-1">
              <Label className={showErrors && !canticoFinal ? "text-destructive" : ""}>
                Cántico final{showErrors && !canticoFinal && <span className="ml-1">*</span>}
              </Label>
              <Input
                type="number"
                min={1}
                max={200}
                value={canticoFinal}
                onChange={(e) => setCanticoFinal(e.target.value)}
                disabled={!canEdit}
                className={showErrors && !canticoFinal ? "border-destructive focus-visible:ring-destructive" : ""}
              />
            </div>
            <DuracionInput
              value={estudioBiblico.cantico_final_duracion}
              onChange={(v) => setEstudioBiblico({ ...estudioBiblico, cantico_final_duracion: v })}
              disabled={!canEdit}
            />
            <div className="space-y-1">
              <Label className={showErrors && !oracionFinalId ? "text-destructive" : ""}>
                Oración final{showErrors && !oracionFinalId && <span className="ml-1">*</span>}
              </Label>
              <ParticipanteSelector
                value={oracionFinalId}
                onChange={setOracionFinalId}
                filtro="aprobado"
                disabled={!canEdit}
                className={showErrors && !oracionFinalId ? "border-destructive ring-1 ring-destructive" : ""}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* NOTAS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notas adicionales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            disabled={!canEdit}
            rows={3}
            placeholder="Cualquier observación para esta semana..."
          />
        </CardContent>
      </Card>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPreviewOpen(true)}
            className="bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20 text-purple-600"
            aria-label="Vista previa"
            title="Vista previa"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setConfirmLimpiarOpen(true)}
            disabled={guardar.isPending}
            className="bg-red-500/10 border-red-500/30 hover:bg-red-500/20 text-red-600"
            aria-label="Limpiar programa"
            title="Vaciar todos los campos del programa"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleGuardar("borrador")}
            disabled={guardar.isPending}
            className="bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 text-blue-600"
            aria-label="Guardar borrador"
            title="Guardar borrador"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleMarcarCompleto}
            disabled={guardar.isPending || isComplete}
            className="bg-green-500/10 border-green-500/30 hover:bg-green-500/20 text-green-600"
            aria-label="Marcar como completo"
            title="Marcar como completo"
          >
            {guardar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          </Button>
        </div>
      )}

      {/* Navegación inferior entre semanas */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={() => irASemana(-7)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Semana anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => irASemana(7)}>
          Semana siguiente
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>

      {/* Diálogo de cambios sin guardar */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tienes cambios sin guardar</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Quieres guardar los cambios antes de continuar, o prefieres descartarlos?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleConfirmCancelar}>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={handleConfirmDescartar}>
              Descartar
            </Button>
            <AlertDialogAction onClick={handleConfirmGuardar} disabled={guardar.isPending}>
              {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar y continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación de limpieza */}
      <AlertDialog open={confirmLimpiarOpen} onOpenChange={setConfirmLimpiarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Limpiar todo el programa?</AlertDialogTitle>
            <AlertDialogDescription>
              Se vaciarán todos los campos de esta semana para empezar desde cero.
              Los cambios no se guardarán hasta que pulses "Guardar borrador" o "Marcar como completo".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                limpiarFormulario();
                setConfirmLimpiarOpen(false);
              }}
            >
              Sí, limpiar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="capitalize">Vista previa - Vida y Ministerio - {rangoSemana}</DialogTitle>
          </DialogHeader>
          <div className="overflow-auto">
            {existente ? (
              <ImpresionVidaMinisterio
                programas={[existente]}
                participantes={participantes as any}
                congregacionNombre={congregacionActual?.nombre || ""}
                mesAnio={mesAnioVyM}
                horaInicio={horaInicioVyM}
                consejoMaestrosMins={consejoMaestrosMins}
              />
            ) : (
              <p className="text-sm text-muted-foreground p-6 text-center">
                Guarda el programa primero para ver la vista previa.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Diálogo de campos faltantes */}
      <AlertDialog open={missingFieldsOpen} onOpenChange={setMissingFieldsOpen}>
        <AlertDialogContent className="max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Faltan campos por completar</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Para poder marcar el programa como completo, debes llenar los siguientes campos
                  (resaltados en rojo en el formulario):
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-foreground max-h-[50vh] overflow-y-auto">
                  {missingFields.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMissingFieldsOpen(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
