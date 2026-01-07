import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateUserFromParticipanteRequest {
  participanteId: string;
  email: string;
  password: string;
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

    // Verificar que el usuario que llama es admin o editor
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

    const { participanteId, email, password }: CreateUserFromParticipanteRequest = await req.json();

    if (!participanteId || !email || !password) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Obtener el participante y verificar que el usuario tiene acceso
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

    // Verificar que el email no esté en uso
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

    // Crear usuario en auth
    const { data: newUser, error: createUserError } = await serviceClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
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

    // Crear perfil (aprobado, debe cambiar contraseña)
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
      });

    if (profileError) {
      console.error("Error creating profile:", profileError);
      // Rollback: eliminar usuario de auth
      await serviceClient.auth.admin.deleteUser(newUserId);
      return new Response(JSON.stringify({ error: "profile_creation_failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Asignar rol de usuario
    const { error: roleError } = await serviceClient
      .from("user_roles")
      .insert({ user_id: newUserId, role: "user" });

    if (roleError) {
      console.error("Error creating role:", roleError);
    }

    // Crear membresía en la congregación
    const { error: membershipError } = await serviceClient
      .from("usuarios_congregacion")
      .insert({
        user_id: newUserId,
        congregacion_id: participante.congregacion_id,
        rol: "user",
        es_principal: true,
        activo: true,
      });

    if (membershipError) {
      console.error("Error creating membership:", membershipError);
    }

    // Vincular participante con usuario
    const { error: linkError } = await serviceClient
      .from("participantes")
      .update({ user_id: newUserId })
      .eq("id", participanteId);

    if (linkError) {
      console.error("Error linking participante:", linkError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        userId: newUserId,
        message: "Usuario creado correctamente. Debe cambiar su contraseña al iniciar sesión."
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
