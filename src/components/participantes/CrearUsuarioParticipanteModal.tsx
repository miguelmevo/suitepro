import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Mail } from "lucide-react";

const emailSchema = z.string().email("Email inválido");

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

export function CrearUsuarioParticipanteModal({
  participante,
  open,
  onOpenChange,
  onSuccess,
}: CrearUsuarioParticipanteModalProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    if (!participante) return;

    setErrors({});
    const emailResult = emailSchema.safeParse(email.trim());
    if (!emailResult.success) {
      setErrors({ email: emailResult.error.errors[0]?.message || "Email inválido" });
      return;
    }

    const emailNormalized = email.trim();
    const nombreCompleto = `${participante.nombre} ${participante.apellido}`;

    setLoading(true);

    // Validar que la sesión sigue activa antes de invocar la función
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      setLoading(false);
      toast.error("Tu sesión expiró. Vuelve a iniciar sesión para crear el usuario.", { duration: 4000 });
      return;
    }

    // Cerrar el modal inmediatamente; el resultado se notifica por toast
    onOpenChange(false);
    setEmail("");

    try {
      const { data, error } = await supabase.functions.invoke("create-user-from-participante", {
        body: {
          participanteId: participante.id,
          email: emailNormalized,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === "email_already_exists") {
          toast.error(`El correo ${emailNormalized} ya está registrado`);
          return;
        }
        if (data.error === "participante_already_has_user") {
          toast.error("Este participante ya tiene un usuario vinculado");
          onSuccess();
          return;
        }
        if (data.error === "not_authenticated" || data.error === "invalid_token") {
          toast.error("Tu sesión expiró. Vuelve a iniciar sesión.");
          return;
        }
        throw new Error(data.error);
      }

      toast.success(
        `Se envió un correo a ${emailNormalized} para que ${nombreCompleto} active su cuenta.`,
        { duration: 6000 }
      );
      onSuccess();
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error?.message || "Error al crear el usuario. Verifica tu sesión e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!participante) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crear Usuario para Participante</DialogTitle>
          <DialogDescription>
            Crea una cuenta para <strong>{participante.nombre} {participante.apellido}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Se enviará un correo al participante con un enlace para activar su cuenta. En el primer ingreso completará sus datos personales y creará su propia contraseña.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico del participante</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
              autoFocus
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear y enviar correo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
