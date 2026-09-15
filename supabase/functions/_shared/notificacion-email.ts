// Correo de respaldo cuando el usuario no tiene ni la app nativa ni una
// suscripción de Web Push activa. Se diseña como una tarjeta compacta
// imitando el look de una notificación push, no como un correo largo.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

export async function enviarNotificacionPorEmail(
  destinatarios: string[],
  notification: { title: string; body: string; url: string }
): Promise<{ configured: boolean; enviados: number }> {
  if (!RESEND_API_KEY || destinatarios.length === 0) {
    return { configured: !!RESEND_API_KEY, enviados: 0 };
  }

  const html = `
    <div style="background-color:#f3f4f6;padding:24px 0;font-family:Arial,sans-serif;">
      <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:16px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.08);border:1px solid #e5e7eb;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="width:40px;vertical-align:top;">
              <div style="width:36px;height:36px;border-radius:9px;background:#2563EB;display:flex;align-items:center;justify-content:center;">
                <span style="color:#fff;font-size:16px;font-weight:bold;line-height:36px;display:block;text-align:center;">S</span>
              </div>
            </td>
            <td style="padding-left:12px;">
              <p style="margin:0;font-size:13px;color:#6b7280;">SuitePro · ahora</p>
              <p style="margin:2px 0 0;font-size:15px;font-weight:bold;color:#111827;">${notification.title}</p>
              <p style="margin:4px 0 0;font-size:14px;color:#374151;">${notification.body}</p>
            </td>
          </tr>
        </table>
        <a href="${notification.url}" style="display:block;text-align:center;margin-top:16px;background:#2563EB;color:#fff;text-decoration:none;padding:10px 0;border-radius:8px;font-size:14px;">
          Abrir SuitePro
        </a>
      </div>
      <p style="color:#9ca3af;font-size:11px;text-align:center;margin-top:16px;">
        Recibiste esto porque tienes esta categoría activa en Mi Cuenta → Notificaciones.
      </p>
    </div>
  `;

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
