# PDF de Asignaciones de Servicio (dibujado)

## Qué es
El PDF de Asignaciones de Servicio (el que se **descarga** con el botón "Descargar" y el que se
**publica** en Programas del Mes) se DIBUJA con texto y líneas reales (jsPDF), a partir de los datos.
Antes se le sacaba una "foto" a la hoja en pantalla (html2canvas) y se pegaba como imagen.

- Diseños (los dos formatos): `src/lib/pdfAsignacionesServicio.ts`
- Motor de tablas (celdas combinadas, bordes, texto que baja de línea): `src/lib/pdfTablaGrid.ts`
- Conexión en pantalla: `src/pages/asignaciones-servicio/ProgramaAsignacionesServicio.tsx`
- Vista previa del PDF antes de descargar: `src/components/programa/PdfVistaPreviaDialog.tsx`

Formatos: cada congregación elige el suyo en Ajustes → Asignaciones → formato de impresión y el PDF lo respeta:
- **vertical** (Villa Real): hoja carta VERTICAL. Una fila por día y columnas agrupadas (acomodadores,
  micrófonos, audio y video, aseo con responsables, hospitalidad). Mismo tamaño y distribución que la hoja impresa (198 mm de ancho centrado, tabla a su alto natural, arriba).
- **horizontal** (San José de Maipo): hoja carta APAISADA. Una columna por fecha y una fila por asignación,
  con grupos y filas alternadas.
Imprimir sigue usando la hoja impresa de siempre y el PDF dibujado la reproduce. Ambos respetan el color del tema, los días especiales, los mensajes adicionales y la nota al pie. Si no
cabe, la letra y los espacios se reducen parejo; una palabra nunca se corta: se achica la letra de la celda.

## Cómo volver al método anterior (captura de pantalla)
En `ProgramaAsignacionesServicio.tsx` poner la constante `PDF_ASIG_VECTORIAL = false` (solo afecta a
publicar; el botón Descargar siempre usa el PDF dibujado). El método anterior sigue en el código y en la
etiqueta git `pdf-asig-captura-v1`.

## Qué cuidar al cambiar la hoja
Las hojas impresas (`ImpresionAsignacionesServicio.tsx` y `ImpresionAsignacionesServicioVertical.tsx`) y el
dibujo calculan lo mismo por separado (agrupación de columnas, filas combinadas del día especial, aseo con
texto libre, nombres abreviados de responsables). Si se cambia una regla en uno, cambiarla también en el otro.

## Notas
- Los PDF ya publicados no cambian solos: hay que volver a publicar el mes.
- Esta pantalla no tiene botón "Asignar con IA": los botones "A/H" y "Auto" usan reglas de rotación.
