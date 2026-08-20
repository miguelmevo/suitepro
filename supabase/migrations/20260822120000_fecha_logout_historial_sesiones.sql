-- Respaldo de cierre de sesión: se llena vía Realtime Presence (evento
-- "leave") o al cerrar la pestaña (beforeunload), como respaldo del uno
-- al otro por si alguno falla en detectar la desconexión.
ALTER TABLE public.historial_sesiones
  ADD COLUMN IF NOT EXISTS fecha_logout timestamptz;

CREATE POLICY "Users can update their own sessions"
ON public.historial_sesiones
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Super admin can update all session history"
ON public.historial_sesiones
FOR UPDATE
USING (is_super_admin(auth.uid()));
