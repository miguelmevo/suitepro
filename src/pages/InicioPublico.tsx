import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, LogIn, Loader2, AlertCircle } from "lucide-react";
import { useCongregacionBySlug } from "@/hooks/useCongregacionBySlug";
import { applyColorTheme, resetColorTheme } from "@/lib/congregation-colors";

export default function InicioPublico() {
  const { congregacion, isLoading, error, codigo } = useCongregacionBySlug();

  // Aplicar el tema de color de la congregación pública
  useEffect(() => {
    if (congregacion?.color_primario) {
      applyColorTheme(congregacion.color_primario);
    }
    return () => resetColorTheme();
  }, [congregacion?.color_primario]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !congregacion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-secondary to-muted p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Congregación no encontrada</CardTitle>
            <CardDescription>
              {error || "La URL no es válida o la congregación ya no está disponible."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/auth">
              <Button variant="outline">Ir al inicio</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const authUrl = `/auth?c=${codigo}`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-secondary to-muted p-4 flex items-center justify-center">
      <Card className="w-full max-w-2xl shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center gap-2 mb-2">
            <CalendarDays className="h-7 w-7 text-primary" />
            <Users className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold text-primary">
            {congregacion.nombre}
          </CardTitle>
          <CardDescription className="text-base">
            Programación de la Semana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Para ver la programación completa de reuniones y predicación, inicia sesión.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to={authUrl} className="flex-1">
              <Button className="w-full" size="lg">
                <LogIn className="mr-2 h-4 w-4" />
                Iniciar sesión
              </Button>
            </Link>
            <Link to="/territorios" className="flex-1">
              <Button variant="outline" className="w-full" size="lg">
                Ver territorios
              </Button>
            </Link>
          </div>

          <p className="text-xs text-center text-muted-foreground pt-4 border-t">
            Esta es la página pública de la congregación. Algunas funciones requieren cuenta.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
