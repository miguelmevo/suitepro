import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
// Formato "whatsapp:+<numero>" (ej. "whatsapp:+17372212163" en el sandbox).
const TWILIO_WHATSAPP_FROM = Deno.env.get("TWILIO_WHATSAPP_FROM");
// Content SID de la plantilla "asignacion_reunion" creada en Twilio Content Template Builder.
const TWILIO_CONTENT_SID = Deno.env.get("TWILIO_CONTENT_SID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EnviarAsignacionRequest {
  telefono: string;
  nombre: string;
  intervencion: string;
  fecha: string;
  numero: number | string;
  sala: string;
}

// Normaliza un teléfono guardado como "9 8479 2142" (formato chileno local,
// sin código de país) al formato E.164 con "+" que exige Twilio. Si ya viene
// con código de país (empieza con "+"), se respeta tal cual.
function normalizarTelefono(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, "");
  if (telefono.trim().startsWith("+")) return `+${soloDigitos}`;
  if (soloDigitos.length === 9 && soloDigitos.startsWith("9")) return `+56${soloDigitos}`;
  return `+${soloDigitos}`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM || !TWILIO_CONTENT_SID) {
      throw new Error("WhatsApp (Twilio) no está configurado (faltan credenciales en el servidor)");
    }

    const { telefono, nombre, intervencion, fecha, numero, sala }: EnviarAsignacionRequest = await req.json();

    if (!telefono || !nombre) {
      return new Response(JSON.stringify({ error: "Falta teléfono o nombre del destinatario" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const telefonoDestino = normalizarTelefono(telefono);

    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const body = new URLSearchParams({
      From: TWILIO_WHATSAPP_FROM,
      To: `whatsapp:${telefonoDestino}`,
      ContentSid: TWILIO_CONTENT_SID,
      ContentVariables: JSON.stringify({
        "1": nombre,
        "2": intervencion || "Sin título",
        "3": fecha,
        "4": String(numero),
        "5": sala,
      }),
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("Error de la API de Twilio:", twilioData);
      const mensajeError = twilioData?.message || "Error al enviar el mensaje";
      return new Response(JSON.stringify({ error: mensajeError, detalle: twilioData }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, twilioData }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-whatsapp-asignacion function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
