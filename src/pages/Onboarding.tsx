import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, ArrowRight, Check } from "lucide-react";

const RESTRICCION_OPTIONS = [
  { value: "sin_restriccion", label: "Sin restricción" },
  { value: "solo_fines_de_semana", label: "Solo fines de semana" },
  { value: "solo_entre_semana", label: "Solo entre semana" },
  { value: "solo_mananas", label: "Solo mañanas" },
  { value: "solo_tardes", label: "Solo tardes" },
];

const datosSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100),
  apellido: z.string().trim().min(1, "El apellido es requerido").max(100),
  telefono: z.string().trim().max(20).optional(),
  genero: z.enum(["M", "F"], { errorMap: () => ({ message: "Selecciona tu género" }) }),
});

const passwordSchema = z.object({
  newPassword: z.string().min(4, "La contraseña debe tener al menos 4 caracteres"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const TOTAL_STEPS = 3;

export default function Onboarding() {
  const { user, profile } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Step 1: datos
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [genero, setGenero] = useState<"M" | "F" | "">("");

  // Step 2: restricción
  const [restriccion, setRestriccion] = useState("sin_restriccion");
  const [participanteId, setParticipanteId] = useState<string | null>(null);

  // Step 3: password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Carga inicial
  useEffect(() => {
    const load = async () => {
      if (!user?.id) return;
      setNombre(profile?.nombre || "");
      setApellido(profile?.apellido || "");

      const { data: p } = await supabase
        .from("participantes")
        .select("id, nombre, apellido, telefono, genero, restriccion_disponibilidad")
        .eq("user_id", user.id)
        .eq("activo", true)
        .maybeSingle();

      if (p) {
        setParticipanteId(p.id);
        if (p.nombre) setNombre(p.nombre);
        if (p.apellido) setApellido(p.apellido);
        setTelefono(p.telefono || "");
        if (p.genero === "M" || p.genero === "F") setGenero(p.genero);
        setRestriccion(p.restriccion_disponibilidad || "sin_restriccion");
      }
    };
    load();
  }, [user?.id, profile]);

  const handleNext = () => {
    setErrors({});
    if (step === 1) {
      const r = datosSchema.safeParse({ nombre, apellido, telefono, genero });
      if (!r.success) {
        const errs: Record<string, string> = {};
        r.error.errors.forEach((e) => {
          if (e.path[0]) errs[e.path[0] as string] = e.message;
        });
        setErrors(errs);
        return;
      }
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 1));
  };

  const handleFinish = async () => {
    setErrors({});
    const r = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!r.success) {
      const errs: Record<string, string> = {};
      r.error.errors.forEach((e) => {
        if (e.path[0]) errs[e.path[0] as string] = e.message;
      });
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    try {
      // 1. Update password
      const { error: pwErr } = await supabase.auth.updateUser({ password: newPassword });
      if (pwErr) throw new Error(pwErr.message || "No se pudo cambiar la contraseña");

      // 2. Update profile
      const { error: profErr } = await supabase
        .from("profiles")
        .update({
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          debe_cambiar_password: false,
          debe_completar_onboarding: false,
        })
        .eq("id", user!.id);
      if (profErr) throw profErr;

      // 3. Update participante (sync genero hacia participante solo si es varón)
      if (participanteId) {
        const participanteUpdate: Record<string, unknown> = {
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono.trim() || null,
          restriccion_disponibilidad: restriccion,
        };
        if (genero === "M") {
          participanteUpdate.genero = "M";
        }
        const { error: pErr } = await supabase
          .from("participantes")
          .update(participanteUpdate)
          .eq("id", participanteId);
        if (pErr) throw pErr;
      }

      toast.success("¡Cuenta activada! Bienvenido a SuitePro.");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      navigate("/", { replace: true });
      // Forzar refresh para que ProtectedRoute lea el nuevo profile
      setTimeout(() => window.location.reload(), 100);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Error al finalizar el onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const progress = (step / TOTAL_STEPS) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader>
          <CardTitle className="text-2xl">Activa tu cuenta</CardTitle>
          <CardDescription>
            Paso {step} de {TOTAL_STEPS}
          </CardDescription>
          <Progress value={progress} className="mt-2" />
        </CardHeader>

        <CardContent className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Tus datos personales</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre *</Label>
                  <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
                  {errors.nombre && <p className="text-sm text-destructive">{errors.nombre}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido *</Label>
                  <Input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
                  {errors.apellido && <p className="text-sm text-destructive">{errors.apellido}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="space-y-2">
                <Label>Género *</Label>
                <RadioGroup value={genero} onValueChange={(v) => setGenero(v as "M" | "F")} className="flex gap-6">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="M" id="g-m" />
                    <Label htmlFor="g-m" className="font-normal cursor-pointer">Varón</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="F" id="g-f" />
                    <Label htmlFor="g-f" className="font-normal cursor-pointer">Mujer</Label>
                  </div>
                </RadioGroup>
                {errors.genero && <p className="text-sm text-destructive">{errors.genero}</p>}
              </div>

              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Disponibilidad</h3>
              <p className="text-sm text-muted-foreground">
                Indica si tienes alguna restricción de horario para las asignaciones.
              </p>
              <div className="space-y-2">
                <Label htmlFor="restriccion">Restricción de disponibilidad</Label>
                <Select value={restriccion} onValueChange={setRestriccion}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESTRICCION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Podrás cambiarla luego en Mi Cuenta.
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Crea tu contraseña</h3>
              <p className="text-sm text-muted-foreground">
                Esta será tu contraseña personal para iniciar sesión.
              </p>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña *</Label>
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 4 caracteres"
                />
                {errors.newPassword && <p className="text-sm text-destructive">{errors.newPassword}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                />
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                La contraseña debe tener mínimo 4 caracteres. No hay otros requisitos.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleBack} disabled={step === 1 || submitting}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Atrás
            </Button>
            {step < TOTAL_STEPS ? (
              <Button onClick={handleNext}>
                Siguiente <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Finalizando...</>
                ) : (
                  <><Check className="mr-2 h-4 w-4" /> Finalizar</>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
