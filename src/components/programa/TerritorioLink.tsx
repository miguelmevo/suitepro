import { ExternalLink, Image } from "lucide-react";
import { Territorio } from "@/types/programa-predicacion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
              className={`inline-flex items-center gap-1 text-primary hover:underline font-medium ${className}`}
              onClick={(e) => e.stopPropagation()}
            >
              {territorio.numero}
              <Image className="h-3 w-3" />
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Territorio {territorio.numero}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center">
              <img 
                src={territorio.imagen_url} 
                alt={`Territorio ${territorio.numero}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
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
                  className="inline-flex items-center gap-0.5 text-primary hover:underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  {territorio.numero}
                  <Image className="h-3 w-3" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-3xl max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Territorio {territorio.numero}</DialogTitle>
                </DialogHeader>
                <div className="flex justify-center">
                  <img 
                    src={territorio.imagen_url} 
                    alt={`Territorio ${territorio.numero}`}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
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
