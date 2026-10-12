# PDF del programa de Reunión Pública (dibujado)

## Qué es
El PDF de Reunión Pública (el que se **descarga** con el botón "Descargar" y el que se **publica** en
Programas del Mes) se DIBUJA con texto y líneas reales (jsPDF), a partir de los datos. Antes se le sacaba
una "foto" a la hoja en pantalla (html2canvas) y se pegaba como imagen.

- Dibujo: `src/lib/pdfReunionPublica.ts`
- Conexión en pantalla: `src/pages/reunion-publica/ProgramaReunionPublica.tsx` (Descargar, vista previa del
  PDF, publicar)
- Vista previa del PDF antes de descargar: `src/components/programa/PdfVistaPreviaDialog.tsx`

Diseño: hoja carta vertical, márgenes de 10 mm arriba/abajo y 12 mm a los lados, título con el color del
tema de la congregación, un recuadro con esquinas redondeadas por reunión (fecha, presidente, orador y su
congregación, tema, lector), días especiales y mensajes adicionales. Todo en una hoja: si no cabe, la letra
y los espacios se reducen parejo.

## Cómo volver al método anterior (captura de pantalla)
En `ProgramaReunionPublica.tsx` poner la constante `PDF_RP_VECTORIAL = false` (solo afecta a publicar; el
botón Descargar siempre usa el PDF dibujado). El método anterior sigue en el código y en la etiqueta git
`pdf-rp-captura-v1`.

## Qué cuidar al cambiar la hoja
La hoja impresa (`src/components/reunion-publica/ImpresionReunionPublica.tsx`) y el dibujo calculan lo
mismo por separado (filas, colores de días especiales, mayúsculas del nombre de la congregación). Si se
cambia una regla en uno, cambiarla también en el otro.

## Notas
- Los PDF ya publicados no cambian solos: hay que volver a publicar el mes.
- El botón "Asignar con IA" se quitó de la pantalla (la función y su diálogo siguen en el código).
