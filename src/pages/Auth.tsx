import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuthContext } from "@/contexts/AuthProvider";
import { ColorSelector } from "@/components/congregaciones/ColorSelector";
import { useCongregacionBySlug } from "@/hooks/useCongregacionBySlug";
import {
  signInSchema,
  resetPasswordSchema,
  SignInFormData,
  ResetPasswordFormData,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, CalendarDays, Users, Globe, Check, AlertCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Password validation relaxed - only minimum 5 characters required

// Schema para registro (con opción de congregación)
const signUpSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(5, "La contraseña debe tener al menos 5 caracteres"),
  confirmPassword: z.string().min(1, "Confirma tu contraseña"),
  crearCongregacion: z.boolean().default(false),
  congregacionNombre: z.string().optional(),
  urlPrivada: z.boolean().default(false),
  colorPrimario: z.string().default("blue"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
}).refine((data) => {
  // Si quiere crear congregación, el nombre es obligatorio
  if (data.crearCongregacion && (!data.congregacionNombre || data.congregacionNombre.length < 2)) {
    return false;
  }
  return true;
}, {
  message: "El nombre de la congregación es requerido",
  path: ["congregacionNombre"],
});

type SignUpFormData = z.infer<typeof signUpSchema>;

// Función para generar slug aleatorio
const generateRandomSlug = () => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Función para generar slug desde nombre
const generateSlug = (nombre: string) => {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .substring(0, 50);
};

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signIn, signUp } = useAuthContext();
  const { congregacion, isLoading: slugLoading, error: slugError, isDominioPrincipal } = useCongregacionBySlug();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [nombreDuplicado, setNombreDuplicado] = useState(false);
  const [verificandoNombre, setVerificandoNombre] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  // Listen for PASSWORD_RECOVERY event
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const buildAuthUrl = (slug?: string) => {
    const url = new URL("/auth", window.location.origin);
    if (slug) url.searchParams.set("slug", slug);
    return url.toString();
  };

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      nombre: "",
      apellido: "",
      crearCongregacion: false,
      congregacionNombre: "",
      urlPrivada: false,
      colorPrimario: "blue",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const crearCongregacion = signUpForm.watch("crearCongregacion");
  const congregacionNombre = signUpForm.watch("congregacionNombre");
  const urlPrivada = signUpForm.watch("urlPrivada");
  const colorPrimario = signUpForm.watch("colorPrimario");

  // Verificar nombre duplicado usando RPC (accesible sin autenticación)
  useEffect(() => {
    if (!crearCongregacion || !congregacionNombre || congregacionNombre.trim().length < 2) {
      setNombreDuplicado(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setVerificandoNombre(true);
      try {
        // Usar función RPC que es accesible sin autenticación
        const { data, error } = await supabase.rpc("check_congregation_name_exists", {
          _nombre: congregacionNombre.trim()
        });
        
        if (error) {
          console.error("Error verificando nombre:", error);
          setNombreDuplicado(false);
        } else {
          setNombreDuplicado(data === true);
        }
      } catch (err) {
        console.error("Error verificando nombre:", err);
        setNombreDuplicado(false);
      }
      setVerificandoNombre(false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [congregacionNombre, crearCongregacion]);

  // Redirigir si ya está autenticado (pero no interrumpir flujos de signup ni recovery)
  useEffect(() => {
    if (user && !authLoading && !isSubmitting && !isRecoveryMode) {
      navigate("/");
    }
  }, [user, authLoading, isSubmitting, isRecoveryMode, navigate]);

  const handleChangePassword = async () => {
    setPasswordError("");
    if (newPassword.length < 5) {
      setPasswordError("La contraseña debe tener al menos 5 caracteres");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError("Las contraseñas no coinciden");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({
          title: "Error",
          description: error.message || "No se pudo cambiar la contraseña",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Contraseña actualizada",
          description: "Tu contraseña ha sido cambiada exitosamente.",
        });
        setIsRecoveryMode(false);
        navigate("/");
      }
    } catch {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  const handleSignIn = async (data: SignInFormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);

    // Redirect is handled by the "user" effect below.
    if (!error) return;
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("forgot-password", {
        body: { email: data.email },
      });

      if (error) {
        toast({
          title: "Error",
          description: "No se pudo enviar el correo. Intenta nuevamente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Correo enviado",
          description: "Si tu correo está registrado, recibirás un enlace para restablecer tu contraseña.",
        });
        setActiveTab("signin");
      }
    } catch {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado. Intenta nuevamente.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  };

  const handleSignUp = async (data: SignUpFormData) => {
    // Validar duplicado si está creando congregación
    if (data.crearCongregacion && nombreDuplicado) {
      toast({
        title: "Error",
        description: "Ya existe una congregación con ese nombre",
        variant: "destructive",
      });
      return;
    }

    // En subdominio, debe existir la congregación
    if (!isDominioPrincipal && !congregacion) {
      toast({
        title: "Error",
        description: "No se pudo identificar la congregación",
        variant: "destructive",
      });
      return;
    }

    // En dominio principal sin crear congregación, no permitir
    if (isDominioPrincipal && !data.crearCongregacion) {
      toast({
        title: "Error",
        description: "Debes crear una congregación para registrarte desde el dominio principal.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Usar función de backend transaccional para registro atómico
      const { data: result, error } = await supabase.functions.invoke("register-with-congregation", {
        body: {
          email: data.email,
          password: data.password,
          nombre: data.nombre,
          apellido: data.apellido,
          crearCongregacion: isDominioPrincipal && data.crearCongregacion,
          congregacionNombre: data.congregacionNombre,
          urlPrivada: data.urlPrivada,
          colorPrimario: data.colorPrimario,
          congregacionId: !isDominioPrincipal && congregacion ? congregacion.id : undefined,
        },
      });

      if (error) {
        console.error("Error en registro:", error);

        // Cuando la función devuelve HTTP != 2xx, supabase-js a veces no entrega el body en `data`.
        // Intentar extraer un mensaje útil desde el body de la respuesta.
        let errorMessage = error.message || "Ocurrió un error durante el registro";

        if (result?.message) {
          errorMessage = result.message;
        } else {
          try {
            const ctx = (error as any)?.context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              if (body?.message) errorMessage = body.message;
            }
          } catch {
            // ignore
          }
        }

        toast({
          title: "Error al registrarse",
          description: errorMessage,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      if (result?.error) {
        console.error("Error en registro:", result.error);
        let message = result.message || "Ocurrió un error durante el registro";
        
        // Mensajes amigables para errores conocidos
        if (result.error === "congregation_exists") {
          message = "Ya existe una congregación con ese nombre";
        } else if (result.error === "auth_error" && result.message?.includes("registrado")) {
          message = "Este correo ya está registrado. Intenta iniciar sesión.";
        }
        
        toast({
          title: "Error al registrarse",
          description: message,
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Notificar admins sobre nuevo usuario (best-effort)
      try {
        await supabase.functions.invoke("notify-admin-new-user", {
          body: {
            userId: result.userId,
            userEmail: data.email,
            userName: data.nombre,
            userApellido: data.apellido,
          },
        });
      } catch (notifyError) {
        console.error("Error notifying admins:", notifyError);
      }

      // CASO A: Creó nueva congregación - redirigir a su URL
      if (result.isAdmin && result.slug) {
        toast({
          title: "¡Congregación creada!",
          description: "Ahora inicia sesión en tu nueva congregación.",
        });
        setIsSubmitting(false);
        window.location.href = buildAuthUrl(result.slug);
        return;
      }

      // CASO B: Se unió a congregación existente
      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada. Un administrador debe aprobar tu acceso.",
      });
      setIsSubmitting(false);
      setActiveTab("signin");
      signInForm.setValue("email", data.email);
      
    } catch (error) {
      console.error("Error en registro:", error);
      toast({
        title: "Error al registrarse",
        description: "Ocurrió un error inesperado. Por favor intenta de nuevo.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (authLoading || slugLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Recovery mode: show change password form
  if (isRecoveryMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center gap-2 mb-2">
              <CalendarDays className="h-7 w-7 text-primary" />
              <Users className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold text-primary">SUITEPRO</CardTitle>
            <CardDescription>Establece tu nueva contraseña</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nueva contraseña</label>
              <Input
                type="password"
                placeholder="Mínimo 5 caracteres"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirmar contraseña</label>
              <Input
                type="password"
                placeholder="Repite tu contraseña"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <p className="text-sm text-destructive">{passwordError}</p>
            )}
            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cambiando...
                </>
              ) : (
                "Cambiar Contraseña"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error: subdominio no válido
  if (!isDominioPrincipal && slugError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-xl">Congregación no encontrada</CardTitle>
            <CardDescription>
              {slugError}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Verifica que la URL sea correcta o contacta al administrador de tu congregación.
            </p>
            <Button variant="outline" onClick={() => (window.location.href = buildAuthUrl())}>
              Ir al inicio
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center gap-2 mb-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            <Users className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            {isDominioPrincipal ? "SUITEPRO" : congregacion?.nombre || "SUITEPRO"}
          </CardTitle>
          <CardDescription>
            {isDominioPrincipal 
              ? "Sistema de gestión de asignaciones" 
              : `Bienvenido a ${congregacion?.nombre}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear Cuenta</TabsTrigger>
            </TabsList>

            {/* ===== TAB: INICIAR SESIÓN ===== */}
            <TabsContent value="signin" className="mt-4">
              <Form {...signInForm}>
                <form
                  onSubmit={signInForm.handleSubmit(handleSignIn)}
                  className="space-y-4"
                >
                  <FormField
                    control={signInForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={signInForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      "Iniciar Sesión"
                    )}
                  </Button>
                  <div className="text-center mt-2">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm"
                      onClick={() => setActiveTab("reset")}
                    >
                      ¿Olvidaste tu contraseña?
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* ===== TAB: RESET PASSWORD ===== */}
            <TabsContent value="reset" className="mt-4">
              <Form {...resetPasswordForm}>
                <form
                  onSubmit={resetPasswordForm.handleSubmit(handleResetPassword)}
                  className="space-y-4"
                >
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                  </p>
                  <FormField
                    control={resetPasswordForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      "Enviar enlace"
                    )}
                  </Button>
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setActiveTab("signin")}
                    >
                      Volver a Iniciar Sesión
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>

            {/* ===== TAB: CREAR CUENTA ===== */}
            <TabsContent value="signup" className="mt-4">
              {/* Mensaje informativo según contexto */}
              {!isDominioPrincipal && congregacion && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                  <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    Registro para <strong>{congregacion.nombre}</strong>
                  </p>
                </div>
              )}

              <Form {...signUpForm}>
                <form
                  onSubmit={signUpForm.handleSubmit(handleSignUp)}
                  className="space-y-4"
                >
                  {/* Datos personales */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={signUpForm.control}
                      name="nombre"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nombre</FormLabel>
                          <FormControl>
                            <Input placeholder="Juan" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signUpForm.control}
                      name="apellido"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Apellido</FormLabel>
                          <FormControl>
                            <Input placeholder="Pérez" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={signUpForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Correo electrónico</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="tu@email.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Mínimo 5 caracteres"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar contraseña</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="Repite tu contraseña"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Checkbox para crear congregación - SOLO en dominio principal */}
                  {isDominioPrincipal && (
                    <>
                      <Separator className="my-2" />
                      
                      <FormField
                        control={signUpForm.control}
                        name="crearCongregacion"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/30">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="font-medium cursor-pointer">
                                Crear una nueva congregación
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Serás el administrador de la nueva congregación
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />

                      {/* Campos de congregación - solo si está activo el checkbox */}
                      {crearCongregacion && (
                        <div className="space-y-4 p-4 rounded-lg border bg-background animate-in fade-in-50 slide-in-from-top-2">
                          <FormField
                            control={signUpForm.control}
                            name="congregacionNombre"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nombre de la Congregación</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      placeholder="Ej: VILLA REAL"
                                      {...field}
                                      value={field.value?.toUpperCase() || ""}
                                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                                      className={`uppercase ${nombreDuplicado ? "border-destructive pr-10" : "pr-10"}`}
                                    />
                                    {verificandoNombre && (
                                      <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                                    )}
                                    {!verificandoNombre && congregacionNombre && congregacionNombre.length >= 2 && (
                                      nombreDuplicado ? (
                                        <AlertCircle className="absolute right-3 top-2.5 h-4 w-4 text-destructive" />
                                      ) : (
                                        <Check className="absolute right-3 top-2.5 h-4 w-4 text-green-500" />
                                      )
                                    )}
                                  </div>
                                </FormControl>
                                {nombreDuplicado && (
                                  <p className="text-xs text-destructive">
                                    Ya existe una congregación con este nombre
                                  </p>
                                )}
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          {/* URL Privada */}
                          <FormField
                            control={signUpForm.control}
                            name="urlPrivada"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-center justify-between space-y-0 rounded-md border p-3 bg-muted/20">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-muted-foreground" />
                                    <FormLabel className="font-medium text-sm">URL Privada</FormLabel>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Genera una URL aleatoria que no revela el nombre
                                  </p>
                                </div>
                                <FormControl>
                                  <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />

                          {/* Preview de URL */}
                          {congregacionNombre && congregacionNombre.length >= 2 && !nombreDuplicado && (
                            <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                              <span className="font-medium">Tu URL será: </span>
                              <span className="text-primary">
                                {urlPrivada
                                  ? buildAuthUrl("xxxxxxxxxxxx")
                                  : buildAuthUrl(generateSlug(congregacionNombre))}
                              </span>
                            </div>
                          )}

                          {/* Selector de Color */}
                          <FormField
                            control={signUpForm.control}
                            name="colorPrimario"
                            render={({ field }) => (
                              <FormItem>
                                <ColorSelector
                                  value={field.value || "blue"}
                                  onChange={field.onChange}
                                  label="Color del tema"
                                />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}
                    </>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || (crearCongregacion && nombreDuplicado)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {crearCongregacion ? "Creando..." : "Registrando..."}
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {isDominioPrincipal && crearCongregacion 
                          ? "Crear Cuenta y Congregación" 
                          : "Crear Cuenta"
                        }
                      </>
                    )}
                  </Button>
                  
                  {/* Mensaje de aprobación - solo en subdominios */}
                  {!isDominioPrincipal && (
                    <p className="text-xs text-center text-muted-foreground">
                      Un administrador deberá aprobar tu cuenta antes de poder acceder
                    </p>
                  )}

                  {/* Mensaje informativo - solo en dominio principal sin checkbox */}
                  {isDominioPrincipal && !crearCongregacion && (
                    <p className="text-xs text-center text-muted-foreground">
                      Activa la opción de arriba para crear tu propia congregación
                    </p>
                  )}
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
