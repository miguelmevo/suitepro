import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const WHATSAPP_ACCESS_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
const WHATSAPP_PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");

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
// sin código de país) al formato E.164 sin "+" que exige la API de WhatsApp.
// Si ya viene con código de país (empieza con "+" o con 2+ dígitos antes del
// "9"), se respeta tal cual.
function normalizarTelefono(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, "");
  if (telefono.trim().startsWith("+")) return soloDigitos;
  if (soloDigitos.length === 9 && soloDigitos.startsWith("9")) return `56${soloDigitos}`;
  return soloDigitos;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
      throw new Error("WhatsApp no está configurado (faltan credenciales en el servidor)");
    }

    const { telefono, nombre, intervencion, fecha, numero, sala }: EnviarAsignacionRequest = await req.json();

    if (!telefono || !nombre) {
      return new Response(JSON.stringify({ error: "Falta teléfono o nombre del destinatario" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const telefonoDestino = normalizarTelefono(telefono);

    const metaRes = await fetch(`https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: telefonoDestino,
        type: "template",
        template: {
          name: "asignacion_reunion",
          language: { code: "es_CL" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: nombre },
                { type: "text", text: intervencion },
                { type: "text", text: fecha },
                { type: "text", text: String(numero) },
                { type: "text", text: sala },
              ],
            },
          ],
        },
      }),
    });

    const metaData = await metaRes.json();

    if (!metaRes.ok) {
      console.error("Error de la API de WhatsApp:", metaData);
      const mensaje = metaData?.error?.error_user_msg || metaData?.error?.message || "Error al enviar el mensaje";
      return new Response(JSON.stringify({ error: mensaje, detalle: metaData }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true, metaData }), {
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
