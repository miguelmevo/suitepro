import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserFromParticipanteRequest {
  participanteId: string;
  email: string;
}

function generateRandomPassword(): string {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "not_authenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { participanteId, email }: CreateUserFromParticipanteRequest = await req.json();

    if (!participanteId || !email) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: participante, error: participanteError } = await userClient
      .from("participantes")
      .select("id, nombre, apellido, congregacion_id, user_id")
      .eq("id", participanteId)
      .single();

    if (participanteError || !participante) {
      return new Response(JSON.stringify({ error: "participante_not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (participante.user_id) {
      return new Response(JSON.stringify({ error: "participante_already_has_user" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    if (emailExists) {
      return new Response(JSON.stringify({ error: "email_already_exists" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Contraseña aleatoria — el usuario nunca la verá ni usará; debe cambiarla en el onboarding.
    const randomPassword = generateRandomPassword();

    const { data: newUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: randomPassword,
      email_confirm: true,
      user_metadata: {
        nombre: participante.nombre,
        apellido: participante.apellido,
      },
    });

    if (createUserError || !newUser?.user) {
      console.error("Error creating user:", createUserError);
      return new Response(JSON.stringify({ error: createUserError?.message || "create_user_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const newUserId = newUser.user.id;

    const { error: profileError } = await serviceClient
      .from("profiles")
      .insert({
        id: newUserId,
        email: email.toLowerCase(),
        nombre: participante.nombre,
        apellido: participante.apellido,
        aprobado: true,
        fecha_aprobacion: new Date().toISOString(),
        debe_cambiar_password: true,
        debe_completar_onboarding: true,
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      await serviceClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "profile_creation_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: roleError } = await serviceClient
      .from("user_roles")
      .insert({ user_id: newUserId, role: "user" });
    if (roleError) console.error("Error creating role:", roleError);

    const { error: membershipError } = await serviceClient
      .from("usuarios_congregacion")
      .insert({
        user_id: newUserId,
        congregacion_id: participante.congregacion_id,
        rol: "user",
        es_principal: true,
        activo: true,
      });
    if (membershipError) console.error("Error creating membership:", membershipError);

    const { error: linkError } = await serviceClient
      .from("participantes")
      .update({ user_id: newUserId })
      .eq("id", participanteId);
    if (linkError) console.error("Error linking participante:", linkError);

    // Enviar correo de recuperación para que el usuario establezca su contraseña
    let emailSent = false;
    try {
      const { data: linkData, error: genLinkError } = await serviceClient.auth.admin.generateLink({
        type: "recovery",
        email: email.toLowerCase(),
        options: { redirectTo: "https://suitepro.org/auth" },
      });

      if (genLinkError) {
        console.error("Error generating recovery link:", genLinkError);
      } else if (RESEND_API_KEY && linkData?.properties?.action_link) {
        const resetUrl = linkData.properties.action_link;
        const saludo = `${participante.nombre} ${participante.apellido}`.trim();

        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: "SuitePro <noreply@suitepro.org>",
            to: [email.toLowerCase()],
            subject: "Bienvenido a SuitePro — Activa tu cuenta",
            html: `
              <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff;">
                <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px 24px; text-align: center; border-radius: 8px 8px 0 0;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 1px;">SUITEPRO</h1>
                  <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">Sistema de Gestión de Asignaciones</p>
                </div>
                <div style="padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                  <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">¡Bienvenido${saludo ? ", " + saludo : ""}!</h2>
                  <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
                    Un administrador de tu congregación ha creado una cuenta para ti en SuitePro.
                  </p>
                  <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                    Para activar tu cuenta, haz clic en el siguiente botón. Te pediremos completar algunos datos personales y crear tu propia contraseña:
                  </p>
                  <div style="text-align: center; margin: 32px 0;">
                    <a href="${resetUrl}"
                       style="display: inline-block; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);">
                      Activar mi cuenta
                    </a>
                  </div>
                  <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">Este enlace expira en 24 horas.</p>
                </div>
                <div style="text-align: center; padding: 16px 24px;">
                  <p style="color: #cbd5e1; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} SuitePro · <a href="https://suitepro.org" style="color: #94a3b8; text-decoration: none;">suitepro.org</a>
                  </p>
                </div>
              </div>
            `,
          }),
        });
        const resp = await emailRes.json();
        console.log("Activation email sent:", resp);
        emailSent = emailRes.ok;
      }
    } catch (e) {
      console.error("Error sending activation email:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: newUserId,
        emailSent,
        message: "Usuario creado. Se envió un correo para que active su cuenta y establezca su contraseña.",
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("create-user-from-participante error:", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
