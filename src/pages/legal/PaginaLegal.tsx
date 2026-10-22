import { Link } from "react-router-dom";
import { TextoLegal } from "@/components/legal/TextoLegal";
import politica from "@/content/legal/politica-privacidad.md?raw";
import terminos from "@/content/legal/terminos-de-uso.md?raw";

export function PaginaLegal({ tipo }: { tipo: "privacidad" | "terminos" }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex gap-4 text-sm mb-6">
          <Link to="/" className="text-primary hover:underline">← Volver a SuitePro</Link>
          <Link to="/privacidad" className="text-muted-foreground hover:underline">Política de Privacidad</Link>
          <Link to="/terminos" className="text-muted-foreground hover:underline">Términos de Uso</Link>
        </div>
        <TextoLegal markdown={tipo === "privacidad" ? politica : terminos} />
      </div>
    </div>
  );
}
