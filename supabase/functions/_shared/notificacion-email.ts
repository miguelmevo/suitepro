// Correo de respaldo cuando el usuario no tiene ni la app nativa ni una
// suscripción de Web Push activa. Se diseña como una tarjeta compacta
// imitando el look de una notificación push, no como un correo largo.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Cuerpo del aviso: cada línea va en su propia fila; una línea vacía deja un espacio y una línea
 * en mayúsculas de una sola palabra (p. ej. "MAÑANA", "TARDE") se muestra como encabezado en negrita.
 */
function cuerpoHtml(body: string): string {
  return body
    .split("\n")
    .map((linea) => {
      const t = linea.trim();
      if (!t) return '<span style="display:block;height:10px;line-height:10px;">&nbsp;</span>';
      if (/^[A-ZÁÉÍÓÚÑ]{3,12}$/.test(t)) {
        return `<span style="display:block;margin-top:2px;font-size:15px;font-weight:bold;color:#111827;">${esc(t)}</span>`;
      }
      return `<span style="display:block;">${esc(t)}</span>`;
    })
    .join("");
}

export function htmlNotificacionEmail(notification: { title: string; body: string; url: string; color?: string }): string {
  const color = notification.color || "#2563EB";
  const titulo = esc(notification.title);
  const cuerpo = cuerpoHtml(notification.body);

  return `
    <div style="background-color:#f3f4f6;padding:24px 0;font-family:Arial,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:40px;vertical-align:top;">
              <div style="width:36px;height:36px;border-radius:9px;background:${color};display:flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:16px;font-weight:bold;line-height:36px;display:block;text-align:center;">S</span>
              </div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:13px;color:#6b7280;">SuitePro · ahora</p>
              <p style="margin:2px 0 0;font-size:15px;font-weight:bold;color:#111827;">${titulo}</p>
              <p style="margin:4px 0 0;font-size:14px;line-height:1.6;color:#374151;">${cuerpo}</p>
            </td>
          </tr>
        </table>
        <a href="${notification.url}" style="display:block;text-align:center;margin-top:16px;background:${color};color:#fff;text-decoration:none;padding:10px 0;border-radius:8px;font-size:14px;">
          Abrir SuitePro
        </a>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">
        Recibiste esto porque tienes esta categoría activa en Mi Cuenta → Notificaciones.
      </p>
    </div>
  `;
}

export async function enviarNotificacionPorEmail(
  destinatarios: string[],
  notification: { title: string; body: string; url: string; color?: string }
): Promise<{ configured: boolean; enviados: number }> {
  if (!RESEND_API_KEY || destinatarios.length === 0) {
    return { configured: !!RESEND_API_KEY, enviados: 0 };
  }

  const html = htmlNotificacionEmail(notification);

  // Un envío por destinatario (nunca varios correos en el mismo "to": se
  // verían las direcciones de los demás).
  let enviados = 0;
  for (const destinatario of destinatarios) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuitePro <noreply@suitepro.org>",
        to: [destinatario],
        subject: notification.title,
        html,
      }),
    });

    if (res.ok) {
      enviados++;
    } else {
      console.error("[notificacion-email] Error de Resend:", await res.text());
    }
  }

  return { configured: true, enviados };
}
