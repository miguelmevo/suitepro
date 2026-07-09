---
name: Super admin no puede ser participante
description: Trigger DB que impide vincular un super_admin a un registro de participantes o a una membresía con participante_id
type: constraint
---
El super_admin es un usuario puramente administrativo con acceso global a todas las congregaciones, pero NUNCA debe figurar como participante/publicador.

Triggers en DB:
- `trg_prevent_super_admin_as_participante` en `participantes` (BEFORE INSERT/UPDATE de `user_id`)
- `trg_prevent_super_admin_membership_with_participante` en `usuarios_congregacion` (BEFORE INSERT/UPDATE de `participante_id`/`user_id`)

Ambos usan `is_super_admin(user_id)` y lanzan excepción si se intenta la asociación.

**Por qué:** evitar que el super_admin aparezca en listados de publicadores, capitanes, asignaciones, lectores, etc.
