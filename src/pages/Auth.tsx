import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
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
import { Separator } from "@/components/ui/separator";
import { Loader2, CalendarDays, Users, Globe, Check, AlertCircle, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Schema para registro con congregación (dominio principal)
const signUpWithCongregationSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  congregacionNombre: z.string().min(2, "El nombre de la congregación es requerido"),
  urlPrivada: z.boolean().default(false),
});

// Schema para registro normal (subdominio de congregación)
const signUpSimpleSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});

type SignUpWithCongregationFormData = z.infer<typeof signUpWithCongregationSchema>;
type SignUpSimpleFormData = z.infer<typeof signUpSimpleSchema>;

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
  const { user, loading: authLoading, signIn, signUp } = useAuth();
  const { congregacion, isLoading: slugLoading, error: slugError, isDominioPrincipal } = useCongregacionBySlug();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("signin");
  const [nombreDuplicado, setNombreDuplicado] = useState(false);
  const [verificandoNombre, setVerificandoNombre] = useState(false);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Form para crear congregación (dominio principal)
  const signUpWithCongForm = useForm<SignUpWithCongregationFormData>({
    resolver: zodResolver(signUpWithCongregationSchema),
    defaultValues: {
      email: "",
      password: "",
      nombre: "",
      apellido: "",
      congregacionNombre: "",
      urlPrivada: false,
    },
  });

  // Form para registro simple (subdominio)
  const signUpSimpleForm = useForm<SignUpSimpleFormData>({
    resolver: zodResolver(signUpSimpleSchema),
    defaultValues: {
      email: "",
      password: "",
      nombre: "",
      apellido: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const congregacionNombre = signUpWithCongForm.watch("congregacionNombre");
  const urlPrivada = signUpWithCongForm.watch("urlPrivada");

  // Verificar nombre duplicado (solo en dominio principal)
  useEffect(() => {
    if (!isDominioPrincipal || !congregacionNombre || congregacionNombre.length < 2) {
      setNombreDuplicado(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setVerificandoNombre(true);
      const { data } = await supabase
        .from("congregaciones")
        .select("id")
        .ilike("nombre", congregacionNombre)
        .limit(1);
      
      setNombreDuplicado(data && data.length > 0);
      setVerificandoNombre(false);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [congregacionNombre, isDominioPrincipal]);

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (user && !authLoading) {
      navigate("/");
    }
  }, [user, authLoading, navigate]);

  const handleSignIn = async (data: SignInFormData) => {
    setIsSubmitting(true);
    const { error } = await signIn(data.email, data.password);
    setIsSubmitting(false);
    if (!error) {
      navigate("/");
    }
  };

  const handleResetPassword = async (data: ResetPasswordFormData) => {
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setIsSubmitting(false);
    
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Correo enviado",
        description: "Revisa tu bandeja de entrada para restablecer tu contraseña.",
      });
      setActiveTab("signin");
    }
  };

  // Registro CON creación de congregación (dominio principal)
  const handleSignUpWithCongregation = async (data: SignUpWithCongregationFormData) => {
    if (nombreDuplicado) {
      toast({
        title: "Error",
        description: "Ya existe una congregación con ese nombre",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Crear usuario
      const { error: signUpError } = await signUp(
        data.email,
        data.password,
        data.nombre,
        data.apellido
      );

      if (signUpError) {
        setIsSubmitting(false);
        return;
      }

      // 2. Esperar a que la sesión se establezca
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 3. Crear la congregación
      const slug = data.urlPrivada 
        ? generateRandomSlug() 
        : generateSlug(data.congregacionNombre);

      const { data: newCong, error: congError } = await supabase
        .from("congregaciones")
        .insert({
          nombre: data.congregacionNombre,
          slug: slug,
          activo: true,
          url_oculta: data.urlPrivada,
        })
        .select("id")
        .single();

      if (congError) {
        console.error("Error creando congregación:", congError);
        toast({
          title: "Cuenta creada",
          description: "Tu cuenta fue creada pero hubo un error al crear la congregación. Contacta al administrador.",
          variant: "destructive",
        });
        // Cerrar sesión para que pueda reintentar
        await supabase.auth.signOut();
        setIsSubmitting(false);
        return;
      }

      // 4. Auto-aprobar al creador usando la función RPC
      const { error: approveError } = await supabase.rpc("approve_congregation_creator", {
        _congregacion_id: newCong.id,
      });

      if (approveError) {
        console.error("Error aprobando usuario:", approveError);
      }

      // 5. Cerrar sesión y mostrar mensaje de éxito
      await supabase.auth.signOut();
      
      toast({
        title: "¡Congregación creada!",
        description: `Tu congregación "${data.congregacionNombre}" fue creada. Ahora inicia sesión en: ${slug}.suitepro.org`,
      });
      
      setIsSubmitting(false);
      setActiveTab("signin");
      signInForm.setValue("email", data.email);
      
    } catch (error) {
      console.error("Error en registro:", error);
      setIsSubmitting(false);
    }
  };

  // Registro SIMPLE (subdominio de congregación)
  const handleSignUpSimple = async (data: SignUpSimpleFormData) => {
    if (!congregacion) {
      toast({
        title: "Error",
        description: "No se pudo identificar la congregación",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Crear usuario
      const { error: signUpError } = await signUp(
        data.email,
        data.password,
        data.nombre,
        data.apellido
      );

      if (signUpError) {
        setIsSubmitting(false);
        return;
      }

      // 2. Esperar a que la sesión se establezca
      await new Promise(resolve => setTimeout(resolve, 1500));

      // 3. Vincular usuario a la congregación como "user" (pendiente de aprobación)
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase
          .from("usuarios_congregacion")
          .insert({
            user_id: userData.user.id,
            congregacion_id: congregacion.id,
            rol: "user",
            es_principal: true,
            activo: true,
          });
      }

      // 4. Cerrar sesión (el admin debe aprobar)
      await supabase.auth.signOut();
      
      toast({
        title: "Registro exitoso",
        description: "Tu cuenta ha sido creada. Un administrador debe aprobar tu acceso.",
      });
      
      setIsSubmitting(false);
      setActiveTab("signin");
      signInForm.setValue("email", data.email);
      
    } catch (error) {
      console.error("Error en registro:", error);
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
            <Button variant="outline" onClick={() => window.location.href = "https://suitepro.org/auth"}>
              Ir a SUITEPRO principal
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
              ? "Crea tu congregación y administra tus programas" 
              : "Sistema de gestión de asignaciones"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">
                {isDominioPrincipal ? "Crear Congregación" : "Registro"}
              </TabsTrigger>
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

            {/* ===== TAB: REGISTRO ===== */}
            <TabsContent value="signup" className="mt-4">
              {isDominioPrincipal ? (
                // ===== DOMINIO PRINCIPAL: Crear congregación =====
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                    <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Crea tu congregación y serás su administrador
                    </p>
                  </div>
                  <Form {...signUpWithCongForm}>
                    <form
                      onSubmit={signUpWithCongForm.handleSubmit(handleSignUpWithCongregation)}
                      className="space-y-4"
                    >
                      <p className="text-sm font-medium text-muted-foreground">Tus datos</p>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={signUpWithCongForm.control}
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
                          control={signUpWithCongForm.control}
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
                        control={signUpWithCongForm.control}
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
                        control={signUpWithCongForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Mínimo 6 caracteres"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator className="my-4" />

                      <p className="text-sm font-medium text-muted-foreground">Tu congregación</p>
                      
                      <FormField
                        control={signUpWithCongForm.control}
                        name="congregacionNombre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nombre de la Congregación</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  placeholder="Ej: Villa Real"
                                  {...field}
                                  className={nombreDuplicado ? "border-destructive" : ""}
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
                      <div className="rounded-lg border p-3 bg-muted/30">
                        <FormField
                          control={signUpWithCongForm.control}
                          name="urlPrivada"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2">
                                  <Globe className="h-4 w-4 text-muted-foreground" />
                                  <FormLabel className="font-medium">URL Privada</FormLabel>
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
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={isSubmitting || nombreDuplicado}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creando...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Crear Cuenta y Congregación
                          </>
                        )}
                      </Button>
                    </form>
                  </Form>
                </>
              ) : (
                // ===== SUBDOMINIO: Registro simple en congregación existente =====
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 mb-4">
                    <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
                    <p className="text-sm text-muted-foreground">
                      Registro para <strong>{congregacion?.nombre}</strong>
                    </p>
                  </div>
                  <Form {...signUpSimpleForm}>
                    <form
                      onSubmit={signUpSimpleForm.handleSubmit(handleSignUpSimple)}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={signUpSimpleForm.control}
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
                          control={signUpSimpleForm.control}
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
                        control={signUpSimpleForm.control}
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
                        control={signUpSimpleForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contraseña</FormLabel>
                            <FormControl>
                              <Input
                                type="password"
                                placeholder="Mínimo 6 caracteres"
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
                            Registrando...
                          </>
                        ) : (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Crear Cuenta
                          </>
                        )}
                      </Button>
                      
                      <p className="text-xs text-center text-muted-foreground">
                        Un administrador deberá aprobar tu cuenta antes de poder acceder
                      </p>
                    </form>
                  </Form>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
