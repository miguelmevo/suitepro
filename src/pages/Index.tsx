import { Link } from "react-router-dom";
import { Megaphone, Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight">
          PROGRAMAS
        </h1>
        <p className="text-muted-foreground text-lg">
          Crea tu programa y publícalo
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Card de Predicación */}
        <Card className="hover:shadow-lg transition-shadow group">
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground mb-2">
              <Megaphone className="h-6 w-6" />
            </div>
            <CardTitle>Predicación</CardTitle>
            <CardDescription>
              Programa mensual de predicación con horarios, territorios y capitanes
            </CardDescription>
            <Button asChild className="mt-4 gap-2">
              <Link to="/predicacion/programa">
                Ver Programa
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </CardHeader>
        </Card>

        {/* Card para agregar más programas (próximamente) */}
        <Card className="border-dashed hover:shadow-lg transition-shadow opacity-60">
          <CardHeader>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-muted-foreground mb-2">
              <Plus className="h-6 w-6" />
            </div>
            <CardTitle className="text-muted-foreground">Próximamente</CardTitle>
            <CardDescription>
              Más tipos de programas: Limpieza, Aseo, Asignaciones...
            </CardDescription>
            <Button variant="outline" disabled className="mt-4 gap-2">
              Agregar Programa
            </Button>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Index;