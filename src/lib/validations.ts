import { z } from "zod";

// Validación de contraseña: mínimo 6 caracteres, debe tener letras y números
export const passwordSchema = z
  .string()
  .min(6, "La contraseña debe tener al menos 6 caracteres")
  .refine(
    (password) => /[a-zA-Z]/.test(password),
    "La contraseña debe contener al menos una letra"
  )
  .refine(
    (password) => /[0-9]/.test(password),
    "La contraseña debe contener al menos un número"
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

export type SignUpFormData = z.infer<typeof signUpSchema>;
export type SignInFormData = z.infer<typeof signInSchema>;
