# PDF del programa de Vida y Ministerio (dibujado)

## Qué es
El PDF de Vida y Ministerio (el que se **descarga** con el botón verde y el que se **publica**
en Programas del Mes) se DIBUJA con texto y líneas reales (jsPDF), a partir de los datos de cada
semana. Antes se le sacaba una "foto" a la hoja en pantalla (html2canvas) y se pegaba como imagen.

- Dibujo: `src/lib/pdfVidaMinisterio.ts`
- Modelo de cada semana (horas, títulos, quién va en cada parte): `src/lib/vidaMinisterioFilas.ts`
- Conexión en pantalla: `src/pages/vida-y-ministerio/Lista.tsx` (botón "Descargar PDF" y publicar)

Diseño: hoja carta vertical, márgenes de 10 mm arriba/abajo y 12 mm a los lados (los mismos de la
impresión), encabezado de congregación y dos semanas por página. Si una página no cabe, la letra y
los espacios se reducen parejo hasta que quepa.

## Cómo volver al método anterior (captura de pantalla)
En `Lista.tsx` poner la constante `PDF_VYM_VECTORIAL = false`. El método anterior sigue en el código
(solo se usa al publicar; el botón de descargar siempre usa el PDF dibujado) y también quedó en la
etiqueta git `pdf-vym-captura-v1`:

    git checkout pdf-vym-captura-v1 -- src/pages/vida-y-ministerio/Lista.tsx

## Qué cuidar al cambiar la hoja
La hoja impresa (`src/components/vida-ministerio/ImpresionVidaMinisterio.tsx`) y el modelo
(`vidaMinisterioFilas.ts`) calculan lo mismo por separado: horas encadenadas, duraciones por
defecto, orden de la visita del superintendente, partes de una sola persona ("¿Qué diría?",
discursos). Si se cambia una regla en uno, hay que cambiarla en el otro.

## Notas
- Los PDF ya publicados no cambian solos: hay que volver a publicar el mes para que quede dibujado.
- Reunión Pública, Asignaciones de servicio y el PDF publicado de Predicación siguen con el método
  anterior (captura), salvo el botón de descargar de Predicación, que ya es dibujado.
