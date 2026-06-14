CREATE POLICY "Usuarios con permisos granulares pueden ver participantes"
ON public.participantes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.permisos_usuario_congregacion p
    WHERE p.user_id = auth.uid()
      AND p.congregacion_id = participantes.congregacion_id
      AND p.puede_ver = true
  )
);