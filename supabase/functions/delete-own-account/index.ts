import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const callerId = claimsData.claims.sub as string;

    // No permitir que un super_admin se auto-elimine: dejaría al sistema sin
    // nadie con ese rol (no hay flujo de "transferir" super_admin en la UI).
    const { data: isSuper } = await serviceClient.rpc("is_super_admin", { _user_id: callerId });
    if (isSuper) {
      return new Response(JSON.stringify({ error: "cannot_delete_super_admin" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Si el usuario es el único admin activo de alguna congregación, bloquear:
    // debe transferir el rol de admin a otra persona antes de eliminar su cuenta.
    const { data: adminMemberships } = await serviceClient
      .from("usuarios_congregacion")
      .select("congregacion_id, congregaciones(nombre)")
      .eq("user_id", callerId)
      .eq("activo", true)
      .eq("rol", "admin");

    const congregacionesSinOtroAdmin: string[] = [];
    for (const membership of adminMemberships ?? []) {
      const { count } = await serviceClient
        .from("usuarios_congregacion")
        .select("id", { count: "exact", head: true })
        .eq("congregacion_id", membership.congregacion_id)
        .eq("activo", true)
        .eq("rol", "admin")
        .neq("user_id", callerId);

      if (!count) {
        const nombre = (membership as any).congregaciones?.nombre ?? "tu congregación";
        congregacionesSinOtroAdmin.push(nombre);
      }
    }

    if (congregacionesSinOtroAdmin.length > 0) {
      return new Response(
        JSON.stringify({ error: "sole_admin", congregaciones: congregacionesSinOtroAdmin }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[delete-own-account] User ${callerId} deleting their own account`);

    // Desvincular referencias históricas que no permiten borrado (NO ACTION)
    // sin eliminar los programas publicados/aprobados/cerrados en sí.
    await serviceClient.from("programas_publicados").update({ publicado_por: null }).eq("publicado_por", callerId);
    await serviceClient.from("programas_publicados").update({ aprobado_por: null }).eq("aprobado_por", callerId);
    await serviceClient.from("programas_publicados").update({ cerrado_por: null }).eq("cerrado_por", callerId);

    await serviceClient.from("user_roles").delete().eq("user_id", callerId);
    await serviceClient.from("usuarios_congregacion").delete().eq("user_id", callerId);
    await serviceClient.from("profiles").delete().eq("id", callerId);
    // participantes.user_id tiene ON DELETE SET NULL: el registro del
    // participante (historial de asignaciones) se conserva, solo se
    // desvincula de la cuenta de acceso que se está eliminando.

    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(callerId);
    if (deleteAuthError) {
      console.error("[delete-own-account] Error deleting from auth:", deleteAuthError);
      return new Response(JSON.stringify({ error: deleteAuthError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("[delete-own-account] Error:", error);
    return new Response(JSON.stringify({ error: error?.message ?? "unknown_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
