import { Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, Loader2, AlertCircle } from "lucide-react";
import { useCongregacionBySlug } from "@/hooks/useCongregacionBySlug";
import { applyColorTheme, resetColorTheme } from "@/lib/congregation-colors";
import { ProgramaSemanal } from "@/components/programa/ProgramaSemanal";

export default function InicioPublico() {
  const { congregacion, isLoading, error, codigo } = useCongregacionBySlug();

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <h1 className="text-base sm:text-lg font-bold text-primary truncate">
            {congregacion.nombre}
          </h1>
          <Link to={authUrl}>
            <Button size="sm" className="gap-2">
              <LogIn className="h-4 w-4" />
              <span className="hidden sm:inline">Iniciar sesión</span>
              <span className="sm:hidden">Entrar</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="text-center space-y-0.5 md:space-y-2">
          <h2 className="font-display text-xl md:text-3xl font-bold tracking-tight text-primary">
            <span className="md:hidden">Programa Semanal</span>
            <span className="hidden md:inline">Programación de la Semana</span>
          </h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Consulta las actividades programadas
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
          <ProgramaSemanal publico congregacionId={congregacion.id} />
          {/* Vida y Ministerio y Reunión Pública se añadirán en Fase 2 */}
        </div>
      </main>
    </div>
  );
}
