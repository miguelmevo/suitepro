import { useParams, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BottomNavPage } from "@/components/layout/BottomNavPage";
import { TerritorioFicha } from "@/components/territorios/TerritorioFicha";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Territorio como página completa. Es la vista de móvil y la que reciben los
 * enlaces directos antiguos (/territorio/:id). En escritorio se redirige al
 * listado con el territorio ya seleccionado, que muestra lista y ficha juntas.
 */
export default function TerritorioDetalle() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { territorioId } = useParams<{ territorioId: string }>();

  if (!territorioId) return <Navigate to="/territorios" replace />;
  if (!isMobile) return <Navigate to={`/territorios/${territorioId}`} replace />;

  return (
    <BottomNavPage className="p-4 md:p-6" contentClassName="max-w-2xl mx-auto space-y-4">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 -ml-2"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>
      <TerritorioFicha territorioId={territorioId} />
    </BottomNavPage>
  );
}
