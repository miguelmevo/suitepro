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
}

serve(async (req: Request): Promise<Response> => {
  console.log("notify-admin-new-user function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userEmail, userName, userApellido }: NewUserNotificationRequest = await req.json();
    console.log(`Processing notification for new user: ${userEmail}`);

    // Fetch admin emails using fetch to Supabase REST API
    const adminRolesRes = await fetch(`${SUPABASE_URL}/rest/v1/user_roles?role=eq.admin&select=user_id`, {
      headers: {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const adminRoles = await adminRolesRes.json();

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(JSON.stringify({ message: "No hay administradores para notificar" }), {
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

    // Send email via Resend REST API
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <onboarding@resend.dev>",
        to: adminEmails,
        subject: "Nuevo usuario pendiente de aprobación",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Nuevo Usuario Registrado</h1>
            <p>Un nuevo usuario se ha registrado y está pendiente de aprobación:</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Nombre:</strong> ${userName} ${userApellido}</p>
              <p><strong>Email:</strong> ${userEmail}</p>
            </div>
            <p>Por favor, ingresa al sistema para revisar y aprobar este usuario.</p>
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
