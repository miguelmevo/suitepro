
-- Allow users to INSERT their own indisponibilidad (via their linked participante)
CREATE POLICY "Users can create own indisponibilidad"
ON public.indisponibilidad_participantes
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM participantes p
    WHERE p.id = participante_id
    AND p.user_id = auth.uid()
    AND p.activo = true
  )
);

-- Allow users to UPDATE their own indisponibilidad
CREATE POLICY "Users can update own indisponibilidad"
ON public.indisponibilidad_participantes
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM participantes p
    WHERE p.id = participante_id
    AND p.user_id = auth.uid()
    AND p.activo = true
  )
);

-- Allow users to soft-delete their own indisponibilidad
CREATE POLICY "Users can delete own indisponibilidad"
ON public.indisponibilidad_participantes
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM participantes p
    WHERE p.id = participante_id
    AND p.user_id = auth.uid()
    AND p.activo = true
  )
);
