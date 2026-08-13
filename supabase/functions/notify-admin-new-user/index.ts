import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewUserNotificationRequest {
  userId: string;
  userEmail: string;
  userName: string;
  userApellido: string;
  congregacionId?: string;
}

// Cabecera/pie con la marca de SuitePro, en tabla (compatible con Outlook de
// escritorio). Los íconos son los mismos de la pantalla de login (lucide
// "calendar-days" + "users") como SVG inline con fondo transparente y color
// fijo — no dependen del PNG del PWA (que trae fondo/esquinas propias) ni
// del modo claro/oscuro del cliente de correo del destinatario.
function emailHeader(_baseUrl: string): string {
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
  console.log("notify-admin-new-user function called");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, userApellido, congregacionId }: NewUserNotificationRequest = await req.json();
    console.log(`Processing notification for new user: ${userEmail} (congregacion ${congregacionId ?? "?"})`);

    if (!congregacionId) {
      console.log("No congregacionId provided — no se puede acotar la notificación, se omite");
      return new Response(JSON.stringify({ message: "Falta congregacionId, no se notificó a nadie" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Admins de ESA congregación (no de todas): usuarios_congregacion, rol=admin, activo=true.
    const adminRolesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/usuarios_congregacion?congregacion_id=eq.${congregacionId}&rol=eq.admin&activo=eq.true&select=user_id`,
      {
        headers: {
          "apikey": SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const adminRoles = await adminRolesRes.json();

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify for this congregacion");
      return new Response(JSON.stringify({ message: "No hay administradores para notificar en esta congregación" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const adminUserIds = adminRoles.map((r: any) => r.user_id);
    const profilesRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${adminUserIds.join(",")})&select=email`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const adminProfiles = await profilesRes.json();
    const adminEmails = adminProfiles?.filter((p: any) => p.email).map((p: any) => p.email) || [];

    if (adminEmails.length === 0) {
      return new Response(JSON.stringify({ message: "No admin emails found" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const isDevProject = SUPABASE_URL.includes("sfgnveuwitsaiflqjdsc");
    const baseUrl = isDevProject ? "https://dev.suitepro.org" : "https://suitepro.org";
    const usuariosUrl = `${baseUrl}/configuracion/usuarios`;

    // Send email via Resend REST API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <noreply@suitepro.org>",
        to: adminEmails,
        subject: "Nuevo usuario pendiente de aprobación",
        html: `
          <div style="background-color:#f3f4f6;padding:24px 0;">
            ${emailHeader(baseUrl)}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 24px auto 0; background-color:#ffffff; border-radius:12px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="color: #2563eb; margin-top:0;">Nuevo Usuario Registrado</h1>
              <p>Un nuevo usuario se ha registrado y está pendiente de aprobación:</p>
              <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin:0 0 8px;"><strong>Nombre:</strong> ${userName} ${userApellido}</p>
                <p style="margin:0;"><strong>Email:</strong> ${userEmail}</p>
              </div>
              <p>Ingresa al sistema para revisar, aprobar y asignarle los roles/permisos correspondientes.</p>
              <div style="margin: 24px 0;">
                <a href="${usuariosUrl}" style="background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Ir a Usuarios pendientes
                </a>
              </div>
              ${emailFooter()}
            </div>
          </div>
        `,
      }),
    });

    const emailResponse = await emailRes.json();
    console.log("Email sent:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
