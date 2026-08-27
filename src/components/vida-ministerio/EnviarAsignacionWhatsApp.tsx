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

interface Props {
  participanteId: string | null;
  /** Título de la intervención (ej. "Empiece conversaciones"). */
  intervencion: string;
  /** Número de la intervención en el programa (ej. "4."). */
  numero: number;
  /** Fecha de la reunión (YYYY-MM-DD). */
  fecha: string;
  /** Sala donde se presentará (ej. "Sala principal"). */
  sala: string;
  disabled?: boolean;
}

export function EnviarAsignacionWhatsApp({ participanteId, intervencion, numero, fecha, sala, disabled }: Props) {
  const { todosParticipantes } = useParticipantes();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const participante = todosParticipantes.find((p) => p.id === participanteId);
  const tieneTelefono = !!participante?.telefono;
  const fechaFormateada = (() => {
    try {
      return format(parseISO(fecha), "EEEE d 'de' MMMM", { locale: es });
    } catch {
      return fecha;
    }
  })();

  const handleEnviar = async () => {
    if (!participante?.telefono) return;
    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-whatsapp-asignacion", {
        body: {
          telefono: participante.telefono,
          nombre: `${participante.nombre} ${participante.apellido}`.trim(),
          intervencion: intervencion || "Sin título",
          fecha: fechaFormateada,
          numero,
          sala,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Mensaje enviado", description: `Se envió la asignación a ${participante.nombre}.` });
      setOpen(false);
    } catch (e: any) {
      toast({ title: "No se pudo enviar", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  if (!participanteId) return null;

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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Enviar asignación por WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Destinatario</p>
              <p>{participante?.nombre} {participante?.apellido} — {participante?.telefono}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-0.5">Vista previa del mensaje</p>
              <div className="rounded-md bg-muted/50 p-3 whitespace-pre-line">
{`Hola ${participante?.nombre}, tienes una asignación en la reunión Vida y Ministerio:

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
