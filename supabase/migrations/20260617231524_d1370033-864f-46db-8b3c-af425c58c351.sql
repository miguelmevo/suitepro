
-- programa_reunion_publica
DROP POLICY "Admin y Editor pueden crear programa en su congregación" ON public.programa_reunion_publica;
DROP POLICY "Admin y Editor pueden actualizar programa de su congregación" ON public.programa_reunion_publica;
DROP POLICY "Admin y Editor pueden eliminar programa de su congregación" ON public.programa_reunion_publica;

CREATE POLICY "Crear programa reunion publica" ON public.programa_reunion_publica
  FOR INSERT WITH CHECK (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'crear')
  );
CREATE POLICY "Actualizar programa reunion publica" ON public.programa_reunion_publica
  FOR UPDATE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'editar')
  );
CREATE POLICY "Eliminar programa reunion publica" ON public.programa_reunion_publica
  FOR DELETE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_programa', 'eliminar')
  );

-- conductores_atalaya
DROP POLICY "Admin y Editor pueden crear conductores en su congregación" ON public.conductores_atalaya;
DROP POLICY "Admin y Editor pueden actualizar conductores de su congregació" ON public.conductores_atalaya;
DROP POLICY "Admin y Editor pueden eliminar conductores de su congregación" ON public.conductores_atalaya;

CREATE POLICY "Crear conductores atalaya" ON public.conductores_atalaya
  FOR INSERT WITH CHECK (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'crear')
  );
CREATE POLICY "Actualizar conductores atalaya" ON public.conductores_atalaya
  FOR UPDATE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'editar')
  );
CREATE POLICY "Eliminar conductores atalaya" ON public.conductores_atalaya
  FOR DELETE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'eliminar')
  );

-- lectores_atalaya_elegibles
DROP POLICY "Admin y Editor pueden crear lectores elegibles en su congregaci" ON public.lectores_atalaya_elegibles;
DROP POLICY "Admin y Editor pueden actualizar lectores elegibles de su congr" ON public.lectores_atalaya_elegibles;
DROP POLICY "Admin y Editor pueden eliminar lectores elegibles de su congreg" ON public.lectores_atalaya_elegibles;

CREATE POLICY "Crear lectores atalaya elegibles" ON public.lectores_atalaya_elegibles
  FOR INSERT WITH CHECK (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'crear')
  );
CREATE POLICY "Actualizar lectores atalaya elegibles" ON public.lectores_atalaya_elegibles
  FOR UPDATE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'editar')
  );
CREATE POLICY "Eliminar lectores atalaya elegibles" ON public.lectores_atalaya_elegibles
  FOR DELETE USING (
    is_admin_or_editor_in_congregacion(congregacion_id)
    OR has_permission(auth.uid(), congregacion_id, 'reunion_publica_lectores', 'eliminar')
  );
