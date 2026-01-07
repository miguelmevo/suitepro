import { useState, useEffect } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { useParticipantes } from "@/hooks/useParticipantes";
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
import { Loader2, User, Lock, Link2, CheckCircle2 } from "lucide-react";

const profileSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es requerido").max(100),
  apellido: z.string().trim().min(1, "El apellido es requerido").max(100),
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

export default function MiCuenta() {
  const { user, profile } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const { participantes, isLoading: loadingParticipantes } = useParticipantes();
  const queryClient = useQueryClient();

  // Profile state
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [participanteId, setParticipanteId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Load participante vinculado
  const [linkedParticipante, setLinkedParticipante] = useState<string | null>(null);
  const [loadingLink, setLoadingLink] = useState(true);

  useEffect(() => {
    if (profile) {
      setNombre(profile.nombre || "");
      setApellido(profile.apellido || "");
    }
  }, [profile]);

  useEffect(() => {
    const loadLinkedParticipante = async () => {
      if (!user?.id || !congregacionActual?.id) {
        setLoadingLink(false);
        return;
      }

      const { data } = await supabase
        .from("usuarios_congregacion")
        .select("participante_id")
        .eq("user_id", user.id)
        .eq("congregacion_id", congregacionActual.id)
        .single();

      if (data?.participante_id) {
        setLinkedParticipante(data.participante_id);
        setParticipanteId(data.participante_id);
      }
      setLoadingLink(false);
    };

    loadLinkedParticipante();
  }, [user?.id, congregacionActual?.id]);

  const handleSaveProfile = async () => {
    setProfileErrors({});
    
    const result = profileSchema.safeParse({ nombre, apellido });
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

      // Actualizar vinculación con participante si cambió
      if (participanteId !== linkedParticipante && congregacionActual?.id) {
        const { error: linkError } = await supabase
          .from("usuarios_congregacion")
          .update({ participante_id: participanteId || null })
          .eq("user_id", user?.id)
          .eq("congregacion_id", congregacionActual.id);

        if (linkError) throw linkError;
        setLinkedParticipante(participanteId);
      }

      toast.success("Datos actualizados correctamente");
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
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
      // Verificar contraseña actual intentando reautenticar
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

  const linkedParticipanteData = participantes?.find((p) => p.id === linkedParticipante);

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Cuenta</h1>
        <p className="text-muted-foreground">Administra tus datos personales y seguridad</p>
      </div>

      <Tabs defaultValue="perfil" className="w-full">
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
                Actualiza tu nombre y apellido
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                Vincular con Participante
              </CardTitle>
              <CardDescription>
                Asocia tu cuenta con tu registro de participante para ver tus asignaciones
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingLink || loadingParticipantes ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando...
                </div>
              ) : (
                <>
                  {linkedParticipanteData && (
                    <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span className="text-sm">
                        Actualmente vinculado a: <strong>{linkedParticipanteData.nombre} {linkedParticipanteData.apellido}</strong>
                      </span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="participante">Selecciona tu participante</Label>
                    <Select
                      value={participanteId || "none"}
                      onValueChange={(value) => setParticipanteId(value === "none" ? null : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un participante" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin vincular</SelectItem>
                        {participantes
                          ?.filter((p) => p.activo)
                          .sort((a, b) => `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`))
                          .map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.apellido}, {p.nombre}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
                Actualiza tu contraseña de acceso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Contraseña actual</Label>
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
