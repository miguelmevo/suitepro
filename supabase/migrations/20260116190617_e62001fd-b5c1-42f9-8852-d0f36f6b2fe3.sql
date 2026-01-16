-- Agregar el nuevo rol 'viewer' al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';

-- Nota: El rol 'viewer' tendrá acceso de solo lectura a todo excepto usuarios.
-- Las políticas RLS existentes ya restringen escritura a admin/editor,
-- por lo que viewer automáticamente solo podrá leer datos.