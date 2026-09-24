import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Invisible e intocable, igual que en la página de Usuarios.
const SUPER_ADMIN_EMAILS = new Set(["miguelmevo@gmail.com"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders } });

/**
 * Permite a un administrador de la congregación "entrar como" otro usuario.
 * Devuelve un token de un solo uso (magic link) que el cliente canjea con
 * verifyOtp; no envía ningún correo. Reglas: el objetivo debe estar activo y
 * aprobado en la misma congregación, no ser administrador ni super admin, y
 * no puede ser el propio solicitante. Cada uso queda en impersonaciones_log.
 */
serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return responder({ error: "not_authenticated" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) return responder({ error: "invalid_token" }, 401);
    const admin = userData.user;

    const { targetUserId, congregacionId } = await req.json();
    if (!targetUserId || !congregacionId) return responder({ error: "missing_fields" }, 400);
    if (targetUserId === admin.id) return responder({ error: "cannot_impersonate_self" }, 400);

    // Quien pide debe ser administrador activo de esa congregación (o super admin).
    const { data: rolAdmin } = await service
      .from("usuarios_congregacion")
      .select("rol, activo")
      .eq("user_id", admin.id)
      .eq("congregacion_id", congregacionId)
      .maybeSingle();
    const esSuperAdmin = SUPER_ADMIN_EMAILS.has((admin.email ?? "").toLowerCase());
    if (!esSuperAdmin && !(rolAdmin?.rol === "admin" && rolAdmin?.activo)) {
      return responder({ error: "not_authorized" }, 403);
    }

    // El objetivo: misma congregación, activo, aprobado, no administrador ni super admin.
    const { data: miembro } = await service
      .from("usuarios_congregacion")
      .select("rol, activo")
      .eq("user_id", targetUserId)
      .eq("congregacion_id", congregacionId)
      .maybeSingle();
    if (!miembro) return responder({ error: "target_not_in_congregation" }, 404);
    if (!miembro.activo) return responder({ error: "target_inactive" }, 400);
    if (miembro.rol === "admin") return responder({ error: "target_is_admin" }, 400);

    const { data: perfil } = await service
      .from("profiles")
      .select("email, aprobado")
      .eq("id", targetUserId)
      .maybeSingle();
    if (!perfil?.email || !perfil.aprobado) return responder({ error: "target_not_approved" }, 400);
    if (SUPER_ADMIN_EMAILS.has(perfil.email.toLowerCase())) return responder({ error: "target_is_super_admin" }, 400);

    const { data: link, error: linkError } = await service.auth.admin.generateLink({
      type: "magiclink",
      email: perfil.email,
    });
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      console.error("generateLink error:", linkError);
      return responder({ error: "link_failed" }, 500);
    }

    await service.from("impersonaciones_log").insert({
      admin_id: admin.id,
      target_id: targetUserId,
      congregacion_id: congregacionId,
    });

    return responder({ tokenHash });
  } catch (e) {
    console.error("impersonar-usuario error:", e);
    return responder({ error: "internal_error" }, 500);
  }
});
