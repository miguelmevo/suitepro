import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Loader2, CalendarDays, Users, Globe, Check, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// Schema extendido para registro con congregación
const signUpWithCongregationSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres"),
  email: z.string().email("Correo electrónico inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  crearCongregacion: z.boolean().default(false),
  congregacionNombre: z.string().optional(),
  urlPrivada: z.boolean().default(false),
});

type SignUpWithCongregationFormData = z.infer<typeof signUpWithCongregationSchema>;

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

  const signUpForm = useForm<SignUpWithCongregationFormData>({
    resolver: zodResolver(signUpWithCongregationSchema),
    defaultValues: {
      email: "",
      password: "",
      nombre: "",
      apellido: "",
      crearCongregacion: false,
      congregacionNombre: "",
      urlPrivada: false,
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

  // Verificar nombre duplicado
  useEffect(() => {
    if (!crearCongregacion || !congregacionNombre || congregacionNombre.length < 2) {
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
  }, [congregacionNombre, crearCongregacion]);

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

  const handleSignUp = async (data: SignUpWithCongregationFormData) => {
    // Validaciones
    if (data.crearCongregacion) {
      if (!data.congregacionNombre || data.congregacionNombre.length < 2) {
        toast({
          title: "Error",
          description: "El nombre de la congregación es requerido",
          variant: "destructive",
        });
        return;
      }
      if (nombreDuplicado) {
        toast({
          title: "Error",
          description: "Ya existe una congregación con ese nombre",
          variant: "destructive",
        });
        return;
      }
    }

    setIsSubmitting(true);
    
    try {
      // Primero crear el usuario
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

      // Si debe crear congregación, esperar a que el usuario esté autenticado y crearla
      if (data.crearCongregacion && data.congregacionNombre) {
        // Esperar un momento para que la sesión se establezca
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const slug = data.urlPrivada 
          ? generateRandomSlug() 
          : generateSlug(data.congregacionNombre);

        const { error: congError } = await supabase
          .from("congregaciones")
          .insert({
            nombre: data.congregacionNombre,
            slug: slug,
            activo: true,
            url_oculta: data.urlPrivada,
          });

        if (congError) {
          console.error("Error creando congregación:", congError);
          toast({
            title: "Cuenta creada",
            description: "Tu cuenta fue creada pero hubo un error al crear la congregación. Contacta al administrador.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "¡Bienvenido!",
            description: `Tu cuenta y congregación "${data.congregacionNombre}" fueron creadas exitosamente.`,
          });
        }
      }

      setIsSubmitting(false);
      navigate("/");
    } catch (error) {
      console.error("Error en registro:", error);
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
          <CardTitle className="text-2xl font-bold text-primary">SUITEPRO</CardTitle>
          <CardDescription>Sistema de gestión de asignaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registro</TabsTrigger>
            </TabsList>

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

            <TabsContent value="signup" className="mt-4">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Completa los datos para registrarte
              </p>
              <Form {...signUpForm}>
                <form
                  onSubmit={signUpForm.handleSubmit(handleSignUp)}
                  className="space-y-4"
                >
                  <p className="text-sm font-medium text-muted-foreground">Tus datos</p>
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
                            placeholder="Mínimo 6 caracteres"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator className="my-4" />

                  {/* Checkbox crear congregación */}
                  <FormField
                    control={signUpForm.control}
                    name="crearCongregacion"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="font-medium cursor-pointer">
                            Crear una nueva congregación
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Marca esta opción si serás el administrador de una nueva congregación
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />

                  {/* Campos de congregación */}
                  {crearCongregacion && (
                    <div className="pl-4 border-l-2 border-primary/20 space-y-4">
                      <FormField
                        control={signUpForm.control}
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
                          control={signUpForm.control}
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
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || (crearCongregacion && nombreDuplicado)}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        {crearCongregacion ? "Crear Cuenta y Congregación" : "Crear Cuenta"}
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
