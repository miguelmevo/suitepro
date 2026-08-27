import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useParticipantes } from "@/hooks/useParticipantes";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  /** A quién se le envía el mensaje (se busca su teléfono). */
  destinatarioId: string | null;
  /** Estudiante que hace la intervención (campo "Nombre" del S-89). */
  titularId: string | null;
  /** Ayudante, si corresponde (campo "Ayudante" del S-89). */
  ayudanteId?: string | null;
  /** Título de la intervención (ej. "Empiece conversaciones"). */
  intervencion: string;
  /** Número de la intervención en el programa. */
  numero: number;
  /** Fecha de la reunión (YYYY-MM-DD). */
  fecha: string;
  /** Sala donde se presentará (ej. "Sala principal"). */
  sala: string;
  disabled?: boolean;
}

function nombreCompleto(p?: { nombre: string; apellido: string } | null) {
  if (!p) return null;
  return `${p.nombre} ${p.apellido}`.trim();
}

export function EnviarAsignacionWhatsApp({
  destinatarioId,
  titularId,
  ayudanteId,
  intervencion,
  numero,
  fecha,
  sala,
  disabled,
}: Props) {
  const { todosParticipantes } = useParticipantes();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const destinatario = todosParticipantes.find((p) => p.id === destinatarioId);
  const titular = todosParticipantes.find((p) => p.id === titularId);
  const ayudante = ayudanteId ? todosParticipantes.find((p) => p.id === ayudanteId) : null;
  const tieneTelefono = !!destinatario?.telefono;

  const fechaFormateada = (() => {
    try {
      return format(parseISO(fecha), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    } catch {
      return fecha;
    }
  })();
  const fechaCorta = (() => {
    try {
      return format(parseISO(fecha), "d 'de' MMMM", { locale: es });
    } catch {
      return fecha;
    }
  })();

  const handleEnviar = async () => {
    if (!destinatario?.telefono) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-asignacion", {
        body: {
          telefono: destinatario.telefono,
          nombre: destinatario.nombre,
          intervencion: intervencion || "Sin título",
          fecha: fechaFormateada,
          numero,
          sala,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Mensaje enviado", description: `Se envió la asignación a ${destinatario.nombre}.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "No se pudo enviar", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  if (!destinatarioId) return null;

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 shrink-0 disabled:opacity-30"
        disabled={disabled || !tieneTelefono}
        title={tieneTelefono ? "Enviar asignación por WhatsApp" : "Sin teléfono registrado"}
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar asignación por WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Se enviará a</p>
              <p className="font-medium">
                {destinatario?.nombre} {destinatario?.apellido}
                {destinatario?.telefono && (
                  <span className="text-muted-foreground font-normal"> — {destinatario.telefono}</span>
                )}
              </p>
            </div>

            {/* Vista previa de la hoja S-89 (Asignación para la reunión Vida y Ministerio) */}
            <div className="rounded-lg border-2 border-foreground/20 bg-background p-4 space-y-3">
              <p className="text-center font-bold uppercase leading-tight">
                Asignación para la reunión
                <br />
                Vida y Ministerio Cristianos
              </p>
              <div className="space-y-2 pt-1">
                <div>
                  <span className="font-semibold">Nombre: </span>
                  {nombreCompleto(titular) ?? <span className="text-muted-foreground">—</span>}
                </div>
                <div>
                  <span className="font-semibold">Ayudante: </span>
                  {nombreCompleto(ayudante) ?? <span className="text-muted-foreground">—</span>}
                </div>
                <div>
                  <span className="font-semibold">Fecha: </span>
                  {fechaCorta}
                </div>
                <div>
                  <span className="font-semibold">Intervención núm.: </span>
                  {numero}
                </div>
              </div>
              <div className="pt-1">
                <p className="font-semibold mb-1">Se presentará en:</p>
                {(["Sala principal", "Sala auxiliar núm. 1", "Sala auxiliar núm. 2"] as const).map((opcion) => (
                  <div key={opcion} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-3.5 w-3.5 border border-foreground/60 shrink-0",
                        sala === opcion && "bg-foreground",
                      )}
                    />
                    <span>{opcion}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Mensaje de WhatsApp</p>
              <div className="rounded-md bg-muted/50 p-3 whitespace-pre-line text-xs text-muted-foreground">
{`Hola ${destinatario?.nombre}, tienes una asignación en la reunión Vida y Ministerio:

📋 ${intervencion || "Sin título"}
📅 ${fechaFormateada}
🔢 Intervención N° ${numero}
📍 ${sala}

Repasa la Guía de actividades para tu intervención.`}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleEnviar} disabled={enviando}>
              {enviando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar y enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
