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
const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .regex(/[A-Z]/, "Debe incluir mayúsculas")
  .regex(/[a-z]/, "Debe incluir minúsculas")
  .regex(/[0-9]/, "Debe incluir números")
  .regex(/[^A-Za-z0-9]/, "Debe incluir caracteres especiales");

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

// Generar contraseña aleatoria que cumpla requisitos
function generatePassword(): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const numbers = "0123456789";
  const special = "!@#$%&*";
  
  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  const all = upper + lower + numbers + special;
  for (let i = 0; i < 4; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }
  
  // Mezclar
  return password.split("").sort(() => Math.random() - 0.5).join("");
}

export function CrearUsuarioParticipanteModal({
  participante,
  open,
  onOpenChange,
  onSuccess,
}: CrearUsuarioParticipanteModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCopyPassword = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGeneratePassword = () => {
    setPassword(generatePassword());
  };

  const handleSubmit = async () => {
    if (!participante) return;
    
    setErrors({});
    
    // Validar
    const emailResult = emailSchema.safeParse(email.trim());
    const passwordResult = passwordSchema.safeParse(password);
    
    const newErrors: Record<string, string> = {};
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0]?.message || "Email inválido";
    }
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0]?.message || "Contraseña inválida";
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
      setPassword(generatePassword());
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
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
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
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs"
                onClick={handleGeneratePassword}
              >
                Generar nueva contraseña
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anota esta contraseña para compartirla con el usuario. Deberá cambiarla al ingresar.
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
