# Bloquear reuniones por Día Especial (Asamblea / Conmemoración)

## Objetivo
Permitir marcar que una fecha concreta no tiene Reunión de Vida y Ministerio y/o Reunión Pública por un evento especial. En la vista pública y al imprimir el PDF, el programa se reemplaza por un banner a lo ancho con el motivo (nombre del día especial) y su color. El editor queda **bloqueado** (solo lectura) para esa semana.

## Cambios

### 1. Base de datos (migración)
Añadir a la tabla `dias_especiales` una columna nueva:
- `bloquea_reuniones text[]` con valores posibles: `vida_ministerio`, `reunion_publica`. Default `'{}'`.

Mantener `bloqueo_tipo` como hasta ahora (predicación AM/PM/completo). Las dos columnas son independientes:
- `bloqueo_tipo`: qué franja de **predicación** se bloquea.
- `bloquea_reuniones`: qué **reuniones** se bloquean.

### 2. Ajustes del sistema → Días Especiales
En `src/pages/configuracion/AjustesSistema.tsx` (formularios crear/editar día especial):
- Añadir un grupo de checkboxes "**Bloquea reuniones**":
  - ☐ Reunión de Vida y Ministerio (entre semana)
  - ☐ Reunión Pública (fin de semana)
- En la lista de días especiales, mostrar como chips qué bloquea (además del label actual de predicación).

### 3. Hook `useDiasEspeciales.ts`
- Añadir campo `bloquea_reuniones: string[]` al tipo y al insert/update.
- Exponer helper `getDiaEspecialQueBloquea(fecha, tipo)` para que cualquier vista pueda consultar si una fecha está bloqueada para `'vida_ministerio'` o `'reunion_publica'`.

### 4. Vida y Ministerio
- **Editor** (`src/pages/vida-y-ministerio/Editor.tsx`): si la semana contiene un día especial que bloquea `vida_ministerio`, mostrar el banner a lo ancho (mismo color del día especial) en lugar del formulario y deshabilitar Guardar / Publicar. Mensaje: "No hay reunión esta semana — {nombre del día especial}".
- **Vista pública / Inicio** (`VidaMinisterioSemanal.tsx`): si bloqueada, reemplazar el cuerpo de la tarjeta por el banner.
- **PDF** (`ImpresionVidaMinisterio.tsx`): renderizar página con cabecera estándar + banner a lo ancho con el motivo en lugar del programa.

### 5. Reunión Pública
- **Editor** (`src/pages/reunion-publica/ProgramaReunionPublica.tsx`): mismo patrón, bloqueo + banner.
- **Vista pública** (`src/components/programa/ReunionPublicaSemanal.tsx`): banner en lugar de los datos del orador.
- **PDF** (`src/components/reunion-publica/ImpresionReunionPublica.tsx`): banner a lo ancho.

### 6. Componente compartido
Crear `src/components/shared/BannerSinReunion.tsx`:
```
[NombreDíaEspecial en MAYÚSCULAS]
No hay reunión — {fecha}
```
Fondo con `color` del día especial, texto blanco, ancho completo, padding generoso. Se reutiliza en editor, vista pública y PDF.

## Detalle técnico
- La detección de bloqueo se hace por fecha exacta del día de reunión (martes para VyM, sábado/domingo para Pública según configuración de la congregación).
- En el PDF se mantiene la cabecera estándar (logo/congregación/fecha) para que sea reconocible al imprimir.
- No se borran datos del programa si ya existían; solo se ocultan mientras esté el bloqueo activo, así si se elimina el día especial vuelve a aparecer el programa original.

## Memoria
Añadir `mem://features/dias-especiales/bloqueo-reuniones-v1` describiendo el nuevo campo y comportamiento de bloqueo + banner.
