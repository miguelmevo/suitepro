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
  colorPrimario?: string;
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
  let isExistingUser = false; // Track if we're reusing an existing auth user

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

    console.log(`[register] Processing registration for: ${email}`);

    // Check if the email already exists in profiles
    const { data: existingProfile } = await serviceClient
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle();

    // Determine the target congregation ID for duplicate check
    const targetCongregacionId = congregacionId || null;

    if (existingProfile) {
      // User already exists - check if they're already in this specific congregation
      if (targetCongregacionId) {
        const { data: existingMembership } = await serviceClient
          .from("usuarios_congregacion")
          .select("id")
          .eq("user_id", existingProfile.id)
          .eq("congregacion_id", targetCongregacionId)
          .limit(1);

        if (existingMembership && existingMembership.length > 0) {
          return new Response(
            JSON.stringify({ error: "auth_error", message: "Este correo ya está registrado en esta congregación" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
      }

      // User exists but NOT in this congregation - add them to the new congregation
      console.log(`[register] Existing user ${existingProfile.id} joining new congregation ${targetCongregacionId}`);
      createdUserId = existingProfile.id;
      isExistingUser = true;

      // Verify password by attempting sign-in
      const { error: signInError } = await serviceClient.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        return new Response(
          JSON.stringify({ error: "auth_error", message: "Contraseña incorrecta para este correo" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
    }

    // If user doesn't exist yet, create them in auth
    if (!isExistingUser) {
      let authUserId: string;
      
      const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { nombre, apellido },
      });

      if (authError) {
        console.error("[register] Auth error:", authError);
        
        const errorCode = (authError as any)?.code;
        if (errorCode === "weak_password" || authError.message?.includes("weak") || authError.message?.includes("common")) {
          return new Response(
            JSON.stringify({ error: "weak_password", message: "La contraseña es demasiado corta. Usa al menos 6 caracteres." }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
          );
        }
        
        // If email exists in auth but not in profiles (orphan in auth)
        if (authError.message.includes("already been registered") || authError.message.includes("already registered")) {
          console.log(`[register] Email exists in auth but no profile, recovering orphan...`);
          
          const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
          const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
          
          if (existingAuthUser) {
            // Check if this orphan auth user has any active membership
            const { data: membership } = await serviceClient
              .from("usuarios_congregacion")
              .select("id, congregacion_id")
              .eq("user_id", existingAuthUser.id)
              .eq("activo", true)
              .limit(1);
            
            if (membership && membership.length > 0) {
              // Has memberships but no profile - check if already in target congregation
              if (targetCongregacionId) {
                const inTarget = membership.some((m: any) => m.congregacion_id === targetCongregacionId);
                if (inTarget) {
                  return new Response(
                    JSON.stringify({ error: "auth_error", message: "Este correo ya está registrado en esta congregación" }),
                    { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
                  );
                }
              }
              // User has memberships elsewhere but not here - treat as existing user joining new congregation
              // Verify password
              const { error: signInError } = await serviceClient.auth.signInWithPassword({ email, password });
              if (signInError) {
                return new Response(
                  JSON.stringify({ error: "auth_error", message: "Contraseña incorrecta para este correo" }),
                  { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
                );
              }
              createdUserId = existingAuthUser.id;
              isExistingUser = true;
              
              // Ensure profile exists
              await serviceClient.from("profiles").upsert({
                id: existingAuthUser.id,
                email,
                nombre,
                apellido,
                aprobado: false,
              }, { onConflict: "id" });
            } else {
              // True orphan - no memberships at all, recycle the auth user
              console.log(`[register] True orphan auth user found: ${existingAuthUser.id}, recycling...`);
              
              const { error: updateError } = await serviceClient.auth.admin.updateUserById(
                existingAuthUser.id,
                {
                  password,
                  email_confirm: true,
                  user_metadata: { nombre, apellido },
                }
              );

              if (updateError) {
                console.error("[register] Error updating orphan user:", updateError);
                const code = (updateError as any)?.code;
                let message = "Error al recuperar cuenta";
                if (code === "weak_password") {
                  message = "La contraseña es demasiado corta. Usa al menos 6 caracteres.";
                }
                return new Response(
                  JSON.stringify({ error: code || "auth_error", message }),
                  { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
                );
              }
              
              // Clean up orphan records
              await serviceClient.from("user_roles").delete().eq("user_id", existingAuthUser.id);
              await serviceClient.from("usuarios_congregacion").delete().eq("user_id", existingAuthUser.id);
              await serviceClient.from("profiles").delete().eq("id", existingAuthUser.id);
              
              authUserId = existingAuthUser.id;
              console.log(`[register] Orphan user recovered: ${authUserId}`);
              createdUserId = authUserId;
            }
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
        createdUserId = authData.user.id;
      }
    }

    console.log(`[register] User ready: ${createdUserId}, existing: ${isExistingUser}`);

    // 2. CREATE PROFILE (only if new user, not existing)
    if (!isExistingUser) {
      const { error: profileError } = await serviceClient.from("profiles").upsert({
        id: createdUserId!,
        email,
        nombre,
        apellido,
        aprobado: crearCongregacion ? true : false,
        fecha_aprobacion: crearCongregacion ? new Date().toISOString() : null,
      }, { onConflict: "id" });

      if (profileError) {
        console.error("[register] Profile error:", profileError);
        throw new Error(`Error creando perfil: ${profileError.message}`);
      }
      console.log(`[register] Profile created`);
    }

    let resultSlug: string | null = null;
    let resultCongregacionId: string | null = null;

    // CASO A: CREAR NUEVA CONGREGACIÓN
    if (crearCongregacion && congregacionNombre) {
      const slug = urlPrivada ? generateRandomSlug() : generateSlug(congregacionNombre);

      const { data: newCong, error: congError } = await serviceClient
        .from("congregaciones")
        .insert({
          nombre: congregacionNombre.toUpperCase(),
          slug,
          activo: true,
          url_oculta: urlPrivada || false,
          color_primario: body.colorPrimario || "blue",
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
          user_id: createdUserId!,
          congregacion_id: resultCongregacionId,
          rol: "admin",
          es_principal: !isExistingUser, // Only set as principal if new user
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

      // Crear participante vinculado al administrador
      const { data: newParticipante, error: participanteError } = await serviceClient
        .from("participantes")
        .insert({
          nombre,
          apellido,
          congregacion_id: resultCongregacionId,
          user_id: createdUserId!,
          estado_aprobado: true,
          es_capitan_grupo: false,
          activo: true,
          responsabilidad: [],
        })
        .select("id")
        .single();

      if (participanteError) {
        console.error("[register] Admin participante error:", participanteError);
      } else {
        console.log(`[register] Admin participante created: ${newParticipante.id}`);
        
        await serviceClient
          .from("usuarios_congregacion")
          .update({ participante_id: newParticipante.id })
          .eq("user_id", createdUserId!)
          .eq("congregacion_id", resultCongregacionId);
      }
    }

    // CASO B: UNIRSE A CONGREGACIÓN EXISTENTE
    if (congregacionId) {
      resultCongregacionId = congregacionId;

      // Asignar como usuario (pendiente de aprobación)
      const { error: membershipError } = await serviceClient
        .from("usuarios_congregacion")
        .insert({
          user_id: createdUserId!,
          congregacion_id: congregacionId,
          rol: "user",
          es_principal: !isExistingUser, // Only set as principal if new user
          activo: true,
        });

      if (membershipError) {
        console.error("[register] Membership error:", membershipError);
        throw new Error(`Error asignando membresía: ${membershipError.message}`);
      }

      console.log(`[register] User membership created`);

      // Crear participante vinculado al usuario automáticamente
      const { data: newParticipante, error: participanteError } = await serviceClient
        .from("participantes")
        .insert({
          nombre,
          apellido,
          congregacion_id: congregacionId,
          user_id: createdUserId!,
          estado_aprobado: false,
          es_capitan_grupo: false,
          activo: true,
          responsabilidad: [],
        })
        .select("id")
        .single();

      if (participanteError) {
        console.error("[register] Participante error:", participanteError);
      } else {
        console.log(`[register] Participante created: ${newParticipante.id}`);
        
        await serviceClient
          .from("usuarios_congregacion")
          .update({ participante_id: newParticipante.id })
          .eq("user_id", createdUserId!)
          .eq("congregacion_id", congregacionId);
      }
    }

    // 3. ASIGNAR ROL BÁSICO EN user_roles (solo si es usuario nuevo)
    if (!isExistingUser) {
      await serviceClient.from("user_roles").insert({
        user_id: createdUserId!,
        role: crearCongregacion ? "admin" : "user",
      });
    }

    console.log(`[register] Registration complete for ${email}`);

    return new Response(
      JSON.stringify({
        success: true,
        userId: createdUserId,
        congregacionId: resultCongregacionId,
        slug: resultSlug,
        isAdmin: crearCongregacion,
        isExistingUser,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("[register] Error:", error);

    // ROLLBACK: Solo si creamos un usuario NUEVO y falló algo después
    if (createdUserId && !isExistingUser) {
      console.log(`[register] Rolling back new user: ${createdUserId}`);
      try {
        await serviceClient.from("participantes").delete().eq("user_id", createdUserId);
        await serviceClient.from("user_roles").delete().eq("user_id", createdUserId);
        await serviceClient.from("usuarios_congregacion").delete().eq("user_id", createdUserId);
        await serviceClient.from("profiles").delete().eq("id", createdUserId);
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
