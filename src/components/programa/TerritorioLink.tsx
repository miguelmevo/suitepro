import { ExternalLink, Ban } from "lucide-react";
import { Territorio } from "@/types/programa-predicacion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DireccionBloqueada {
  id: string;
  direccion: string;
  motivo: string | null;
}

interface TerritorioModalContentProps {
  territorio: Territorio;
}

function TerritorioModalContent({ territorio }: TerritorioModalContentProps) {
  const { data: direccionesBloqueadas = [] } = useQuery({
    queryKey: ['direcciones-bloqueadas-territorio', territorio.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direcciones_bloqueadas')
        .select('id, direccion, motivo')
        .eq('territorio_id', territorio.id)
        .eq('activo', true)
        .order('direccion');
      
      if (error) throw error;
      return data as DireccionBloqueada[];
    },
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Territorio {territorio.numero}</DialogTitle>
      </DialogHeader>
      
      {territorio.imagen_url && (
        <div className="flex justify-center">
          <img 
            src={territorio.imagen_url} 
            alt={`Territorio ${territorio.numero}`}
            className="max-w-full max-h-[50vh] object-contain rounded-lg"
          />
        </div>
      )}
      
      {territorio.url_maps && (
        <div className="flex justify-center">
          <a
            href={territorio.url_maps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline text-sm"
          >
            Ver en Google Maps
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}
      
      {direccionesBloqueadas.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h4 className="font-semibold text-destructive flex items-center gap-2 mb-3">
            <Ban className="h-4 w-4" />
            No Pasar - Territorio {territorio.numero}
          </h4>
          <ul className="space-y-2">
            {direccionesBloqueadas.map((dir) => (
              <li key={dir.id} className="text-sm border-l-2 border-destructive pl-3 py-1">
                <span className="font-medium">{dir.direccion}</span>
                {dir.motivo && (
                  <span className="text-muted-foreground ml-2">— {dir.motivo}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

interface TerritorioLinkProps {
  territorioIds: string[];
  territorios: Territorio[];
  className?: string;
}

export function TerritorioLink({ territorioIds, territorios, className = "" }: TerritorioLinkProps) {
  if (territorioIds.length === 0) return <span>-</span>;

  const territoriosData = territorioIds
    .map(id => territorios.find(t => t.id === id))
    .filter((t): t is Territorio => t !== undefined);

  if (territoriosData.length === 0) return <span>-</span>;

  // Si solo hay un territorio con imagen, mostrar como link directo
  if (territoriosData.length === 1) {
    const territorio = territoriosData[0];
    
    if (territorio.imagen_url) {
      return (
        <Dialog>
          <DialogTrigger asChild>
            <button 
              className={`inline-flex items-center gap-1 text-primary font-medium ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              {territorio.numero}
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <TerritorioModalContent territorio={territorio} />
          </DialogContent>
        </Dialog>
      );
    }
    
    return <span className={className}>{territorio.numero}</span>;
  }

  // Si hay múltiples territorios
  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {territoriosData.map((territorio, idx) => (
        <span key={territorio.id} className="inline-flex items-center">
          {idx > 0 && <span className="text-muted-foreground">, </span>}
          {territorio.imagen_url ? (
            <Dialog>
              <DialogTrigger asChild>
                <button 
                  className="inline-flex items-center gap-0.5 text-primary font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {territorio.numero}
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <TerritorioModalContent territorio={territorio} />
              </DialogContent>
            </Dialog>
          ) : (
            <span>{territorio.numero}</span>
          )}
        </span>
      ))}
    </span>
  );
}

// Versión para impresión/PDF con links directos
interface TerritorioLinkPrintProps {
  territorioIds: string[];
  territorios: Territorio[];
}

export function TerritorioLinkPrint({ territorioIds, territorios }: TerritorioLinkPrintProps) {
  if (territorioIds.length === 0) return null;

  const territoriosData = territorioIds
    .map(id => territorios.find(t => t.id === id))
    .filter((t): t is Territorio => t !== undefined);

  if (territoriosData.length === 0) return null;

  return (
    <>
      {territoriosData.map((territorio, idx) => (
        <span key={territorio.id}>
          {idx > 0 && ", "}
          {territorio.imagen_url ? (
            <a 
              href={territorio.imagen_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="territorio-link"
            >
              {territorio.numero}
            </a>
          ) : (
            <span>{territorio.numero}</span>
          )}
        </span>
      ))}
    </>
  );
}
