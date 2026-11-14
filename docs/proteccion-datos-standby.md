# Protección de datos (Ley 21.719) — EN STANDBY (22-oct-2026)

## PLAN DEFINIDO: pasar el consentimiento a PRD el 23-nov-2026 a las 00:00 (hora de Chile)
Decidido por Miguel el 14-nov-2026. A partir del 23-nov los usuarios con cuenta ven el modal de autorización
(el correo informativo ya dice "desde el 23 de noviembre"). Pasos, en este orden:
1. `supabase login` con la cuenta de SuitePro y confirmar con `supabase projects list`.
2. Aplicar en PRD `20261022120000_consentimientos.sql` y `20261114120000_comunicaciones_enviadas.sql` (SQL Editor si el CLI falla).
3. Cherry-pick a `main` de los commits de la tabla de abajo (excluir `65b8973`) + `d5ebd8d` si se quiere el doc; probar tsc/build; push; verificar despliegue.
4. Desplegar en PRD las funciones `asignar-predicacion-ia`, `asignar-vida-ministerio-ia`, `asignar-reunion-publica-ia`.
5. Revisar en Ajustes del Sistema si el consentimiento queda "obligatorio" o no (por congregación, por defecto desactivado) y comprobar el modal con un usuario de prueba.
6. Dónde se ve quién aceptó: **Configuración → Usuarios**, columna "Consentimiento" (check/X + versión del texto). Cada persona puede retirarlo en Mi Cuenta.

## Correo informativo (desde PRD, noreply@suitepro.org)
- Borrador/vista previa: `docs/comunicaciones/correo-proteccion-datos.html`; plantilla de envío: `supabase/functions/_shared/correo-proteccion-datos.ts`.
- Función `enviar-aviso-proteccion-datos` (verify_jwt=false, protegida con `x-cron-secret`): **por defecto simula** y lista destinatarios; solo envía con `{"confirmar": true}`. Filtros `congregacionIds`, `emails` (pruebas), `limite`. Un correo por persona, con el color de su congregación; no envía a participantes sin cuenta ni a super admin; registra en `comunicaciones_enviadas`.
- Falta definir: a quiénes y cuándo se envía. En PRD hay que aplicar `20261114120000_comunicaciones_enviadas.sql` y desplegar la función antes de usarla. **No enviar sin confirmación expresa de Miguel.**


**No pasar a PRD ni modificar nada de esto hasta que Miguel lo indique.**
Al pasar otras cosas a PRD, hacer `cherry-pick` solo de los commits que correspondan; **excluir los de esta lista**.

## Commits en `develop` que NO están en PRD (excluir)
| Commit | Qué |
|---|---|
| `9bca99d` | Consentimiento con registro, obligatorio configurable, columna en Usuarios, retiro en Mi Cuenta, páginas /privacidad y /terminos |
| `6f99211` | Redacción neutra sobre creencias |
| `161ff0f` | "Ahora no" vale solo por sesión (luego reemplazado por la regla de 3 días) |
| `b7cfccf` | Campana de avisos y recordatorio cada 3 días |
| `07f40b0` | Instrucciones de la IA sin mencionar la organización (también hay que desplegar las 3 funciones `asignar-*-ia` en PRD) |
| `fab6052` | Textos legales versión final 1.0, regiones y ley aplicable |

(`65b8973` es un commit vacío de redespliegue de DEV, no pasar.)

## Base de datos
- **Migración `20261022120000_consentimientos.sql`**: aplicada SOLO en DEV. Falta en PRD (aplicarla primero al pasar).
- Funciones edge a desplegar en PRD cuando se pase: `asignar-predicacion-ia`, `asignar-vida-ministerio-ia`, `asignar-reunion-publica-ia` (cambio de texto de instrucciones).

## Ya en PRD (no revertir)
- IA de VyM y RP sin nombre ni hijos (`d33f61b`), limpieza al eliminar cuenta y purga de logs a 60 días (`44709b2`, migración `20261019120000`).

## Pendiente para terminar el proyecto
1. Aceptación del DPA por congregación (con registro) y exportación de datos / canal de solicitudes.
2. Anonimizar al participante al eliminarlo.
3. Consentimiento de participantes sin cuenta (enlace personal o registro del administrador).
4. Indisponibilidad: motivo de texto libre (posible dato de salud).
5. Enlaces a política y términos en inicio de sesión y registro; baja en correos; revisar páginas públicas.
6. Guardar DPAs de proveedores (Supabase, Vercel, Resend, Anthropic); registro de tratamientos; protocolo de brechas.
7. Decisiones: menores en la ficha de participante; función con Google OAuth (¿para qué?).
8. Pasar a PRD (migración, funciones, código) y revisar con abogado cuando la plataforma crezca.

Textos: `src/content/legal/politica-privacidad.md`, `src/content/legal/terminos-de-uso.md`; `docs/legal/acuerdo-tratamiento-datos.md`, `docs/legal/consentimiento.md`; inventario en `docs/proteccion-datos-inventario.md`.
