import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function RegistroExitoso() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-2xl">¡Registro Exitoso!</CardTitle>
          <CardDescription>Tu cuenta ha sido creada correctamente</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            Tu cuenta ha sido creada exitosamente, pero aún debe ser aprobada por un administrador de la congregación.
          </p>
          <p className="text-muted-foreground">
            Por favor, espera a que un administrador revise y apruebe tu solicitud de acceso antes de iniciar sesión.
          </p>
          <div className="pt-4">
            <Button onClick={() => navigate("/auth")} className="gap-2">
              Ir a Iniciar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
