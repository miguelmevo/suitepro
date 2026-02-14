import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email requerido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Look up user by email to get their name
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("nombre, apellido")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Generate recovery link via admin API
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: email.toLowerCase(),
      options: {
        redirectTo: "https://suitepro.org/auth",
      },
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      // Don't reveal if user exists or not
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send branded email via Resend
    if (RESEND_API_KEY && linkData?.properties?.action_link) {
      const resetUrl = linkData.properties.action_link;
      const nombre = profile?.nombre || "";
      const apellido = profile?.apellido || "";
      const saludo = nombre ? `${nombre} ${apellido}`.trim() : "Usuario";

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "SuitePro <noreply@suitepro.org>",
          to: [email.toLowerCase()],
          subject: "Restablecer tu contraseña - SuitePro",
          html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">SUITEPRO</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Sistema de Gestión de Asignaciones</p>
              </div>
              
              <!-- Body -->
              <div style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Restablecer Contraseña</h2>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 8px;">
                  Hola <strong>${saludo}</strong>,
                </p>
                <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva contraseña:
                </p>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${resetUrl}" 
                     style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                    Cambiar Contraseña
                  </a>
                </div>
                
                <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 24px 0 0; padding-top: 16px; border-top: 1px solid #f1f5f9;">
                  Si no solicitaste este cambio, puedes ignorar este correo. Tu contraseña actual seguirá funcionando.
                </p>
                <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">
                  Este enlace expira en 24 horas.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="text-align: center; padding: 16px 24px;">
                <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
                  © ${new Date().getFullYear()} SuitePro · <a href="https://suitepro.org" style="color: #94a3b8; text-decoration: none;">suitepro.org</a>
                </p>
              </div>
            </div>
          `,
        }),
      });

      const emailResponse = await emailRes.json();
      console.log("Recovery email sent via Resend:", emailResponse);
    }

    // Always return success to avoid leaking user existence
    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in forgot-password:", error);
    return new Response(
      JSON.stringify({ success: true }), // Don't reveal errors
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
