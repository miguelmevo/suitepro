import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-8 animate-fade-in">
        <div className="flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Users className="h-10 w-10" />
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Grupos de Servicio
          </h1>
          <p className="text-muted-foreground text-lg">
            Organiza y gestiona los grupos de predicación de tu congregación de manera sencilla
          </p>
        </div>

        <Button asChild size="lg" className="w-full sm:w-auto gap-2">
          <Link to="/grupos">
            Ir a Grupos de Servicio
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default Index;