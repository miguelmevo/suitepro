import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// La clave pública VAPID no es sensible (está diseñada para ser pública,
// solo la privada debe protegerse) — se sirve así para que DEV y PRD usen
// cada uno la suya sin necesitar una variable de build distinta por rama.
serve((req: Request): Response => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  return new Response(JSON.stringify({ publicKey }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});
