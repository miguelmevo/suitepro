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
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Decode JWT to get caller identity
    let callerId: string;
    try {
      const payloadBase64 = token.split(".")[1];
      const payload = JSON.parse(atob(payloadBase64));
      callerId = payload.sub;
      if (!callerId) throw new Error("No sub in token");
    } catch (e) {
      console.error("Token decode error:", e);
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { userId, congregacionId } = await req.json();
    if (!userId || !congregacionId) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Verify caller is admin or super_admin in this congregation
    const { data: callerRole } = await serviceClient
      .from("usuarios_congregacion")
      .select("rol")
      .eq("user_id", callerId)
      .eq("congregacion_id", congregacionId)
      .eq("activo", true)
      .maybeSingle();

    const { data: isSuperAdmin } = await serviceClient
      .from("user_roles")
      .select("id")
      .eq("user_id", callerId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!isSuperAdmin && callerRole?.rol !== "admin") {
      return new Response(
        JSON.stringify({ error: "No tienes permisos para esta acción" }),
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get target user's profile
    const { data: targetProfile } = await serviceClient
      .from("profiles")
      .select("email, nombre, apellido")
      .eq("id", userId)
      .single();

    if (!targetProfile) {
      return new Response(
        JSON.stringify({ error: "Usuario no encontrado" }),
        { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Generate password reset link using admin API
    const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
      type: "recovery",
      email: targetProfile.email,
      options: {
        redirectTo: "https://suitepro.org/auth",
      },
    });

    if (linkError) {
      console.error("Error generating reset link:", linkError);
      return new Response(
        JSON.stringify({ error: "Error generando enlace de recuperación" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Send reset email via Resend
    if (RESEND_API_KEY) {
      const resetUrl = linkData?.properties?.action_link || "";
      
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "SuitePro <noreply@suitepro.org>",
          to: [targetProfile.email],
          subject: "Restablecer tu contraseña - SuitePro",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #2563eb;">Restablecer Contraseña</h1>
              <p>Hola <strong>${targetProfile.nombre || ""} ${targetProfile.apellido || ""}</strong>,</p>
              <p>Un administrador ha solicitado restablecer tu contraseña en SuitePro.</p>
              <p>Haz clic en el siguiente enlace para establecer una nueva contraseña:</p>
              <p style="margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                  Cambiar Contraseña
                </a>
              </p>
              <p style="color: #6b7280; font-size: 12px;">
                Si no esperabas este correo, puedes ignorarlo. Tu contraseña actual seguirá funcionando.
              </p>
              <p style="color: #6b7280; font-size: 12px; margin-top: 40px;">
                Este es un mensaje automático del sistema SuitePro.
              </p>
            </div>
          `,
        }),
      });

      const emailResponse = await emailRes.json();
      console.log("Reset email sent:", emailResponse);
    }

    return new Response(
      JSON.stringify({ success: true, email: targetProfile.email }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in reset-user-password:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
