import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { descargarBlob } from "@/lib/pdfDesdeElemento";

/**
 * Vista previa del PDF exactamente como se va a descargar: se genera el mismo archivo
 * y se muestra en pantalla; desde acá se confirma la descarga.
 */
export function PdfVistaPreviaDialog({
  open,
  onOpenChange,
  titulo,
  nombreArchivo,
  crearBlob,
  onDescargado,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  /** Nombre del archivo, con .pdf */
  nombreArchivo: string;
  crearBlob: () => Blob | Promise<Blob>;
  onDescargado?: (archivo: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  // La función cambia en cada render del padre; sólo importa al abrir.
  const crearRef = useRef(crearBlob);
  crearRef.current = crearBlob;

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    let objUrl: string | null = null;
    setUrl(null);
    setError(false);
    (async () => {
      try {
        // Deja que la ventana se pinte antes de generar el archivo.
        await new Promise((r) => setTimeout(r, 50));
        const blob = await crearRef.current();
        if (!vivo) return;
        blobRef.current = blob;
        objUrl = URL.createObjectURL(blob);
        setUrl(objUrl);
      } catch (e) {
        console.error(e);
        if (vivo) setError(true);
      }
    })();
    return () => {
      vivo = false;
      if (objUrl) URL.revokeObjectURL(objUrl);
      blobRef.current = null;
    };
  }, [open]);

  const descargar = () => {
    if (!blobRef.current) return;
    descargarBlob(blobRef.current, nombreArchivo);
    onDescargado?.(nombreArchivo);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-[95vw] w-[95vw] flex-col gap-3 sm:max-w-[1100px]">
        <DialogHeader>
          <DialogTitle className="uppercase">Vista previa del PDF - {titulo}</DialogTitle>
          <DialogDescription>Así se verá el archivo que se va a descargar.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-hidden rounded-md border bg-muted/40">
          {error ? (
            <p className="p-6 text-center text-sm text-destructive">No se pudo generar el PDF.</p>
          ) : !url ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generando el PDF...
            </div>
          ) : (
            <iframe title="Vista previa del PDF" src={url} className="h-full w-full bg-white" />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={descargar}
            disabled={!url}
            className="gap-2 bg-teal-600 text-white hover:bg-teal-700"
          >
            <Download className="h-4 w-4" />
            Descargar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
