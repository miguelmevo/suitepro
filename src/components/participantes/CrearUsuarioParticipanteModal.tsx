import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCongregacionId } from "@/contexts/CongregacionContext";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Link2, AlertTriangle } from "lucide-react";

interface Participante {
  id: string;
  nombre: string;
  apellido: string;
  user_id?: string | null;
}

interface CrearUsuarioParticipanteModalProps {
  participante: Participante | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface UsuarioDisponible {
  user_id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
}

export function CrearUsuarioParticipanteModal({
  participante,
  open,
  onOpenChange,
  onSuccess,
}: CrearUsuarioParticipanteModalProps) {
  const congregacionId = useCongregacionId();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Usuarios de la congregación sin participante vinculado
  const { data: usuariosDisponibles = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["usuarios-sin-participante", congregacionId],
    queryFn: async (): Promise<UsuarioDisponible[]> => {
      if (!congregacionId) return [];

      const { data: memberships, error: mErr } = await supabase
        .from("usuarios_congregacion")
        .select("user_id")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .is("participante_id", null);

      if (mErr) throw mErr;
      const ids = (memberships || []).map((m: any) => m.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, nombre, apellido")
        .in("id", ids);

      if (pErr) throw pErr;

      return (profiles || [])
        .map((p: any) => ({
          user_id: p.id,
          email: p.email,
          nombre: p.nombre,
          apellido: p.apellido,
        }))
        .sort((a, b) =>
          `${a.apellido || ""} ${a.nombre || ""}`.localeCompare(
            `${b.apellido || ""} ${b.nombre || ""}`
          )
        );
    },
    enabled: !!congregacionId && open,
  });

  const selectedUser = useMemo(
    () => usuariosDisponibles.find((u) => u.user_id === selectedUserId) || null,
    [usuariosDisponibles, selectedUserId]
  );

  const handleConfirmHomologar = async () => {
    if (!participante || !selectedUser || !congregacionId) return;

    setConfirmOpen(false);
    setLoading(true);

    try {
      const { error: pErr } = await supabase
        .from("participantes")
        .update({ user_id: selectedUser.user_id })
        .eq("id", participante.id);
      if (pErr) throw pErr;

      const { error: uErr } = await supabase
        .from("usuarios_congregacion")
        .update({ participante_id: participante.id })
        .eq("user_id", selectedUser.user_id)
        .eq("congregacion_id", congregacionId);
      if (uErr) throw uErr;

      queryClient.invalidateQueries({ queryKey: ["participantes"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-sin-participante"] });
      queryClient.invalidateQueries({ queryKey: ["user-participante-map"] });
      queryClient.invalidateQueries({ queryKey: ["participantes-sin-usuario"] });

      toast.success(
        `Usuario ${selectedUser.email} homologado con ${participante.nombre} ${participante.apellido}.`
      );
      setSelectedUserId("");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error homologando usuario:", error);
      toast.error(error?.message || "Error al homologar usuario.");
    } finally {
      setLoading(false);
    }
  };

  if (!participante) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !loading && onOpenChange(o)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Homologar Usuario con Participante</DialogTitle>
            <DialogDescription>
              Vincula una cuenta de usuario existente con{" "}
              <strong>
                {participante.nombre} {participante.apellido}
              </strong>
              .
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Alert>
              <Link2 className="h-4 w-4" />
              <AlertDescription className="space-y-2 text-sm">
                <p>
                  Selecciona una cuenta de usuario que <strong>no esté vinculada</strong> a
                  ningún participante. Al homologar, el usuario podrá acceder y ver sus
                  asignaciones como este participante.
                </p>
              </AlertDescription>
            </Alert>

            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                <strong>Esta acción es irreversible desde aquí.</strong> Para revertir el
                vínculo será necesario hacerlo manualmente desde la gestión de usuarios.
                Verifica que la persona y la cuenta sean correctas antes de continuar.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="usuario-select">Usuario a homologar</Label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando usuarios disponibles...
                </div>
              ) : usuariosDisponibles.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  No hay usuarios disponibles sin vincular en esta congregación.
                </p>
              ) : (
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="usuario-select">
                    <SelectValue placeholder="Selecciona un usuario..." />
                  </SelectTrigger>
                  <SelectContent>
                    {usuariosDisponibles.map((u) => {
                      const fullName = [u.nombre, u.apellido].filter(Boolean).join(" ");
                      return (
                        <SelectItem key={u.user_id} value={u.user_id}>
                          {fullName ? `${fullName} — ${u.email}` : u.email}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={loading || !selectedUserId}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Homologar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Confirmar homologación?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Vas a vincular la cuenta{" "}
                  <strong>{selectedUser?.email}</strong> con el participante{" "}
                  <strong>
                    {participante.nombre} {participante.apellido}
                  </strong>
                  .
                </p>
                <p className="text-destructive font-medium">
                  Esta acción es irreversible desde esta pantalla.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmHomologar}>
              Sí, homologar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
