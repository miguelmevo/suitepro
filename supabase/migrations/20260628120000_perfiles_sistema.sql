-- ============================================================
-- Migración: Perfiles del sistema (roles predefinidos en DB)
-- ============================================================
-- Hace congregacion_id nullable para perfiles del sistema
-- Agrega columnas es_sistema, app_role, color
-- Actualiza RLS para incluir perfiles del sistema
-- Siembra los 8 perfiles del sistema predefinidos
-- ============================================================

-- 1. Modificar columnas
ALTER TABLE public.perfiles_permisos
  ALTER COLUMN congregacion_id DROP NOT NULL;

ALTER TABLE public.perfiles_permisos
  ADD COLUMN IF NOT EXISTS es_sistema  boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS app_role    text     NULL,
  ADD COLUMN IF NOT EXISTS color       text     NULL;

-- 2. Actualizar FK para permitir NULL (sin CASCADE para filas con NULL)
ALTER TABLE public.perfiles_permisos
  DROP CONSTRAINT IF EXISTS perfiles_permisos_congregacion_id_fkey;
ALTER TABLE public.perfiles_permisos
  ADD CONSTRAINT perfiles_permisos_congregacion_id_fkey
  FOREIGN KEY (congregacion_id)
  REFERENCES public.congregaciones(id)
  ON DELETE CASCADE;

-- 3. Índice para filtrar perfiles del sistema
CREATE INDEX IF NOT EXISTS perfiles_permisos_sistema_idx
  ON public.perfiles_permisos(es_sistema);

-- 4. Actualizar RLS
DROP POLICY IF EXISTS "perfiles_permisos_select" ON public.perfiles_permisos;
DROP POLICY IF EXISTS "perfiles_permisos_insert" ON public.perfiles_permisos;
DROP POLICY IF EXISTS "perfiles_permisos_update" ON public.perfiles_permisos;
DROP POLICY IF EXISTS "perfiles_permisos_delete" ON public.perfiles_permisos;

-- SELECT: perfiles del sistema visibles a todos; perfiles de congregación solo a miembros
CREATE POLICY "perfiles_permisos_select"
  ON public.perfiles_permisos FOR SELECT
  USING (
    es_sistema = true
    OR (
      congregacion_id IS NOT NULL
      AND congregacion_id IN (
        SELECT congregacion_id FROM public.usuarios_congregacion WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT: super_admin siempre; admin solo para perfiles de congregación propia
CREATE POLICY "perfiles_permisos_insert"
  ON public.perfiles_permisos FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      NOT es_sistema
      AND congregacion_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.usuarios_congregacion
          WHERE user_id = auth.uid()
            AND congregacion_id = perfiles_permisos.congregacion_id
            AND rol = 'admin'
        )
        OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'crear')
      )
    )
  );

-- UPDATE: super_admin siempre; admin solo para perfiles de su congregación y no del sistema
CREATE POLICY "perfiles_permisos_update"
  ON public.perfiles_permisos FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      NOT es_sistema
      AND congregacion_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.usuarios_congregacion
          WHERE user_id = auth.uid()
            AND congregacion_id = perfiles_permisos.congregacion_id
            AND rol = 'admin'
        )
        OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'editar')
      )
    )
  );

-- DELETE: super_admin siempre; admin solo para perfiles de su congregación y no del sistema
CREATE POLICY "perfiles_permisos_delete"
  ON public.perfiles_permisos FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      NOT es_sistema
      AND congregacion_id IS NOT NULL
      AND (
        EXISTS (
          SELECT 1 FROM public.usuarios_congregacion
          WHERE user_id = auth.uid()
            AND congregacion_id = perfiles_permisos.congregacion_id
            AND rol = 'admin'
        )
        OR public.has_permission(auth.uid(), congregacion_id, 'configuracion_usuarios', 'eliminar')
      )
    )
  );

-- 5. Sembrar los 8 perfiles del sistema
DO $$
DECLARE
  v_full  jsonb := '{"ver":true,"crear":true,"editar":true,"eliminar":true}'::jsonb;
  v_view  jsonb := '{"ver":true,"crear":false,"editar":false,"eliminar":false}'::jsonb;
  v_edit  jsonb := '{"ver":true,"crear":true,"editar":true,"eliminar":false}'::jsonb;

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

  v_admin_perms  jsonb := '{}'::jsonb;
  v_editor_perms jsonb := '{}'::jsonb;
  v_viewer_perms jsonb := '{}'::jsonb;
  m text;
