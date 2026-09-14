// Utilidad compartida para enviar push notifications vía Firebase Cloud
// Messaging (API v1), usada por las distintas edge functions de notificaciones.
// No hace nada (retorna configured:false) hasta que se cargue el secret
// FIREBASE_SERVICE_ACCOUNT_JSON (el JSON de la cuenta de servicio de Firebase).

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

function base64url(input: ArrayBuffer | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input);
  let str = "";
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;

  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    )}&assertion=${encodeURIComponent(jwt)}`,
  });

  if (!res.ok) {
    throw new Error(`No se pudo obtener el access token de Firebase: ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

export async function enviarPushFcm(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>
): Promise<{ configured: boolean; enviados: number; fallidos: number }> {
  const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (!serviceAccountJson || tokens.length === 0) {
    console.log(
      `[fcm] ${!serviceAccountJson ? "Firebase aún no configurado" : "sin tokens"}: se omite el envío (${tokens.length} tokens)`
    );
    return { configured: !!serviceAccountJson, enviados: 0, fallidos: 0 };
  }

  const sa: ServiceAccount = JSON.parse(serviceAccountJson);
  const accessToken = await getAccessToken(sa);

  let enviados = 0;
  let fallidos = 0;

  for (const token of tokens) {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification,
          data: data ?? {},
        },
      }),
    });

    if (res.ok) {
      enviados++;
    } else {
      fallidos++;
      console.error(`[fcm] Error enviando a token ${token.slice(0, 12)}...:`, await res.text());
    }
  }

  return { configured: true, enviados, fallidos };
}
