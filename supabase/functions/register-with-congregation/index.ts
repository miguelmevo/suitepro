import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.87.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RegisterRequest {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  // Para crear nueva congregación
  crearCongregacion?: boolean;
  congregacionNombre?: string;
  urlPrivada?: boolean;
  // Para unirse a congregación existente
  congregacionId?: string;
}

// Generar slug desde nombre
function generateSlug(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .substring(0, 50);
}

// Generar slug aleatorio
function generateRandomSlug(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let createdUserId: string | null = null;

  try {
    const body: RegisterRequest = await req.json();
    const { email, password, nombre, apellido, crearCongregacion, congregacionNombre, urlPrivada, congregacionId } = body;

    // Validaciones básicas
    if (!email || !password || !nombre || !apellido) {
      return new Response(
        JSON.stringify({ error: "missing_fields", message: "Faltan campos requeridos" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Validar que tenga destino (crear congregación O unirse a una existente)
    if (!crearCongregacion && !congregacionId) {
      return new Response(
        JSON.stringify({ error: "no_congregation", message: "Debes crear una congregación o unirte a una existente" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (crearCongregacion && !congregacionNombre) {
      return new Response(
        JSON.stringify({ error: "missing_congregation_name", message: "El nombre de la congregación es requerido" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Si va a crear congregación, verificar que el nombre no exista
    if (crearCongregacion && congregacionNombre) {
      const { data: existingCong } = await serviceClient
        .from("congregaciones")
        .select("id")
        .ilike("nombre", congregacionNombre)
        .limit(1);

      if (existingCong && existingCong.length > 0) {
        return new Response(
          JSON.stringify({ error: "congregation_exists", message: "Ya existe una congregación con ese nombre" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // Si va a unirse a congregación existente, verificar que exista y esté activa
    if (congregacionId) {
      const { data: existingCong, error: congError } = await serviceClient
        .from("congregaciones")
        .select("id, activo")
        .eq("id", congregacionId)
        .single();

      if (congError || !existingCong) {
        return new Response(
          JSON.stringify({ error: "congregation_not_found", message: "Congregación no encontrada" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!existingCong.activo) {
        return new Response(
          JSON.stringify({ error: "congregation_inactive", message: "La congregación no está activa" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    console.log(`[register] Creating user: ${email}`);

    // Verificar si ya existe un perfil con este email
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    if (existingProfile) {
      return new Response(
        JSON.stringify({ error: "auth_error", message: "Este correo ya está registrado" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // 1. CREAR USUARIO EN AUTH (o recuperar si es huérfano)
    let authUserId: string;
    
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirmar email
      user_metadata: { nombre, apellido },
    });

    if (authError) {
      console.error("[register] Auth error:", authError);
      
      // Si el email ya existe en auth pero no tiene perfil, es un usuario huérfano
      // Intentar recuperarlo
      if (authError.message.includes("already been registered") || authError.message.includes("already registered")) {
        console.log(`[register] Email exists in auth, checking if orphan...`);
        
        // Buscar el usuario en auth por email
        const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
        
        if (existingAuthUser) {
          // Verificar si tiene membresía activa
          const { data: membership } = await serviceClient
            .from("usuarios_congregacion")
            .select("id")
            .eq("user_id", existingAuthUser.id)
            .eq("activo", true)
            .limit(1);
          
          if (membership && membership.length > 0) {
            // Usuario tiene membresía activa, es un registro duplicado real
            return new Response(
              JSON.stringify({ error: "auth_error", message: "Este correo ya está registrado" }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
          
          // Es un usuario huérfano en auth - lo reutilizamos
          console.log(`[register] Orphan auth user found: ${existingAuthUser.id}, reusing...`);
          
          // Actualizar password y metadata
          const { error: updateError } = await serviceClient.auth.admin.updateUserById(
            existingAuthUser.id,
            { 
              password, 
              email_confirm: true,
              user_metadata: { nombre, apellido } 
            }
          );
          
          if (updateError) {
            console.error("[register] Error updating orphan user:", updateError);
            return new Response(
              JSON.stringify({ error: "auth_error", message: "Error al recuperar cuenta" }),
              { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
          }
          
          // Limpiar registros previos huérfanos
          await serviceClient.from("user_roles").delete().eq("user_id", existingAuthUser.id);
          await serviceClient.from("usuarios_congregacion").delete().eq("user_id", existingAuthUser.id);
          await serviceClient.from("profiles").delete().eq("id", existingAuthUser.id);
          
          authUserId = existingAuthUser.id;
          console.log(`[register] Orphan user recovered: ${authUserId}`);
        } else {
          return new Response(
            JSON.stringify({ error: "auth_error", message: "Este correo ya está registrado" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({ error: "auth_error", message: authError.message }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    } else {
      if (!authData.user) {
        return new Response(
          JSON.stringify({ error: "user_creation_failed", message: "No se pudo crear el usuario" }),
          { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      authUserId = authData.user.id;
    }

    createdUserId = authUserId;
    console.log(`[register] User ready: ${createdUserId}`);

    // 2. CREAR PERFIL
    const { error: profileError } = await serviceClient.from("profiles").insert({
      id: createdUserId,
      email,
      nombre,
      apellido,
      aprobado: crearCongregacion ? true : false, // Auto-aprobar si crea congregación
      fecha_aprobacion: crearCongregacion ? new Date().toISOString() : null,
    });

    if (profileError) {
      console.error("[register] Profile error:", profileError);
      throw new Error(`Error creando perfil: ${profileError.message}`);
    }

    console.log(`[register] Profile created`);

    let resultSlug: string | null = null;
    let resultCongregacionId: string | null = null;

    // CASO A: CREAR NUEVA CONGREGACIÓN
    if (crearCongregacion && congregacionNombre) {
      const slug = urlPrivada ? generateRandomSlug() : generateSlug(congregacionNombre);

      // Crear congregación
      const { data: newCong, error: congError } = await serviceClient
        .from("congregaciones")
        .insert({
          nombre: congregacionNombre,
          slug,
          activo: true,
          url_oculta: urlPrivada || false,
        })
        .select("id, slug")
        .single();

      if (congError || !newCong) {
        console.error("[register] Congregation error:", congError);
        throw new Error(`Error creando congregación: ${congError?.message || "desconocido"}`);
      }

      resultCongregacionId = newCong.id;
      resultSlug = newCong.slug;
      console.log(`[register] Congregation created: ${resultCongregacionId}`);

      // Asignar como admin
      const { error: membershipError } = await serviceClient
        .from("usuarios_congregacion")
        .insert({
          user_id: createdUserId,
          congregacion_id: resultCongregacionId,
          rol: "admin",
          es_principal: true,
          activo: true,
        });

      if (membershipError) {
        console.error("[register] Membership error:", membershipError);
        throw new Error(`Error asignando membresía: ${membershipError.message}`);
      }

      console.log(`[register] Admin membership created`);

      // Crear configuración inicial
      await serviceClient.from("configuracion_sistema").insert({
        programa_tipo: "general",
        clave: "nombre_congregacion",
        valor: { nombre: congregacionNombre },
        congregacion_id: resultCongregacionId,
      });
    }

    // CASO B: UNIRSE A CONGREGACIÓN EXISTENTE
    if (congregacionId) {
      resultCongregacionId = congregacionId;

      // Asignar como usuario (pendiente de aprobación)
      const { error: membershipError } = await serviceClient
        .from("usuarios_congregacion")
        .insert({
          user_id: createdUserId,
          congregacion_id: congregacionId,
          rol: "user",
          es_principal: true,
          activo: true,
        });

      if (membershipError) {
        console.error("[register] Membership error:", membershipError);
        throw new Error(`Error asignando membresía: ${membershipError.message}`);
      }

      console.log(`[register] User membership created`);
    }

    // 3. ASIGNAR ROL BÁSICO EN user_roles (para compatibilidad)
    await serviceClient.from("user_roles").insert({
      user_id: createdUserId,
      role: crearCongregacion ? "admin" : "user",
    });

    console.log(`[register] Registration complete for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId: createdUserId,
        congregacionId: resultCongregacionId,
        slug: resultSlug,
        isAdmin: crearCongregacion,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[register] Error:", error);

    // ROLLBACK: Si creamos un usuario pero falló algo después, eliminarlo
    if (createdUserId) {
      console.log(`[register] Rolling back user: ${createdUserId}`);
      try {
        // Eliminar de tablas públicas
        await serviceClient.from("user_roles").delete().eq("user_id", createdUserId);
        await serviceClient.from("usuarios_congregacion").delete().eq("user_id", createdUserId);
        await serviceClient.from("profiles").delete().eq("id", createdUserId);
        
        // Eliminar de auth
        await serviceClient.auth.admin.deleteUser(createdUserId);
        console.log(`[register] Rollback complete`);
      } catch (rollbackError) {
        console.error("[register] Rollback failed:", rollbackError);
      }
    }

    return new Response(
      JSON.stringify({ error: "registration_failed", message: error.message || "Error en el registro" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
