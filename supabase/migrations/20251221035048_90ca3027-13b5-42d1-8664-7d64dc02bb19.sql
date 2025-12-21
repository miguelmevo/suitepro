-- Agregar columna de color a dias_especiales
ALTER TABLE public.dias_especiales 
ADD COLUMN color text NOT NULL DEFAULT '#1e3a5f';

-- Comentario para documentar los valores esperados
COMMENT ON COLUMN public.dias_especiales.color IS 'Color hexadecimal para la franja del día especial. Valores sugeridos: #1e3a5f (azul oscuro), #4a5568 (gris oscuro), #3182ce (azul claro), #48bb78 (verde claro)';