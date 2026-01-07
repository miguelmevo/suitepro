import { z } from "zod";

// Lista de contraseñas obvias prohibidas
const OBVIOUS_PASSWORDS = [
  "12345", "123456", "1234567", "12345678", "123456789",
  "abcde", "abcdef", "password", "contrasena", "qwerty",
  "admin", "usuario", "user", "login", "welcome",
];

// Función para detectar secuencias consecutivas
const hasConsecutiveSequence = (str: string): boolean => {
  const lowerStr = str.toLowerCase();
  // Secuencias numéricas (12345, 54321)
  for (let i = 0; i < lowerStr.length - 2; i++) {
    const c1 = lowerStr.charCodeAt(i);
    const c2 = lowerStr.charCodeAt(i + 1);
    const c3 = lowerStr.charCodeAt(i + 2);
    if ((c2 === c1 + 1 && c3 === c2 + 1) || (c2 === c1 - 1 && c3 === c2 - 1)) {
      return true;
    }
  }
  return false;
};

// Función para validar contraseña contra datos del usuario
export const validatePasswordNotObvious = (
  password: string,
  context?: { email?: string; nombre?: string; apellido?: string }
): string | null => {
  const lowerPassword = password.toLowerCase();
  
  // Verificar contraseñas obvias
  if (OBVIOUS_PASSWORDS.includes(lowerPassword)) {
    return "La contraseña es demasiado obvia";
  }
  
  // Verificar secuencias consecutivas
  if (hasConsecutiveSequence(password)) {
    return "La contraseña no puede contener secuencias consecutivas (ej: 123, abc)";
  }
  
  // Verificar contra email
  if (context?.email) {
    const emailPart = context.email.split("@")[0].toLowerCase();
    if (emailPart.length >= 3 && lowerPassword.includes(emailPart)) {
      return "La contraseña no puede contener tu correo electrónico";
    }
  }
  
  // Verificar contra nombre
  if (context?.nombre && context.nombre.length >= 3) {
    if (lowerPassword.includes(context.nombre.toLowerCase())) {
      return "La contraseña no puede contener tu nombre";
    }
  }
  
  // Verificar contra apellido
  if (context?.apellido && context.apellido.length >= 3) {
    if (lowerPassword.includes(context.apellido.toLowerCase())) {
      return "La contraseña no puede contener tu apellido";
    }
  }
  
  return null;
};

// Validación de contraseña: mínimo 5 caracteres, sin patrones obvios
export const passwordSchema = z
  .string()
  .min(5, "La contraseña debe tener al menos 5 caracteres")
  .refine(
    (password) => !OBVIOUS_PASSWORDS.includes(password.toLowerCase()),
    "La contraseña es demasiado obvia"
  )
  .refine(
    (password) => !hasConsecutiveSequence(password),
    "La contraseña no puede contener secuencias consecutivas (ej: 123, abc)"
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
