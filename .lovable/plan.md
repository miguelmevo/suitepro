
# Plan: Módulo "Vida y Ministerio" — Fase 1 (Manual)

## Resumen
Nuevo módulo de reunión entre semana con formulario semanal dinámico (1-4 discursos de Maestros, 1-3 partes de Vida Cristiana), configuración de salas auxiliares (0/1/2 con override semanal), filtros estrictos de roles, y nuevo campo género en participantes para Lectura Bíblica. La importación automática del PDF mwb queda para Fase 2 (futuro).

---

## Lo que se construye

### 1. Nuevo menú "Vida y Ministerio"
Sidebar nueva sección con icono BookOpen, ruta `/vida-y-ministerio` (lista semanal) y `/vida-y-ministerio/:fecha` (editor de semana). Visible para admin, editor, super_admin y rol `svministerio`. Solo lectura para viewer.

### 2. Configuración (Ajustes Sistema → bloque "Vida y Ministerio")
- **Salas auxiliares globales**: selector 0 / 1 (Sala B) / 2 (Sala B y C)
- **Día y hora de la reunión** (lunes-domingo, formato HH:MM) — independiente de la reunión pública

### 3. Editor semanal (formulario dinámico)
Pantalla de edición por semana con estos bloques:

**Cabecera semanal**
- Fecha de la semana (selector que muestra "Lunes DD a Domingo DD")
- Override de salas auxiliares (hereda global, opcional)
- Cántico inicial (1-159), Cántico intermedio, Cántico final
- Oración inicial (selector participante), Oración final (selector participante)
- Presidente (selector filtrado: solo `anciano`)

**TESOROS DE LA BIBLIA**
- Tesoros de la Biblia: título + asignado (filtro: `anciano` o `siervo_ministerial`)
- Perlas escondidas: asignado (mismo filtro)
- Lectura bíblica: cita + asignado (filtro: `genero=M` y publicador activo)

**SEAMOS MEJORES MAESTROS** — repetidor dinámico (1-4 discursos)
Botón [+ Agregar discurso] / [- Quitar]. Cada discurso tiene:
- Título del discurso (texto libre)
- Tipo: Demostración (con ayudante) / Discurso (solo titular)
- Titular (filtro: cualquier publicador activo)
- Ayudante (solo si es demostración; cualquier publicador activo)

Si hay salas auxiliares: campo **Encargado Sala B** (y **Sala C** si =2), filtro `anciano` o `siervo_ministerial`.

**NUESTRA VIDA CRISTIANA** — repetidor dinámico (1-3 partes)
Cada parte: título + asignado (filtro `anciano` o `siervo_ministerial`).
- Estudio Bíblico de la Congregación: lectura/material + Conductor (filtro `anciano`) + Lector (filtro: aparece en `lectores_atalaya_elegibles`)

**Notas adicionales** (texto libre opcional)

### 4. Vista de lista
Tabla con próximas semanas + historial. Columnas: fecha de la semana, presidente, estudio bíblico, estado (borrador/completo). Botones: editar, duplicar, eliminar (admin/editor/svministerio según rol).

### 5. Integración con "Mis Asignaciones" (Inicio)
Cualquier participante asignado a una parte verá la asignación en su lista cronológica unificada en Inicio.

---

## Cambios técnicos

### Migración de base de datos

**Tabla nueva `programa_vida_ministerio`**
- `congregacion_id` (FK), `fecha_semana` (date, lunes), `presidente_id`
- `cantico_inicial`, `cantico_intermedio`, `cantico_final` (smallint 1-159)
- `oracion_inicial_id`, `oracion_final_id` (FK participante)
- `salas_auxiliares_override` (smallint nullable)
- `tesoros` (jsonb): `{titulo, participante_id}`
- `perlas_id` (FK participante)
- `lectura_biblica` (jsonb): `{cita, participante_id}`
- `maestros` (jsonb array): `[{titulo, tipo, titular_id, ayudante_id}]`
- `encargado_sala_b_id`, `encargado_sala_c_id` (FK participante, nullable)
- `vida_cristiana` (jsonb array): `[{titulo, participante_id}]`
- `estudio_biblico` (jsonb): `{titulo, conductor_id, lector_id}`
- `notas`, `estado` ('borrador' | 'completo'), `activo`
- Unique: `(congregacion_id, fecha_semana)`
- RLS: SELECT por congregación; INSERT/UPDATE/DELETE solo `admin`/`editor`/`super_admin`/`svministerio`

**Columna nueva `participantes.genero`**
- `text` con CHECK ('M' o 'F'), nullable (para no romper datos existentes)
- Se agrega al modal de participantes como Radio (Masculino/Femenino/Sin especificar)
- Filtro de Lectura Bíblica usa `genero = 'M'`

**Configuración nueva en `configuracion_sistema`**
- Clave `salas_auxiliares` con `{cantidad: 0|1|2}`
- Clave `dia_reunion_vym` con `{dia_semana: 0-6, hora: "HH:MM"}`

### Frontend
- Nueva carpeta `src/pages/vida-y-ministerio/` con `Lista.tsx` y `Editor.tsx`
- Nuevo hook `src/hooks/useProgramaVidaMinisterio.ts` (CRUD + filtros con react-query)
- Nuevos componentes en `src/components/vida-y-ministerio/`:
  - `MaestrosRepeater.tsx` (1-4 discursos dinámicos)
  - `VidaCristianaRepeater.tsx` (1-3 partes dinámicas)
  - `ParticipanteSelector.tsx` reutilizable con prop `filtro` (anciano | anciano_o_sm | varon_publicador | lector_atalaya | cualquiera)
- Actualizar `MisAsignaciones.tsx` para incluir asignaciones de VyM
- Actualizar `AppSidebar.tsx` y `MobileNav.tsx` con nuevo item de menú
- Actualizar `Participantes.tsx` y modal correspondiente con campo género

### Permisos
- Solo lectura para `viewer` y `saservicio`
- Edición completa para `admin`, `editor`, `super_admin`, `svministerio`

---

## Lo que NO incluye esta fase
- ❌ Importación automática desde PDF mwb (fase 2)
- ❌ Generación de PDF / impresión (queda para fase posterior, según pediste)
- ❌ Notificaciones por email a asignados (puede agregarse después)
- ❌ Sincronización con wol.jw.org

---

## Memoria a guardar
Una vez aprobado e implementado, se guardará una memoria documentando la arquitectura del módulo, el modelo JSONB y los filtros de cada selector.

---

¿Apruebas este plan para que comience a implementarlo?
