-- Simplifica los perfiles de sistema: solo queda "Administrador" (protegido,
-- full-access, no editable). Los otros 7 (Editor, Visualizador, S.Servicio,
-- S.R.Pública, S.V.Ministerio, S.A.Servicio, Usuario) se eliminan — las
-- congregaciones ya migraron a sus propios perfiles personalizados y
-- confirmaron que ningún usuario los tiene asignados. El ON DELETE CASCADE de
-- usuario_perfiles_asignados.perfil_id limpia solo cualquier asignación
-- residual.

DELETE FROM public.perfiles_permisos
WHERE es_sistema = true
  AND (app_role IS DISTINCT FROM 'admin');

-- Re-asegura que Administrador exista con permisos completos (por si en algún
-- ambiente ya se había borrado junto con el resto).
DO $$
DECLARE
  v_full jsonb := '{"ver":true,"crear":true,"editar":true,"eliminar":true}'::jsonb;
  v_view jsonb := '{"ver":true,"crear":false,"editar":false,"eliminar":false}'::jsonb;

  v_regular_modules text[] := ARRAY[
    'inicio','programas_del_mes',
    'predicacion_programa','predicacion_capitanes','predicacion_puntos',
    'predicacion_carritos','predicacion_territorios',
    'predicacion_territorios_historial','predicacion_historial',
    'reunion_publica_programa','reunion_publica_lectores',
    'vym_programa','vym_lectores_ebc','vym_historial',
    'asignaciones_servicio',
    'configuracion_participantes','configuracion_grupos','configuracion_dias_especiales',
    'ajustes_general','ajustes_asignaciones','ajustes_vida_ministerio',
    'ajustes_reunion_publica','ajustes_predicacion','ajustes_carritos',
    'configuracion_usuarios'
  ];
  v_cierre_modules text[] := ARRAY[
    'cierre_vym','cierre_reunion_publica',
    'cierre_asignaciones_servicio','cierre_predicacion'
  ];

  v_admin_perms jsonb := '{}'::jsonb;
  m text;
BEGIN
  FOREACH m IN ARRAY v_regular_modules LOOP
    v_admin_perms := v_admin_perms || jsonb_build_object(m, v_full);
  END LOOP;
  FOREACH m IN ARRAY v_cierre_modules LOOP
    v_admin_perms := v_admin_perms || jsonb_build_object(m, v_view);
  END LOOP;

  INSERT INTO public.perfiles_permisos
    (id, congregacion_id, nombre, descripcion, icono, permisos, es_sistema, app_role, color)
  VALUES
    ('00000000-0000-0000-0001-000000000001'::uuid,
     NULL, 'Administrador', 'Acceso total a la congregación.', 'shield',
     v_admin_perms, true, 'admin', '#ef4444')
  ON CONFLICT (id) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    descripcion = EXCLUDED.descripcion,
    icono = EXCLUDED.icono,
    permisos = EXCLUDED.permisos,
    es_sistema = true,
    app_role = 'admin',
    color = EXCLUDED.color;
END $$;

-- Backfill de color para perfiles personalizados ya creados sin color (nadie
-- elige color a mano; se asigna rotando la misma paleta que usa el frontend
-- al crear uno nuevo, por congregación y en orden de creación).
WITH paleta(color, idx) AS (
  VALUES
    ('#f97316', 0), ('#10b981', 1), ('#3b82f6', 2), ('#a855f7', 3), ('#ec4899', 4),
    ('#eab308', 5), ('#14b8a6', 6), ('#f43f5e', 7), ('#84cc16', 8), ('#6366f1', 9)
),
numerados AS (
  SELECT id, (row_number() OVER (PARTITION BY congregacion_id ORDER BY created_at) - 1) % 10 AS idx
  FROM public.perfiles_permisos
  WHERE es_sistema = false AND color IS NULL
)
UPDATE public.perfiles_permisos pp
SET color = paleta.color
FROM numerados, paleta
WHERE pp.id = numerados.id AND paleta.idx = numerados.idx;
