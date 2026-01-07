import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  editor: "Editor",
  user: "Usuario",
};

serve(async (req: Request): Promise<Response> => {
  console.log("notify-user-approved function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, userApellido, rolAsignado, congregacionNombre }: UserApprovedRequest = await req.json();
    console.log(`Processing approval notification for user: ${userEmail}, role: ${rolAsignado}`);

    const rolLabel = ROLE_LABELS[rolAsignado] || rolAsignado;

    // Send email via Resend REST API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <onboarding@resend.dev>",
        to: [userEmail],
        subject: "¡Tu cuenta ha sido aprobada!",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">¡Bienvenido a SuitePro!</h1>
            <p>Hola <strong>${userName} ${userApellido}</strong>,</p>
            <p>Tu cuenta ha sido aprobada y ya puedes acceder al sistema.</p>
            <div style="background-color: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #16a34a;">
              <p><strong>Congregación:</strong> ${congregacionNombre}</p>
              <p><strong>Rol asignado:</strong> ${rolLabel}</p>
            </div>
            <p>Ahora puedes iniciar sesión y comenzar a usar todas las funcionalidades disponibles para tu rol.</p>
            <p style="margin-top: 30px;">
              <a href="https://suitepro.org" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
                Iniciar Sesión
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 40px;">
              Este es un mensaje automático del sistema SuitePro.
            </p>
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
