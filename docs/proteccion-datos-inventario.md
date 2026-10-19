# Inventario de datos personales y proveedores (borrador para abogado)

Elaborado 18-oct-2026 revisando el código y los tipos de base de datos de SuitePro. Es un punto de partida técnico, no asesoría legal.
Marco: Ley 21.719 (vigencia 1-dic-2026). Rol propuesto: congregación = responsable; Next Generation Developer LLC = encargado.

## 1. Datos personales por tabla

| Tabla | Datos | Titulares | Sensibilidad / nota |
|---|---|---|---|
| `participantes` | nombre, apellido, alias, teléfono, género, estado civil (`es_casado`, cónyuge), `tiene_hijos`, responsabilidades, grupo, `restriccion_disponibilidad`, `inscrito_emc`, aprobado/activo | Miembros de la congregación (pueden incluir menores) | **Alto**: revela pertenencia y rol religioso (convicción religiosa = dato sensible); incluye datos familiares y de menores |
| `profiles` | email, nombre, apellido, aprobación, flags de onboarding | Usuarios con cuenta | Identificación y contacto |
| `usuarios_congregacion`, `user_roles`, `permisos_*`, `perfiles_permisos` | vínculo usuario-congregación, roles y permisos | Usuarios | Control de acceso |
| `indisponibilidad_participantes` | fechas y **motivo** libre (viajes, licencias, posiblemente salud) | Participantes | **Posible dato de salud** si el motivo es libre; revisar |
| `historial_sesiones` | email, nombre, **IP**, user-agent, fecha login/logout | Usuarios | Datos de conexión; definir retención |
| `user_presence` | email, nombre, página actual, última conexión | Usuarios | Monitoreo en línea; definir necesidad y retención |
| `audit_log` | usuario, email, datos anteriores/nuevos de registros | Usuarios y participantes | Puede copiar datos personales; definir retención |
| `web_push_subscriptions`, `device_tokens` | endpoints/tokens de dispositivo | Usuarios | Identificadores técnicos |
| `notificacion_preferencias` | categorías de aviso activadas | Usuarios | Preferencias (base para consentimiento de avisos) |
| `programa_*`, `historial_participacion_vym`, `manzanas_trabajadas`, `ciclos_territorio`, asignaciones | quién hizo qué y cuándo (asignaciones, capitanes, participación) | Participantes | Revela actividad religiosa |
| `territorios`, `manzanas_*`, `direcciones_bloqueadas`, `puntos_encuentro` | direcciones de territorios, **direcciones bloqueadas** (no visitar), puntos de encuentro | Terceros (residentes) y anfitriones | Direcciones asociadas a actividad religiosa; las bloqueadas pueden implicar una negativa personal |

Páginas/RPC públicas (sin login): `get_*_publico*`, `get_territorio_publico`, `get_link_registro_manzanas`. Revisar qué datos personales exponen (nombres en programas publicados, direcciones).

## 2. Proveedores (subencargados) y datos que reciben

| Proveedor | Para qué | Datos | Pendiente |
|---|---|---|---|
| Supabase (proyectos DEV y PRD) | Base de datos, auth, storage, edge functions | Todos | Confirmar región (se cree EE. UU.-Virginia) y firmar/guardar su DPA |
| Vercel | Hosting del sitio | IPs y logs de acceso | DPA y región |
| Resend | Correos (alta de usuarios, recuperación de contraseña, avisos de programa, recordatorios) | email, nombre, contenido del aviso | DPA, región, política de retención de logs |
| Anthropic (Claude) | "Asignar con IA" (Predicación, Vida y Ministerio, Reunión Pública) | Nombre y apellido de participantes, género, responsabilidades, `es_casado`, `tiene_hijos`, cónyuge, historial de participación, indisponibilidad por fechas (Vida y Ministerio / Reunión Pública). Predicación envía capitanes e indisponibilidad (verificar campos exactos) | Decidir: anonimizar con IDs antes de enviar, o informar y cubrir en DPA; revisar términos de retención/entrenamiento de la API |
| Twilio / WhatsApp (solo DEV) | Aviso de asignación por WhatsApp | teléfono, nombre, intervención, fecha | No está en PRD; exige consentimiento expreso y DPA antes de pasar a PRD |
| Google (oauth2 token) | Servicio vinculado en una edge function | por confirmar | Identificar para qué se usa |
| WOL (jw.org) | Importación de programa Vida y Ministerio | No envía datos personales | — |

## 3. Brechas técnicas detectadas

1. **No hay página de política de privacidad ni términos** dentro de la app.
2. **No hay registro de consentimiento** (versión, fecha, quién aceptó, representante de menores, revocación).
3. **Derechos del titular:** existe `delete-own-account` para usuarios con cuenta (verificar que borre/anonimice `profiles`, sesiones, presence, push), pero **no hay exportación de datos (portabilidad/acceso)** ni canal de solicitudes; los participantes sin cuenta no tienen cómo ejercer derechos.
4. **Retención:** no se ve limpieza automática de `historial_sesiones`, `user_presence`, `audit_log`; no hay plazo definido para ex miembros.
5. **IA:** se envían nombres reales a un tercero en EE. UU. sin aviso ni anonimización.
6. **Indisponibilidad con motivo libre:** puede contener datos de salud; evaluar quitar el texto libre o restringir su acceso.
7. **IP y user-agent** guardados en sesiones: justificar finalidad y plazo.
8. **Notificaciones:** hay preferencias por categoría, pero no consentimiento específico para WhatsApp ni baja en cada correo (verificar).
9. **Brechas:** no hay protocolo de detección/aviso documentado.
10. **Menores:** no hay marca de edad ni flujo de representante legal.

## 4. Decisiones que necesita el abogado

- Base de licitud para datos de convicción religiosa tratados por la congregación para su propia organización (consentimiento explícito vs. excepción para entidades religiosas).
- Si la LLC (EE. UU.) debe designar representante en Chile.
- Edad y forma de consentimiento de menores.
- Cláusulas para transferencia internacional (Supabase, Vercel, Resend, Anthropic).
- Redacción del DPA encargo de tratamiento, política de privacidad, términos y texto del formulario de consentimiento.
