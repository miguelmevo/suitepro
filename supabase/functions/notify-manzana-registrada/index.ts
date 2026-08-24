import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ManzanaRegistradaRequest {
  congregacionId: string;
  territorioId: string;
  manzanaId: string;
  fechaTrabajada: string;
  marcadoPor?: string | null;
}

function sb(path: string) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "apikey": SUPABASE_SERVICE_ROLE_KEY,
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
}

function ok(message: string) {
  return new Response(JSON.stringify({ message }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function emailHeader(): string {
  const iconCalendar = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/></svg>`;
  const iconUsers = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;">
      <tr>
        <td align="center" style="padding:28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;padding-right:6px;">${iconCalendar}</td>
              <td style="vertical-align:middle;padding-right:12px;">${iconUsers}</td>
              <td style="vertical-align:middle;">
                <span style="font-family:Arial,sans-serif;font-size:22px;font-weight:bold;color:#3b82f6;letter-spacing:0.5px;">SUITEPRO</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

function emailFooter(): string {
  return `
    <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:32px;">
      Este es un mensaje automático de SuitePro. No respondas a este correo.
    </p>
  `;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { congregacionId, territorioId, manzanaId, fechaTrabajada, marcadoPor }: ManzanaRegistradaRequest = await req.json();

    if (!congregacionId || !territorioId || !manzanaId) {
      return ok("Faltan datos, no se notificó a nadie");
    }

    // 1. ¿Está activa la notificación para esta congregación, y a quién?
    const configRes = await sb(
      `configuracion_sistema?congregacion_id=eq.${congregacionId}&programa_tipo=eq.predicacion&clave=eq.notificar_manzanas&select=valor`,
    );
    const configRows = await configRes.json();
    const config = configRows?.[0]?.valor as { activo?: boolean; destinatarios?: string[] } | undefined;

    if (!config?.activo || !config.destinatarios || config.destinatarios.length === 0) {
      return ok("Notificación desactivada o sin destinatarios, se omite");
    }

    // 2. Datos del territorio, la manzana, la congregación y quién la marcó.
    const [territorioRes, manzanaRes, congRes] = await Promise.all([
      sb(`territorios?id=eq.${territorioId}&select=numero,nombre`),
      sb(`manzanas_territorio?id=eq.${manzanaId}&select=letra`),
      sb(`congregaciones?id=eq.${congregacionId}&select=nombre`),
    ]);
    const [territorio] = await territorioRes.json();
    const [manzana] = await manzanaRes.json();
    const [cong] = await congRes.json();

    let marcadoPorNombre = "Alguien";
    if (marcadoPor) {
      const marcadoRes = await sb(`profiles?id=eq.${marcadoPor}&select=nombre,apellido`);
      const [perfil] = await marcadoRes.json();
      if (perfil) marcadoPorNombre = `${perfil.nombre ?? ""} ${perfil.apellido ?? ""}`.trim() || "Alguien";
    }

    // 3. Emails de los destinatarios configurados.
    const destRes = await sb(`profiles?id=in.(${config.destinatarios.join(",")})&select=email`);
    const destPerfiles = await destRes.json();
    const destEmails = (destPerfiles || []).filter((p: any) => p.email).map((p: any) => p.email);

    if (destEmails.length === 0) {
      return ok("Ningún destinatario configurado tiene email");
    }

    const isDevProject = SUPABASE_URL.includes("sfgnveuwitsaiflqjdsc");
    const baseUrl = isDevProject ? "https://dev.suitepro.org" : "https://suitepro.org";
    const territorioLabel = territorio
      ? `Territorio ${territorio.numero}${territorio.nombre ? ` - ${territorio.nombre}` : ""}`
      : "un territorio";
    const letra = manzana?.letra ?? "?";
    const fechaLabel = new Date(`${fechaTrabajada}T12:00:00`).toLocaleDateString("es-CL", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <noreply@suitepro.org>",
        to: destEmails,
        subject: `Manzana registrada — ${territorioLabel}`,
        html: `
          <div style="background-color:#f3f4f6;padding:24px 0;">
            ${emailHeader()}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 24px auto 0; background-color:#ffffff; border-radius:12px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="color: #2563eb; margin-top:0;">Manzana trabajada registrada</h1>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin:0 0 8px;"><strong>Territorio:</strong> ${territorioLabel}</p>
                <p style="margin:0 0 8px;"><strong>Manzana:</strong> ${letra}</p>
                <p style="margin:0 0 8px;"><strong>Registrado por:</strong> ${marcadoPorNombre}</p>
                <p style="margin:0;"><strong>Fecha:</strong> ${fechaLabel}</p>
              </div>
              <p>Congregación: ${cong?.nombre ?? ""}</p>
              <div style="margin: 24px 0;">
                <a href="${baseUrl}/territorios/${territorioId}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Ver territorio
                </a>
              </div>
              ${emailFooter()}
            </div>
          </div>
        `,
      }),
    });

    const emailResponse = await emailRes.json();
    console.log("Manzana registrada email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in notify-manzana-registrada function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
