import { Fragment } from "react";

/** Render mínimo de Markdown (títulos, párrafos, listas, tablas, negrita) para las páginas legales. */
function inline(texto: string, key: string | number) {
  const partes = texto.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Fragment key={key}>
      {partes.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>
      )}
    </Fragment>
  );
}

export function TextoLegal({ markdown }: { markdown: string }) {
  const lineas = markdown.split("\n");
  const bloques: React.ReactNode[] = [];
  let i = 0;
  while (i < lineas.length) {
    const l = lineas[i];
    if (!l.trim()) {
      i++;
      continue;
    }
    if (l.startsWith("# ")) {
      bloques.push(<h1 key={i} className="text-2xl font-bold mb-2">{l.slice(2)}</h1>);
      i++;
    } else if (l.startsWith("## ")) {
      bloques.push(<h2 key={i} className="text-lg font-semibold mt-6 mb-2">{l.slice(3)}</h2>);
      i++;
    } else if (l.startsWith("|")) {
      const filas: string[][] = [];
      while (i < lineas.length && lineas[i].startsWith("|")) {
        if (!/^\|[\s\-|]+\|$/.test(lineas[i])) filas.push(lineas[i].split("|").slice(1, -1).map((c) => c.trim()));
        i++;
      }
      bloques.push(
        <div key={i} className="overflow-x-auto my-3">
          <table className="w-full text-sm border">
            <thead>
              <tr>{filas[0].map((c, j) => <th key={j} className="border px-2 py-1 text-left bg-muted">{c}</th>)}</tr>
            </thead>
            <tbody>
              {filas.slice(1).map((f, r) => (
                <tr key={r}>{f.map((c, j) => <td key={j} className="border px-2 py-1 align-top">{inline(c, j)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    } else if (/^(- |\d+\. )/.test(l)) {
      const ordenada = /^\d+\. /.test(l);
      const items: string[] = [];
      while (i < lineas.length && /^(- |\d+\. )/.test(lineas[i])) {
        items.push(lineas[i].replace(/^(- |\d+\. )/, ""));
        i++;
      }
      const Tag = ordenada ? "ol" : "ul";
      bloques.push(
        <Tag key={i} className={`${ordenada ? "list-decimal" : "list-disc"} pl-6 space-y-1 my-2`}>
          {items.map((it, j) => <li key={j}>{inline(it, j)}</li>)}
        </Tag>
      );
    } else {
      bloques.push(<p key={i} className="my-2 leading-relaxed">{inline(l, i)}</p>);
      i++;
    }
  }
  return <div className="text-sm text-foreground">{bloques}</div>;
}
