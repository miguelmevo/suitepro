import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useDatosS13 } from "@/hooks/useDatosS13";
import { descargarPdfS13 } from "@/lib/pdfS13";

interface Props {
  congregacionId: string;
  congregacionNombre: string;
  fechaInicio: string; // yyyy-MM-dd
  fechaFin: string; // yyyy-MM-dd
  className?: string;
}

/** Descarga el S-13 como PDF, con los mismos datos que la vista previa. */
export function BotonDescargarS13({ congregacionId, congregacionNombre, fechaInicio, fechaFin, className }: Props) {
  const { toast } = useToast();
  const { paginated, periodoLabel, cargando } = useDatosS13(congregacionId, fechaInicio, fechaFin);
  const [generando, setGenerando] = useState(false);

  const descargar = () => {
    setGenerando(true);
    // Deja pintar el aviso de "generando" antes del trabajo pesado.
    setTimeout(() => {
      try {
        const nombre = descargarPdfS13({ pages: paginated, congregacionNombre, periodoLabel });
        toast({ title: "PDF generado", description: nombre });
      } catch (e) {
        console.error(e);
        toast({ title: "No se pudo generar el PDF", variant: "destructive" });
      } finally {
        setGenerando(false);
      }
    }, 30);
  };

  return (
    <Button className={className ?? "gap-2"} onClick={descargar} disabled={cargando || generando}>
      {cargando || generando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      Descargar PDF
    </Button>
  );
}
