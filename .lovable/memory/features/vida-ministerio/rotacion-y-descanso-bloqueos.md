---
name: VyM — Rotación + Descanso global con umbral
description: Reglas de bloqueo del ParticipanteSelector y la IA (rotación por categoría, descanso global, umbral de relajación 2B)
type: feature
---

## Parámetros (configuracion_sistema, programa_tipo=vida_ministerio)

- `ventana_rotacion_semanas` `{semanas:n}` — default 8. Mínimo de semanas entre dos asignaciones **de la misma categoría**.
- `ventana_descanso_global_semanas` `{semanas:n}` — default 0 (desactivado). Mínimo de semanas entre **cualquier** participación (excluye oraciones).
- `umbral_relajacion_seleccion` `{cantidad:n}` — default 5. Si hay >= n participantes limpios, los bloqueados quedan no seleccionables. Si hay menos, se permiten con badge ⚠.

## Categorías exentas
`oracion_inicial` y `oracion_final` **NO** aplican ninguna regla y **NO** cuentan para el descanso global de otras asignaciones.

## Implementación
- Helper: `src/lib/vida-ministerio-bloqueos.ts` (`computeBloqueo`, `leerBloqueoConfig`, `esCategoriaOracion`).
- UI: `ParticipanteSelector` recibe props `categoria` + `fechaPrograma` (cuando aplica); muestra badge `ROT` (rojo) o `DESC` (ámbar) y tooltip con motivo. Si el participante ya estaba seleccionado, no se deshabilita (no perder valor previo).
- Edge: `asignar-vida-ministerio-ia` envía `ultima_participacion_no_oracion` por participante y aplica las dos reglas + umbral en el system prompt.
