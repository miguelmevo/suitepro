# Variantes de Tipos de Salida

## Concepto

Agregar a cada **Tipo de Salida** una lista de **Variantes**: nombres de equipos/sub-grupos ficticios que **no** son grupos reales de predicación, pero sirven para dividir una salida (ej. el tipo "Cartas" puede tener variantes "Equipo A", "Equipo B", "Equipo Norte"…).

Son solo etiquetas configurables: viven dentro del tipo, no se relacionan con `grupos_predicacion`, no tienen miembros.

## Cambios

### Base de datos
Nueva tabla `tipos_salida_variantes`:
- `tipo_salida_id` (FK a `tipos_salida`, cascade)
- `congregacion_id`
- `nombre` (ej. "Equipo A")
- `orden`, `activo`
- RLS por congregación + GRANTs estándar.

### Mantenedor (`src/pages/predicacion/TiposSalida.tsx`)
En la tabla de tipos, cada fila se expande para mostrar sus **Variantes** con:
- Lista de variantes (nombre + orden + activo).
- Botón "Agregar variante" inline.
- Editar / eliminar variante.

Sin cambios en menú ni en el resto de la app. El formulario del programa **no** se toca en este paso — primero queda solo el mantenedor de variantes. Cuando confirmes que esto es lo que quieres, en un segundo paso lo conectamos al formulario del programa.

## Detalles técnicos

- Tabla nueva con índice por `(tipo_salida_id, orden)` y unique `(tipo_salida_id, nombre)`.
- Reutiliza permisos `predicacion_puntos` igual que `tipos_salida`.
- UI: usar `Collapsible` de shadcn para expandir cada fila del tipo y mostrar las variantes.
