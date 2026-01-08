import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteUserRequest = {
  userId: string;
  congregacionId: string;
};

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

    // Verificar autenticación
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerId = userData.user.id;
    const body: DeleteUserRequest = await req.json();
    const { userId, congregacionId } = body;

    if (!userId || !congregacionId) {
      return new Response(JSON.stringify({ error: "missing_params" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // No permitir eliminarse a sí mismo
    if (userId === callerId) {
      return new Response(JSON.stringify({ error: "cannot_delete_self" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verificar que el caller sea admin de la congregación o super_admin
    const { data: isSuper } = await serviceClient.rpc("is_super_admin", {
      _user_id: callerId,
    });

    const { data: isCongAdmin } = await serviceClient
      .from("usuarios_congregacion")
      .select("rol")
      .eq("user_id", callerId)
      .eq("congregacion_id", congregacionId)
      .eq("activo", true)
      .single();

    const canDelete = isSuper || isCongAdmin?.rol === "admin";
    if (!canDelete) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Verificar que el usuario target pertenezca a esa congregación
    const { data: targetMembership } = await serviceClient
      .from("usuarios_congregacion")
      .select("id")
      .eq("user_id", userId)
      .eq("congregacion_id", congregacionId)
      .single();

    if (!targetMembership) {
      return new Response(JSON.stringify({ error: "user_not_in_congregation" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`[delete-user-complete] Caller ${callerId} deleting user ${userId} from congregation ${congregacionId}`);

    // 1) Eliminar la membresía de esta congregación
    await serviceClient
      .from("usuarios_congregacion")
      .delete()
      .eq("user_id", userId)
      .eq("congregacion_id", congregacionId);

    // 2) Verificar si el usuario tiene otras membresías activas
    const { data: otherMemberships } = await serviceClient
      .from("usuarios_congregacion")
      .select("id")
      .eq("user_id", userId)
      .eq("activo", true);

    const hasOtherMemberships = otherMemberships && otherMemberships.length > 0;

    // 3) Si no tiene otras membresías, eliminar completamente
    if (!hasOtherMemberships) {
      console.log(`[delete-user-complete] User ${userId} has no other memberships, deleting completely`);

      // Eliminar de user_roles
      await serviceClient.from("user_roles").delete().eq("user_id", userId);

      // Eliminar membresías inactivas si quedaran
      await serviceClient.from("usuarios_congregacion").delete().eq("user_id", userId);

      // Eliminar perfil
      await serviceClient.from("profiles").delete().eq("id", userId);

      // Eliminar de auth.users
      const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) {
        console.error("[delete-user-complete] Error deleting from auth:", deleteAuthError);
        // No lanzar error porque los datos públicos ya fueron eliminados
      } else {
        console.log(`[delete-user-complete] User ${userId} deleted from auth.users`);
      }

      return new Response(
        JSON.stringify({ success: true, userId, deletedCompletely: true }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[delete-user-complete] User ${userId} has other memberships, only removed from this congregation`);
    return new Response(
      JSON.stringify({ success: true, userId, deletedCompletely: false }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[delete-user-complete] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
