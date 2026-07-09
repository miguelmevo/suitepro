import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type DeleteOrphanRequest = {
  userId?: string;
  email?: string;
};

async function findUserIdByEmail(serviceClient: any, email: string): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;

  // Buscar paginado (límite acotado) para evitar loops infinitos
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const found = (data?.users || []).find(
      (u: any) => (u.email || "").toLowerCase() === target
    );
    if (found?.id) return found.id;

    if (!data?.users || data.users.length < perPage) break;
  }

  return null;
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

    const callerId = userData.user.id;

    const { data: isSuper, error: roleError } = await serviceClient.rpc("is_super_admin", {
      _user_id: callerId,
    });

    if (roleError) throw roleError;
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "not_authorized" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body: DeleteOrphanRequest = await req.json();
    const userId = body.userId;
    const email = body.email;

    let targetUserId: string | undefined = userId;
    if (!targetUserId && email) {
      const found = await findUserIdByEmail(serviceClient, email);
      targetUserId = found ?? undefined;
    }

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: "user_not_found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (targetUserId === callerId) {
      return new Response(JSON.stringify({ error: "cannot_delete_self" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 1) Eliminar registros en el esquema público (valida que sea huérfano)
    const { error: deletePublicError } = await serviceClient.rpc("delete_orphan_user", {
      _user_id: targetUserId,
      _caller_id: callerId,
    });
    if (deletePublicError) throw deletePublicError;

    // 2) Eliminar del sistema de autenticación (libera el email)
    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(targetUserId);
    if (deleteAuthError) throw deleteAuthError;

    return new Response(JSON.stringify({ success: true, userId: targetUserId }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("delete-orphan-user error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
