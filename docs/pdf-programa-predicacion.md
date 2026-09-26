# PDF descargable del Programa de Predicación

Botón verde **Descargar PDF** en *Predicación → Programa Mensual*
(`src/pages/predicacion/ProgramaMensual.tsx`). Este documento explica los dos
métodos que existen, por qué se cambió y **cómo volver al anterior**.

## Los dos métodos

| | Método A: PDF dibujado (actual) | Método B: captura de pantalla (anterior) |
|---|---|---|
| Cómo funciona | Se dibuja la tabla con texto y líneas reales (jsPDF), a partir de las filas del programa | Se fotografía la hoja de impresión con `html2canvas` y se pega como imagen en el PDF |
| Archivos | `src/lib/pdfProgramaPredicacion.ts`, `src/lib/programaPredicacionFilas.ts` | `src/lib/pdfDesdeElemento.ts` (+ la copia oculta de `ImpresionPrograma`) |
| Depende del navegador | No: sale igual en Safari, Chrome, Edge y Firefox | Sí: cada navegador acomoda la tabla distinto |
| Texto | Nítido y seleccionable, archivo liviano | Imagen (no seleccionable), archivo más pesado |
| Problema conocido | — | En **Safari** los anchos de columna se perdían: las 5 columnas de la mañana quedaban iguales y el nombre del punto de encuentro se derramaba sobre Territorio |

Historia resumida: primero se probó el método B y se le fueron corrigiendo detalles (estilos de
impresión, anchos en píxeles, motor nativo `foreignObjectRendering`, recorte del blanco, etc.). En
Chrome quedó bien, pero en Safari seguían desbordándose los datos. Como la causa es que el PDF
depende de cómo el navegador acomoda una tabla, se pasó al método A (el mismo criterio que ya usa
el PDF del formulario S-13).

## Cómo volver al método anterior (B)

Hay dos formas, de la más simple a la más completa:

1. **Interruptor (recomendado).** En `src/pages/predicacion/ProgramaMensual.tsx` está la constante

   ```ts
   const PDF_PREDICACION_VECTORIAL = true;
   ```

   Poniéndola en `false` el botón vuelve a usar la captura de pantalla (método B). No hay que tocar
   nada más: el código de ambos métodos sigue en el proyecto.

2. **Volver a la versión exacta anterior con git.** El estado justo antes del cambio está marcado
   con la etiqueta `pdf-predicacion-captura-v1`:

   ```bash
   git diff pdf-predicacion-captura-v1 -- src/pages/predicacion/ProgramaMensual.tsx   # ver qué cambió
   git checkout pdf-predicacion-captura-v1 -- src/pages/predicacion/ProgramaMensual.tsx src/components/programa/ImpresionPrograma.tsx src/lib/pdfDesdeElemento.ts
   ```

   (Si se revierte `ImpresionPrograma.tsx` a la etiqueta, el archivo `programaPredicacionFilas.ts` queda
   sin uso, pero no molesta.)

## Cómo está armado el método A

- **Datos:** `generarFilasPrograma()` (`src/lib/programaPredicacionFilas.ts`) convierte el programa
  en filas (una por salida, con la mañana, la tarde y los mensajes). Es el mismo código que antes vivía
  dentro de `ImpresionPrograma.tsx`; ahora lo usan la impresión/vista previa **y** el PDF, para que
  ambos muestren lo mismo.
- **Dibujo:** `generarPdfProgramaPredicacion()` (`src/lib/pdfProgramaPredicacion.ts`).
  - Hoja carta vertical, márgenes de 6 mm. Columnas fijas (en %): fecha 7 · mañana: hora 5, grupos 7,
    punto de encuentro 21, terr. 7, capitán 10 · tarde: hora 5, dirección 21, terr. 7, capitán 10.
  - Cada día es un bloque con sus sub-filas: la fecha ocupa todas; las salidas de mañana/tarde se
    reparten como en la impresión (`rowSpan` cuando una jornada tiene menos salidas que la otra);
    los mensajes (reunión, visita, día especial) van en gris; los días alternos llevan el color de fila
    del tema de la congregación.
  - Cada texto vive dentro de su celda: baja de línea **entre palabras**; si una palabra no cabe, se
    achica la letra. Nunca se corta una palabra ni se sale de la celda.
  - El tamaño de letra y el aire de las filas se calculan solos para llenar la hoja. Si un mes no cupiera
    ni con la letra mínima, se reparte en varias hojas repitiendo la cabecera.
- **Colores:** salen del tema de la congregación (`getColorTheme(...).pdf`), como la impresión.
- **Nombre del archivo:** `aaaa.mm.dd_Predicacion_<mes_año>_<congregación>.pdf`.

## Qué revisar si algo se ve distinto de la impresión

- Un tipo de fila nuevo en la impresión (`ImpresionPrograma.tsx`) hay que reflejarlo también en
  `armarBloque()` de `pdfProgramaPredicacion.ts`.
- Los anchos de columna del PDF (`PCT`) son independientes de los de la impresión (`.col-*` en
  `ImpresionPrograma.tsx`); si se cambian unos, conviene cambiar los otros.
