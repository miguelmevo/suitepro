import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Lock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const profileSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100),
  apellido: z.string().trim().min(1, "El apellido es requerido").max(100),
  telefono: z.string().trim().max(20).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Debe incluir mayúsculas")
    .regex(/[a-z]/, "Debe incluir minúsculas")
    .regex(/[0-9]/, "Debe incluir números")
    .regex(/[^A-Za-z0-9]/, "Debe incluir caracteres especiales"),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

const RESTRICCION_OPTIONS = [
  { value: "sin_restriccion", label: "Sin restricción" },
  { value: "solo_fines_de_semana", label: "Solo fines de semana" },
  { value: "solo_entre_semana", label: "Solo entre semana" },
  { value: "solo_mananas", label: "Solo mañanas" },
  { value: "solo_tardes", label: "Solo tardes" },
];

interface Participante {
  id: string;
  nombre: string;
  apellido: string;
  telefono: string | null;
  restriccion_disponibilidad: string | null;
}

export default function MiCuenta() {
  const { user, profile } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const queryClient = useQueryClient();

  // Participante data
  const [participante, setParticipante] = useState<Participante | null>(null);
  const [loadingParticipante, setLoadingParticipante] = useState(true);
  const [noParticipante, setNoParticipante] = useState(false);

  // Profile state
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [restriccion, setRestriccion] = useState("sin_restriccion");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Debe cambiar contraseña
  const [debeCambiarPassword, setDebeCambiarPassword] = useState(false);

  useEffect(() => {
    const loadParticipante = async () => {
      if (!user?.id) {
        setLoadingParticipante(false);
        return;
      }

      // Verificar si debe cambiar contraseña
      const { data: profileData } = await supabase
        .from("profiles")
        .select("debe_cambiar_password")
        .eq("id", user.id)
        .single();

      if (profileData?.debe_cambiar_password) {
        setDebeCambiarPassword(true);
      }

      // Buscar participante vinculado al usuario
      const { data, error } = await supabase
        .from("participantes")
        .select("id, nombre, apellido, telefono, restriccion_disponibilidad")
        .eq("user_id", user.id)
        .eq("activo", true)
        .single();

      if (error || !data) {
        setNoParticipante(true);
        // Usar datos del profile si no hay participante
        if (profile) {
          setNombre(profile.nombre || "");
          setApellido(profile.apellido || "");
        }
      } else {
        setParticipante(data);
        setNombre(data.nombre);
        setApellido(data.apellido);
        setTelefono(data.telefono || "");
        setRestriccion(data.restriccion_disponibilidad || "sin_restriccion");
      }
      setLoadingParticipante(false);
    };

    loadParticipante();
  }, [user?.id, profile]);

  const handleSaveProfile = async () => {
    setProfileErrors({});
    
    const result = profileSchema.safeParse({ nombre, apellido, telefono });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setProfileErrors(errors);
      return;
    }

    setSavingProfile(true);
    try {
      // Actualizar perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ nombre: nombre.trim(), apellido: apellido.trim() })
        .eq("id", user?.id);

      if (profileError) throw profileError;

      // Actualizar participante si existe
      if (participante) {
        const { error: participanteError } = await supabase
          .from("participantes")
          .update({
            nombre: nombre.trim(),
            apellido: apellido.trim(),
            telefono: telefono.trim() || null,
            restriccion_disponibilidad: restriccion,
          })
          .eq("id", participante.id);

        if (participanteError) throw participanteError;
      }

      toast.success("Datos actualizados correctamente");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      queryClient.invalidateQueries({ queryKey: ["participantes"] });
    } catch (error: any) {
      toast.error(error.message || "Error al guardar los datos");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});

    const result = passwordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setPasswordErrors(errors);
      return;
    }

    setSavingPassword(true);
    try {
      // Verificar contraseña actual
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });

      if (signInError) {
        setPasswordErrors({ currentPassword: "Contraseña actual incorrecta" });
        setSavingPassword(false);
        return;
      }

      // Actualizar contraseña
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Quitar flag de debe cambiar contraseña
      if (debeCambiarPassword) {
        await supabase
          .from("profiles")
          .update({ debe_cambiar_password: false })
          .eq("id", user?.id);
        setDebeCambiarPassword(false);
      }

      toast.success("Contraseña actualizada correctamente");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      toast.error(error.message || "Error al cambiar la contraseña");
    } finally {
      setSavingPassword(false);
    }
  };

  if (loadingParticipante) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Cuenta</h1>
        <p className="text-muted-foreground">Administra tus datos personales y seguridad</p>
      </div>

      {debeCambiarPassword && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acción requerida:</strong> Debes cambiar tu contraseña temporal por una contraseña personal.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={debeCambiarPassword ? "seguridad" : "perfil"} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            Datos Personales
          </TabsTrigger>
          <TabsTrigger value="seguridad" className="gap-2">
            <Lock className="h-4 w-4" />
            Seguridad
          </TabsTrigger>
        </TabsList>

        <TabsContent value="perfil" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información Personal</CardTitle>
              <CardDescription>
                {noParticipante 
                  ? "Actualiza tu información básica" 
                  : "Actualiza tu información como participante"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Tu nombre"
                  />
                  {profileErrors.nombre && (
                    <p className="text-sm text-destructive">{profileErrors.nombre}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    placeholder="Tu apellido"
                  />
                  {profileErrors.apellido && (
                    <p className="text-sm text-destructive">{profileErrors.apellido}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Correo electrónico</Label>
                <Input value={user?.email || ""} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">
                  El correo electrónico no puede ser modificado
                </p>
              </div>

              {!noParticipante && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      placeholder="Tu número de teléfono"
                    />
                    {profileErrors.telefono && (
                      <p className="text-sm text-destructive">{profileErrors.telefono}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="restriccion">Restricción de disponibilidad</Label>
                    <Select value={restriccion} onValueChange={setRestriccion}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una opción" />
                      </SelectTrigger>
                      <SelectContent>
                        {RESTRICCION_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Indica si tienes alguna restricción de horario para participar
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
            {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar Cambios
          </Button>
        </TabsContent>

        <TabsContent value="seguridad" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cambiar Contraseña</CardTitle>
              <CardDescription>
                {debeCambiarPassword 
                  ? "Debes establecer una nueva contraseña personal"
                  : "Actualiza tu contraseña de acceso"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">
                  {debeCambiarPassword ? "Contraseña temporal" : "Contraseña actual"}
                </Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {passwordErrors.currentPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.currentPassword}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Mínimo 8 caracteres con mayúsculas, minúsculas, números y caracteres especiales
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleChangePassword} disabled={savingPassword} className="w-full">
            {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cambiar Contraseña
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}
