import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  FormDescription,
} from "@/components/ui/form";
import { Loader2, CalendarDays, Users, Building2, Globe, Lock, Check } from "lucide-react";
import { toast } from "sonner";

// Schema de validación
const registroSchema = z.object({
  nombre: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(50),
  apellido: z.string().min(2, "El apellido debe tener al menos 2 caracteres").max(50),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  congregacionNombre: z.string().min(3, "El nombre de la congregación debe tener al menos 3 caracteres").max(100),
  urlPrivada: z.boolean().default(false),
});

type RegistroFormData = z.infer<typeof registroSchema>;

// Genera un identificador aleatorio para URLs ocultas
function generarSlugAleatorio(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Genera slug desde nombre
function generarSlugDesdeNombre(nombre: string): string {
  return nombre.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Landing() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"info" | "form">("info");

  const form = useForm<RegistroFormData>({
    resolver: zodResolver(registroSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      congregacionNombre: "",
      urlPrivada: false,
    },
  });

  const urlPrivada = form.watch("urlPrivada");
  const congregacionNombre = form.watch("congregacionNombre");

  const handleSubmit = async (data: RegistroFormData) => {
    setIsSubmitting(true);
    
    try {
      // 1. Registrar usuario
      const redirectUrl = `${window.location.origin}/`;
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            nombre: data.nombre,
            apellido: data.apellido,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered")) {
          toast.error("Este correo ya está registrado. Inicia sesión en su lugar.");
        } else {
          toast.error("Error al crear cuenta: " + authError.message);
        }
        setIsSubmitting(false);
        return;
      }

      if (!authData.user) {
        toast.error("Error al crear la cuenta");
        setIsSubmitting(false);
        return;
      }

      // 2. Crear congregación (el trigger asignará automáticamente al usuario como admin)
      const slug = data.urlPrivada 
        ? generarSlugAleatorio() 
        : generarSlugDesdeNombre(data.congregacionNombre);

      const { data: congregacionData, error: congregacionError } = await supabase
        .from("congregaciones")
        .insert({
          nombre: data.congregacionNombre,
          slug,
          activo: true,
          url_oculta: data.urlPrivada,
        })
        .select()
        .single();

      if (congregacionError) {
        console.error("Error al crear congregación:", congregacionError);
        toast.error("Error al crear la congregación: " + congregacionError.message);
        setIsSubmitting(false);
        return;
      }

      toast.success("¡Cuenta y congregación creadas exitosamente!");
      
      // Redirigir al inicio (el usuario estará logueado)
      navigate("/");
      
    } catch (error) {
      console.error("Error inesperado:", error);
      toast.error("Ocurrió un error inesperado");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vista informativa inicial
  if (step === "info") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 via-background to-secondary/20">
        {/* Header */}
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl text-primary">SUITEPRO</span>
            </div>
            <Link to="/auth">
              <Button variant="outline">Iniciar Sesión</Button>
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="max-w-3xl mx-auto space-y-6">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Gestiona tu congregación de forma{" "}
              <span className="text-primary">simple y organizada</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground">
              Sistema completo para la gestión de asignaciones, territorios y programas de predicación.
              Crea tu espacio privado en minutos.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" onClick={() => setStep("form")} className="gap-2">
                <Building2 className="h-5 w-5" />
                Crear mi Congregación
              </Button>
              <Link to="/auth">
                <Button size="lg" variant="outline">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-16">
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <CalendarDays className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Programas Organizados</CardTitle>
                <CardDescription>
                  Crea y gestiona programas de predicación semanales y mensuales de forma visual e intuitiva.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Gestión de Participantes</CardTitle>
                <CardDescription>
                  Administra los participantes, sus asignaciones y disponibilidad con facilidad.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>Tu Propio Espacio</CardTitle>
                <CardDescription>
                  Cada congregación tiene su URL única y privada. Tus datos están protegidos.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <Card className="max-w-2xl mx-auto border-0 shadow-xl bg-primary text-primary-foreground">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                ¿Listo para comenzar?
              </h2>
              <p className="text-primary-foreground/80 mb-6">
                Crea tu congregación en menos de 2 minutos. Sin costo inicial.
              </p>
              <Button 
                size="lg" 
                variant="secondary" 
                onClick={() => setStep("form")}
                className="gap-2"
              >
                <Check className="h-5 w-5" />
                Crear mi Congregación Ahora
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t py-8 mt-8">
          <div className="container mx-auto px-4 text-center text-muted-foreground text-sm">
            <p>© {new Date().getFullYear()} SUITEPRO. Sistema de gestión para congregaciones.</p>
          </div>
        </footer>
      </div>
    );
  }

  // Formulario de registro
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
      <Card className="w-full max-w-lg shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <Button 
            variant="ghost" 
            className="absolute left-4 top-4"
            onClick={() => setStep("info")}
          >
            ← Volver
          </Button>
          <div className="flex justify-center gap-2 mb-2 pt-4">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold text-primary">
            Crear Nueva Congregación
          </CardTitle>
          <CardDescription>
            Completa los datos para crear tu cuenta y congregación
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Datos personales */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">Tus datos</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
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
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Correo electrónico</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="tu@email.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
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
              </div>

              {/* Datos de congregación */}
              <div className="space-y-3 pt-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground">Tu congregación</h3>
                <FormField
                  control={form.control}
                  name="congregacionNombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Congregación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Villa Real" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="urlPrivada"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base flex items-center gap-2">
                          {field.value ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                          URL Privada
                        </FormLabel>
                        <FormDescription>
                          Genera una URL aleatoria que no revela el nombre
                        </FormDescription>
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
                {congregacionNombre && (
                  <div className="p-3 bg-muted rounded-md text-sm">
                    <span className="text-muted-foreground">Tu URL será: </span>
                    <span className="font-mono font-medium">
                      {urlPrivada 
                        ? "xxxxxxxxxx.suitepro.org" 
                        : `${generarSlugDesdeNombre(congregacionNombre)}.suitepro.org`}
                    </span>
                    {urlPrivada && (
                      <p className="text-xs text-muted-foreground mt-1">
                        (se generará un código aleatorio al crear)
                      </p>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full mt-6"
                size="lg"
                disabled={isSubmitting}
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

              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link to="/auth" className="text-primary hover:underline">
                  Inicia sesión
                </Link>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
