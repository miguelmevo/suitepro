import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UserApprovedRequest {
  userEmail: string;
  userName: string;
  userApellido: string;
  rolAsignado: string;
  congregacionNombre: string;
  colorPrimario?: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  user: "Usuario",
};

// Map color names to hex values
const COLOR_MAP: Record<string, string> = {
  blue: "#2563EB",
  rose: "#E11D48",
  green: "#16A34A",
  purple: "#9333EA",
  orange: "#EA580C",
  teal: "#0D9488",
  indigo: "#4F46E5",
  pink: "#EC4899",
  amber: "#D97706",
  cyan: "#0891B2",
  red: "#DC2626",
  emerald: "#059669",
};

function getHexColor(colorPrimario?: string): string {
  if (!colorPrimario) return "#2563EB"; // default blue
  // If it's already a hex color
  if (colorPrimario.startsWith("#")) return colorPrimario;
  // If it's a named color from the theme
  return COLOR_MAP[colorPrimario] || "#2563EB";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 37, g: 99, b: 235 };
}

serve(async (req: Request): Promise<Response> => {
  console.log("notify-user-approved function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, userApellido, rolAsignado, congregacionNombre, colorPrimario }: UserApprovedRequest = await req.json();
    console.log(`Processing approval notification for user: ${userEmail}, role: ${rolAsignado}, color: ${colorPrimario}`);

    const rolLabel = ROLE_LABELS[rolAsignado] || rolAsignado;
    const hexColor = getHexColor(colorPrimario);
    const rgb = hexToRgb(hexColor);
    const bgLight = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.08)`;
    const isDevProject = SUPABASE_URL.includes("sfgnveuwitsaiflqjdsc");
    const baseUrl = isDevProject ? "https://dev.suitepro.org" : "https://suitepro.org";

    // Send email via Resend REST API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <noreply@suitepro.org>",
        to: [userEmail],
        subject: "¡Tu cuenta ha sido aprobada!",
        html: `
          <div style="background-color:#f3f4f6;padding:24px 0;">
            ${emailHeader(baseUrl)}
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 24px auto 0; background-color:#ffffff; border-radius:12px; padding:32px; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <h1 style="color: ${hexColor}; margin-top:0;">¡Bienvenido a SuitePro!</h1>
              <p>Hola <strong>${userName} ${userApellido}</strong>,</p>
              <p>Tu cuenta ha sido aprobada y ya puedes acceder al sistema.</p>
              <div style="background-color: ${bgLight}; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${hexColor};">
                <p style="margin:0 0 8px;"><strong>Congregación:</strong> ${congregacionNombre}</p>
                <p style="margin:0;"><strong>Rol asignado:</strong> ${rolLabel}</p>
              </div>
              <p>Ahora puedes iniciar sesión y comenzar a usar todas las funcionalidades disponibles para tu rol.</p>
              <p style="margin-top: 30px;">
                <a href="${baseUrl}"
                   style="background-color: ${hexColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                  Iniciar Sesión
                </a>
              </p>
              ${emailFooter()}
            </div>
          </div>
        `,
      }),
    });

    const emailResponse = await emailRes.json();
    console.log("Approval email sent:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-user-approved function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
