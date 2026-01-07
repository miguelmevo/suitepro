
-- Agregar user_id a participantes para vincular con usuarios de auth
ALTER TABLE public.participantes 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Crear índice único para garantizar 1 participante por usuario
CREATE UNIQUE INDEX IF NOT EXISTS idx_participantes_user_id 
ON public.participantes(user_id) WHERE user_id IS NOT NULL;

-- Agregar campo para controlar si el usuario debe cambiar contraseña
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS debe_cambiar_password boolean DEFAULT false;

-- Actualizar política RLS de participantes para que usuarios normales solo vean su propio participante
DROP POLICY IF EXISTS "Admin y Editor pueden ver participantes de su congregación" ON public.participantes;

CREATE POLICY "Usuarios pueden ver su propio participante"
ON public.participantes
FOR SELECT
USING (
  -- El usuario ve su propio participante
  (user_id = auth.uid())
  OR
  -- Admin/Editor ven todos los de su congregación
  is_admin_or_editor_in_congregacion(congregacion_id)
);

-- Actualizar política de UPDATE para permitir que usuarios editen su propio participante
DROP POLICY IF EXISTS "Admin y Editor pueden actualizar participantes de su congregaci" ON public.participantes;

CREATE POLICY "Usuarios pueden actualizar su participante o admin/editor todos"
ON public.participantes
FOR UPDATE
USING (
  (user_id = auth.uid())
  OR
  is_admin_or_editor_in_congregacion(congregacion_id)
);
