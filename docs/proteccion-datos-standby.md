# Protección de datos (Ley 21.719) — EN STANDBY (22-oct-2026)

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
