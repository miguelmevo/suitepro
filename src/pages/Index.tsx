import { Link } from "react-router-dom";
import { Users, Calendar, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-2xl w-full text-center space-y-8 animate-fade-in">
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Gestión de Predicación
          </h1>
          <p className="text-muted-foreground text-lg">
            Organiza los grupos y programa de predicación de tu congregación
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-2">
                <Calendar className="h-6 w-6" />
              </div>
              <CardTitle>Programa de Predicación</CardTitle>
              <CardDescription>
                Planifica las salidas semanales, quincenales o mensuales
              </CardDescription>
              <Button asChild className="mt-4 gap-2">
                <Link to="/programa">
                  Ir al Programa
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-secondary-foreground mb-2">
                <Users className="h-6 w-6" />
              </div>
              <CardTitle>Grupos de Servicio</CardTitle>
              <CardDescription>
                Administra los grupos y sus miembros
              </CardDescription>
              <Button asChild variant="secondary" className="mt-4 gap-2">
                <Link to="/grupos">
                  Ir a Grupos
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;