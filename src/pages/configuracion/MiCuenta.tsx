import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IndisponibilidadManager } from "@/components/participantes/IndisponibilidadManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, User, Lock, AlertCircle, CalendarOff, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const profileSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100),
  apellido: z.string().trim().min(1, "El apellido es requerido").max(100),
  telefono: z.string().trim().max(20).optional(),
});

import { passwordSchema as basePasswordSchema, validatePasswordNotObvious } from "@/lib/validations";

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida"),
  newPassword: basePasswordSchema,
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
  const { user, profile, userCongregaciones, signOut } = useAuthContext();
  const { congregaciones } = useCongregacion();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Eliminar cuenta
  const [confirmacionEliminar, setConfirmacionEliminar] = useState("");
  const [eliminandoCuenta, setEliminandoCuenta] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tab, setTab] = useState("perfil");

  // Congregación principal (a la que pertenece el usuario)
  const congregacionPrincipal = (() => {
    const principal = userCongregaciones.find((c) => c.es_principal) || userCongregaciones[0];
    if (!principal) return null;
    return congregaciones.find((c) => c.id === principal.congregacion_id) || null;
  })();

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
        setTab("seguridad");
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

      if (updateError) {
        // Traducir mensajes de Supabase Auth al español
        const errorMessages: Record<string, string> = {
          "New password should be different from the old password.": "La nueva contraseña debe ser diferente a la actual",
          "Password should be at least 6 characters.": "La contraseña debe tener al menos 6 caracteres",
          "Auth session missing!": "Sesión no válida, por favor inicia sesión nuevamente",
        };
        const translatedMessage = errorMessages[updateError.message] || updateError.message;
        throw new Error(translatedMessage);
      }

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

  const handleDeleteAccount = async () => {
    setEliminandoCuenta(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-own-account");

      if (error || data?.error) {
        const codigo = data?.error;
        if (codigo === "cannot_delete_super_admin") {
          toast.error("No puedes eliminar tu cuenta porque eres super administrador del sistema");
        } else if (codigo === "sole_admin") {
          const nombres = (data?.congregaciones as string[] | undefined)?.join(", ");
          toast.error(
            `Eres el único administrador de ${nombres || "una congregación"}. Asigna otro administrador antes de eliminar tu cuenta.`
          );
        } else {
          toast.error(data?.error || error?.message || "Error al eliminar la cuenta");
        }
        setEliminandoCuenta(false);
        return;
      }

      toast.success("Tu cuenta ha sido eliminada");
      await signOut();
      navigate("/auth");
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar la cuenta");
      setEliminandoCuenta(false);
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
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mi Cuenta</h1>
          <p className="text-muted-foreground">Administra tus datos personales y seguridad</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          title="Eliminar mi cuenta"
          className="text-destructive hover:text-destructive shrink-0"
          onClick={() => {
            setTab("seguridad");
            setDeleteDialogOpen(true);
          }}
        >
          <Trash2 className="h-5 w-5" />
        </Button>
      </div>

      {debeCambiarPassword && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Acción requerida:</strong> Debes cambiar tu contraseña temporal por una contraseña personal.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className={`grid w-full ${!noParticipante ? "grid-cols-3" : "grid-cols-2"}`}>
          <TabsTrigger value="perfil" className="gap-2">
            <User className="h-4 w-4" />
            Datos Personales
          </TabsTrigger>
          <TabsTrigger value="seguridad" className="gap-2">
            <Lock className="h-4 w-4" />
            Seguridad
          </TabsTrigger>
          {!noParticipante && (
            <TabsTrigger value="indisponibilidad" className="gap-2">
              <CalendarOff className="h-4 w-4" />
              Disponibilidad
            </TabsTrigger>
          )}
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

              <div className="space-y-2">
                <Label>Congregación</Label>
                <Input
                  value={congregacionPrincipal?.nombre || "Sin congregación asignada"}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Congregación a la que perteneces
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
                <PasswordInput
                  id="currentPassword"
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
                <PasswordInput
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  La contraseña debe tener mínimo 4 caracteres.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar nueva contraseña</Label>
                <PasswordInput
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <p className="text-sm text-destructive">Las contraseñas no coinciden</p>
                )}
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

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-lg text-destructive">ELIMINAR CUENTA</CardTitle>
              <CardDescription>
                Elimina tu cuenta de forma permanente. Esta acción no se puede deshacer.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                  setDeleteDialogOpen(open);
                  if (!open) setConfirmacionEliminar("");
                }}
              >
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Eliminar mi cuenta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar tu cuenta de forma permanente?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <p>
                          Se eliminará tu acceso ({user?.email}) y tus datos de perfil. Esta acción no se puede deshacer.
                        </p>
                        <div className="space-y-2">
                          <Label htmlFor="confirmar-eliminar">
                            Escribe <strong>ELIMINAR</strong> para confirmar
                          </Label>
                          <Input
                            id="confirmar-eliminar"
                            value={confirmacionEliminar}
                            onChange={(e) => setConfirmacionEliminar(e.target.value)}
                            autoComplete="off"
                          />
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={confirmacionEliminar !== "ELIMINAR" || eliminandoCuenta}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {eliminandoCuenta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Eliminar cuenta
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>

        {!noParticipante && participante && (
          <TabsContent value="indisponibilidad" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fechas no disponible</CardTitle>
                <CardDescription>
                  Indica las fechas en las que no estarás disponible para asignaciones
                </CardDescription>
              </CardHeader>
              <CardContent>
                <IndisponibilidadManager
                  participanteId={participante.id}
                  participanteNombre={`${participante.nombre} ${participante.apellido}`}
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
