import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { format, parseISO, addDays } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ParticipanteSelector } from "@/components/vida-ministerio/ParticipanteSelector";
import { MaestrosRepeater } from "@/components/vida-ministerio/MaestrosRepeater";
import { VidaCristianaRepeater } from "@/components/vida-ministerio/VidaCristianaRepeater";

import {
  useGuardarProgramaVidaMinisterio,
  useProgramaVidaMinisterioByFecha,
} from "@/hooks/useProgramaVidaMinisterio";
import { useConfiguracionSistema } from "@/hooks/useConfiguracionSistema";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";

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
  return s; // already YYYY-MM-DD from <input type="date">
}

export default function EditorVidaMinisterio() {
  const { fecha } = useParams<{ fecha: string }>();
  const navigate = useNavigate();
  const { roles, isAdminOrEditorInCongregacion } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id || "";

  const fechaInicial = fecha || format(getMonday(new Date()), "yyyy-MM-dd");
  const [fechaSemana, setFechaSemana] = useState<string>(fechaInicial);

  const { data: existente, isLoading } = useProgramaVidaMinisterioByFecha(fechaSemana);
  const guardar = useGuardarProgramaVidaMinisterio();
  const { getConfigValue } = useConfiguracionSistema("vida_ministerio");

  // Permission
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
  const [estado, setEstado] = useState<"borrador" | "completo">("borrador");

  // Salas auxiliares: global config + override
  const salasGlobales = (getConfigValue("salas_auxiliares")?.cantidad as number | undefined) ?? 0;
  const salasEffective = salasOverride ?? salasGlobales;

  // Cargar datos existentes
  useEffect(() => {
    if (!existente) return;
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
    setEstado(existente.estado);
  }, [existente]);

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
      estado: targetEstado,
    });
    setEstado(targetEstado);
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
          <Button variant="ghost" size="sm" onClick={() => navigate("/vida-y-ministerio")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Reunión Vida y Ministerio</h1>
            <p className="text-sm text-muted-foreground">{rangoSemana}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleGuardar("borrador")} disabled={guardar.isPending}>
              <Save className="h-4 w-4 mr-1" />
              Guardar borrador
            </Button>
            <Button onClick={() => handleGuardar("completo")} disabled={guardar.isPending}>
              {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Marcar como completo
            </Button>
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md p-3 text-sm">
          Solo lectura: tu rol no permite modificar este programa.
        </div>
      )}

      {/* Cabecera semanal */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos de la semana</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Lunes de la semana</Label>
            <Input
              type="date"
              value={fechaSemana}
              onChange={(e) => setFechaSemana(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1">
            <Label>Salas auxiliares (esta semana)</Label>
            <Select
              value={salasOverride === null ? "default" : String(salasOverride)}
              onValueChange={(v) => setSalasOverride(v === "default" ? null : parseInt(v, 10))}
              disabled={!canEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar configuración global ({salasGlobales})</SelectItem>
                <SelectItem value="0">0 salas auxiliares</SelectItem>
                <SelectItem value="1">1 (Sala B)</SelectItem>
                <SelectItem value="2">2 (Sala B y C)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Presidente de la reunión</Label>
            <ParticipanteSelector
              value={presidenteId}
              onChange={setPresidenteId}
              filtro="anciano"
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1">
            <Label>Cántico inicial</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={canticoInicial}
              onChange={(e) => setCanticoInicial(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1">
            <Label>Cántico intermedio</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={canticoIntermedio}
              onChange={(e) => setCanticoIntermedio(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1">
            <Label>Cántico final</Label>
            <Input
              type="number"
              min={1}
              max={200}
              value={canticoFinal}
              onChange={(e) => setCanticoFinal(e.target.value)}
              disabled={!canEdit}
            />
          </div>

          <div className="space-y-1">
            <Label>Oración inicial</Label>
            <ParticipanteSelector
              value={oracionInicialId}
              onChange={setOracionInicialId}
              filtro="anciano_o_sm"
              disabled={!canEdit}
            />
          </div>
          <div className="space-y-1">
            <Label>Oración final</Label>
            <ParticipanteSelector
              value={oracionFinalId}
              onChange={setOracionFinalId}
              filtro="anciano_o_sm"
              disabled={!canEdit}
            />
          </div>
        </CardContent>
      </Card>

      {/* TESOROS */}
      <Card>
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-base text-primary">TESOROS DE LA BIBLIA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label>1. Tesoros de la Biblia (título)</Label>
              <Input
                value={tesoros.titulo}
                onChange={(e) => setTesoros({ ...tesoros, titulo: e.target.value })}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-1">
              <Label>Asignado</Label>
              <ParticipanteSelector
                value={tesoros.participante_id}
                onChange={(v) => setTesoros({ ...tesoros, participante_id: v })}
                filtro="anciano_o_sm"
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>2. Perlas escondidas</Label>
            <ParticipanteSelector
              value={perlasId}
              onChange={setPerlasId}
              filtro="anciano_o_sm"
              disabled={!canEdit}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 space-y-1">
              <Label>3. Lectura bíblica (cita)</Label>
              <Input
                value={lecturaBiblica.cita}
                onChange={(e) => setLecturaBiblica({ ...lecturaBiblica, cita: e.target.value })}
                disabled={!canEdit}
                placeholder="Ej: Génesis 1:1-25"
              />
            </div>
            <div className="space-y-1">
              <Label>Lector (varón)</Label>
              <ParticipanteSelector
                value={lecturaBiblica.participante_id}
                onChange={(v) => setLecturaBiblica({ ...lecturaBiblica, participante_id: v })}
                filtro="varon_publicador"
                disabled={!canEdit}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MAESTROS */}
      <Card>
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-base text-primary">SEAMOS MEJORES MAESTROS</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <MaestrosRepeater value={maestros} onChange={setMaestros} disabled={!canEdit} />

          {salasEffective >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t mt-4">
              <div className="space-y-1">
                <Label>Encargado Sala B</Label>
                <ParticipanteSelector
                  value={encargadoSalaB}
                  onChange={setEncargadoSalaB}
                  filtro="anciano_o_sm"
                  disabled={!canEdit}
                />
              </div>
              {salasEffective >= 2 && (
                <div className="space-y-1">
                  <Label>Encargado Sala C</Label>
                  <ParticipanteSelector
                    value={encargadoSalaC}
                    onChange={setEncargadoSalaC}
                    filtro="anciano_o_sm"
                    disabled={!canEdit}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* VIDA CRISTIANA */}
      <Card>
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-base text-primary">NUESTRA VIDA CRISTIANA</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <VidaCristianaRepeater value={vidaCristiana} onChange={setVidaCristiana} disabled={!canEdit} />

          <div className="border-t pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-primary">Estudio bíblico de la congregación</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1 space-y-1">
                <Label>Material / lectura</Label>
                <Input
                  value={estudioBiblico.titulo}
                  onChange={(e) => setEstudioBiblico({ ...estudioBiblico, titulo: e.target.value })}
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Conductor</Label>
                <ParticipanteSelector
                  value={estudioBiblico.conductor_id}
                  onChange={(v) => setEstudioBiblico({ ...estudioBiblico, conductor_id: v })}
                  filtro="anciano"
                  disabled={!canEdit}
                />
              </div>
              <div className="space-y-1">
                <Label>Lector</Label>
                <ParticipanteSelector
                  value={estudioBiblico.lector_id}
                  onChange={(v) => setEstudioBiblico({ ...estudioBiblico, lector_id: v })}
                  filtro="lector_atalaya"
                  disabled={!canEdit}
                />
              </div>
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
    </div>
  );
}
