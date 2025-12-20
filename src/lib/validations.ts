import { z } from "zod";

// Validación de contraseña: mínimo 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales
export const passwordSchema = z
  .string()
  .min(8, "La contraseña debe tener al menos 8 caracteres")
  .refine(
    (password) => /[a-z]/.test(password),
    "La contraseña debe contener al menos una letra minúscula"
  )
  .refine(
    (password) => /[A-Z]/.test(password),
    "La contraseña debe contener al menos una letra mayúscula"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "La contraseña debe contener al menos un número"
  )
  .refine(
    (password) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    "La contraseña debe contener al menos un carácter especial (!@#$%^&*)"
  );

export const emailSchema = z
  .string()
  .trim()
  .email("Ingresa un correo electrónico válido")
  .max(255, "El correo es demasiado largo");

export const nombreSchema = z
  .string()
  .trim()
  .min(1, "El nombre es requerido")
  .max(100, "El nombre es demasiado largo");

export const apellidoSchema = z
  .string()
  .trim()
  .min(1, "El apellido es requerido")
  .max(100, "El apellido es demasiado largo");

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  nombre: nombreSchema,
  apellido: apellidoSchema,
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "La contraseña es requerida"),
});

export const resetPasswordSchema = z.object({
  email: emailSchema,
});

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
