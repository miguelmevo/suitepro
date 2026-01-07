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
import { Loader2, Eye, EyeOff, Copy, Check } from "lucide-react";

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

const DEFAULT_PASSWORD = "villareal2026";

export function CrearUsuarioParticipanteModal({
  participante,
  open,
  onOpenChange,
  onSuccess,
}: CrearUsuarioParticipanteModalProps) {
  const [email, setEmail] = useState("");
  const [password] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };


  const handleSubmit = async () => {
    if (!participante) return;
    
    setErrors({});
    
    // Validar email
    const emailResult = emailSchema.safeParse(email.trim());
    
    const newErrors: Record<string, string> = {};
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0]?.message || "Email inválido";
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user-from-participante", {
        body: {
          participanteId: participante.id,
          email: email.trim(),
          password,
        },
      });

      if (error) throw error;
      if (data?.error) {
        if (data.error === "email_already_exists") {
          setErrors({ email: "Este correo ya está registrado" });
          setLoading(false);
          return;
        }
        if (data.error === "participante_already_has_user") {
          toast.error("Este participante ya tiene un usuario vinculado");
          onOpenChange(false);
          setLoading(false);
          return;
        }
        throw new Error(data.error);
      }

      toast.success(
        `Usuario creado para ${participante.nombre} ${participante.apellido}. Contraseña temporal: ${password}`,
        { duration: 10000 }
      );
      
      onSuccess();
      onOpenChange(false);
      setEmail("");
    } catch (error: any) {
      console.error("Error creating user:", error);
      toast.error(error.message || "Error al crear el usuario");
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
            Crea una cuenta de usuario para <strong>{participante.nombre} {participante.apellido}</strong>.
            El usuario deberá cambiar su contraseña al iniciar sesión por primera vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="correo@ejemplo.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  readOnly
                  className="pr-10 bg-muted"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleCopyPassword}
              >
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta es la contraseña por defecto. El usuario deberá cambiarla al ingresar.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear Usuario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
