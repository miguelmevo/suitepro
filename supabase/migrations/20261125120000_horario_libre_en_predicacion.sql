-- El interruptor "Horario libre" pasa a los ajustes de Predicación, para que lo puedan guardar
-- quienes editan esa pestaña (antes estaba como ajuste "general").
UPDATE public.configuracion_sistema g
   SET programa_tipo = 'predicacion'
 WHERE g.programa_tipo = 'general'
   AND g.clave = 'horario_libre'
   AND NOT EXISTS (
     SELECT 1 FROM public.configuracion_sistema p
      WHERE p.congregacion_id = g.congregacion_id
        AND p.programa_tipo = 'predicacion'
        AND p.clave = 'horario_libre'
   );

DELETE FROM public.configuracion_sistema
 WHERE programa_tipo = 'general' AND clave = 'horario_libre';
