import { Territorio } from "@/types/programa-predicacion";

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

  // Función para abrir la página del territorio en nueva pestaña
  const openTerritorioPage = (e: React.MouseEvent, territorioId: string) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(`/territorio/${territorioId}`, '_blank');
  };

  // Si solo hay un territorio
  if (territoriosData.length === 1) {
    const territorio = territoriosData[0];
    
    return (
      <button 
        className={`inline-flex items-center gap-1 text-primary font-medium hover:underline ${className}`}
        onClick={(e) => openTerritorioPage(e, territorio.id)}
      >
        {territorio.numero}
      </button>
    );
  }

  // Si hay múltiples territorios
  return (
    <span className={`inline-flex items-center gap-1 flex-wrap ${className}`}>
      {territoriosData.map((territorio, idx) => (
        <span key={territorio.id} className="inline-flex items-center">
          {idx > 0 && <span className="text-muted-foreground">, </span>}
          <button 
            className="inline-flex items-center gap-0.5 text-primary font-medium hover:underline"
            onClick={(e) => openTerritorioPage(e, territorio.id)}
          >
            {territorio.numero}
          </button>
        </span>
      ))}
    </span>
  );
}

// Versión para impresión/PDF con links a la página de detalles del territorio
interface TerritorioLinkPrintProps {
  territorioIds: string[];
  territorios: Territorio[];
  baseUrl?: string;
}

export function TerritorioLinkPrint({ territorioIds, territorios, baseUrl }: TerritorioLinkPrintProps) {
  if (territorioIds.length === 0) return null;

  const territoriosData = territorioIds
    .map(id => territorios.find(t => t.id === id))
    .filter((t): t is Territorio => t !== undefined);

  if (territoriosData.length === 0) return null;

  // Usar baseUrl proporcionado o el origen actual
  const urlBase = baseUrl || window.location.origin;

  return (
    <>
      {territoriosData.map((territorio, idx) => (
        <span key={territorio.id}>
          {idx > 0 && ", "}
          <a 
            href={`${urlBase}/territorio/${territorio.id}`}
            target="_blank" 
            rel="noopener noreferrer"
            className="territorio-link"
          >
            {territorio.numero}
          </a>
        </span>
      ))}
    </>
  );
}