BEGIN
  -- Administrador: todos FULL + cierres VIEW
  FOREACH m IN ARRAY v_regular_modules LOOP
    v_admin_perms := v_admin_perms || jsonb_build_object(m, v_full);
  END LOOP;
  FOREACH m IN ARRAY v_cierre_modules LOOP
    v_admin_perms := v_admin_perms || jsonb_build_object(m, v_view);
  END LOOP;

  -- Editor: todos EDIT_NO_DEL (sin módulos de cierre)
  FOREACH m IN ARRAY v_regular_modules LOOP
    v_editor_perms := v_editor_perms || jsonb_build_object(m, v_edit);
  END LOOP;

  -- Visualizador: todos VIEW incluyendo cierres
  FOREACH m IN ARRAY v_regular_modules LOOP
    v_viewer_perms := v_viewer_perms || jsonb_build_object(m, v_view);
  END LOOP;
  FOREACH m IN ARRAY v_cierre_modules LOOP
    v_viewer_perms := v_viewer_perms || jsonb_build_object(m, v_view);
  END LOOP;

  INSERT INTO public.perfiles_permisos
    (id, congregacion_id, nombre, descripcion, icono, permisos, es_sistema, app_role, color)
  VALUES
    -- Administrador
    ('00000000-0000-0000-0001-000000000001'::uuid,
     NULL, 'Administrador', 'Acceso total a la congregación.', 'shield',
     v_admin_perms, true, 'admin', '#ef4444'),

    -- Editor
    ('00000000-0000-0000-0001-000000000002'::uuid,
     NULL, 'Editor', 'Crea y edita programas. No puede eliminar ni cerrar/reabrir.', 'edit',
     v_editor_perms, true, 'editor', '#3b82f6'),

    -- Visualizador
    ('00000000-0000-0000-0001-000000000003'::uuid,
     NULL, 'Visualizador', 'Solo lectura en todos los módulos.', 'eye',
     v_viewer_perms, true, 'viewer', '#6366f1'),

    -- Superintendente de Servicio
    ('00000000-0000-0000-0001-000000000004'::uuid,
     NULL, 'S. Servicio', 'Superintendente de servicio. Gestiona asignaciones de servicio.', 'users',
     '{
       "inicio":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "programas_del_mes":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "asignaciones_servicio":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "ajustes_asignaciones":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "cierre_asignaciones_servicio":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "configuracion_participantes":{"ver":true,"crear":false,"editar":false,"eliminar":false}
     }'::jsonb,
     true, 'sservicio', '#10b981'),

    -- Superintendente Reunión Pública
    ('00000000-0000-0000-0001-000000000005'::uuid,
     NULL, 'S.R. Pública', 'Superintendente de reunión pública. Gestiona programas y lectores.', 'book',
     '{
       "inicio":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "programas_del_mes":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "reunion_publica_programa":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "reunion_publica_lectores":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "ajustes_reunion_publica":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "cierre_reunion_publica":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "configuracion_participantes":{"ver":true,"crear":false,"editar":false,"eliminar":false}
     }'::jsonb,
     true, 'srpublica', '#8b5cf6'),

    -- Superintendente Vida y Ministerio
    ('00000000-0000-0000-0001-000000000006'::uuid,
     NULL, 'S.V. Ministerio', 'Superintendente de vida y ministerio. Gestiona programa VYM.', 'calendar',
     '{
       "inicio":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "programas_del_mes":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "vym_programa":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "vym_lectores_ebc":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "vym_historial":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "ajustes_vida_ministerio":{"ver":true,"crear":true,"editar":true,"eliminar":true},
       "cierre_vym":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "configuracion_participantes":{"ver":true,"crear":false,"editar":false,"eliminar":false}
     }'::jsonb,
     true, 'svministerio', '#f97316'),

    -- Superintendente Asistente de Asignaciones de Servicio
    ('00000000-0000-0000-0001-000000000007'::uuid,
     NULL, 'S.A. Servicio', 'Superintendente asistente de asignaciones de servicio. Puede crear y editar, no eliminar.', 'tool',
     '{
       "inicio":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "programas_del_mes":{"ver":true,"crear":false,"editar":false,"eliminar":false},
       "asignaciones_servicio":{"ver":true,"crear":true,"editar":true,"eliminar":false},
       "configuracion_participantes":{"ver":true,"crear":false,"editar":false,"eliminar":false}
     }'::jsonb,
     true, 'saservicio', '#14b8a6'),

    -- Usuario base
    ('00000000-0000-0000-0001-000000000008'::uuid,
     NULL, 'Usuario', 'Sin permisos especiales. Acceso mínimo a la aplicación.', 'user',
     '{}'::jsonb,
     true, 'user', '#94a3b8')

  ON CONFLICT (id) DO NOTHING;
END $$;
