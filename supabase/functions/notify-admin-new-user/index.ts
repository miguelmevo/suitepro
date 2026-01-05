import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

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

const handler = async (req: Request): Promise<Response> => {
  console.log("notify-admin-new-user function called");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, userEmail, userName, userApellido }: NewUserNotificationRequest = await req.json();
    console.log(`Processing notification for new user: ${userEmail}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all admin user IDs
    const { data: adminRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (rolesError) {
      console.error("Error fetching admin roles:", rolesError);
      throw new Error("Error al obtener administradores");
    }

    if (!adminRoles || adminRoles.length === 0) {
      console.log("No admins found to notify");
      return new Response(
        JSON.stringify({ message: "No hay administradores para notificar" }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const adminUserIds = adminRoles.map(r => r.user_id);

    // Get admin profiles with emails
    const { data: adminProfiles, error: profilesError } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminUserIds);

    if (profilesError) {
      console.error("Error fetching admin profiles:", profilesError);
      throw new Error("Error al obtener perfiles de administradores");
    }

    // Get unique admin emails
    const adminEmails = adminProfiles
      ?.filter(p => p.email)
      .map(p => p.email) || [];

    console.log(`Found ${adminEmails.length} admin emails to notify`);

    console.log(`Sending notification to ${adminEmails.length} unique admin emails`);

    // Send email to all admins
    const emailResponse = await resend.emails.send({
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
          <p style="margin-top: 30px;">
            <a href="https://suitepro.lovable.app/configuracion/usuarios" 
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
              Revisar Usuario
            </a>
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 40px;">
            Este es un mensaje automático del sistema SuitePro.
          </p>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ success: true, emailResponse }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in notify-admin-new-user function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
