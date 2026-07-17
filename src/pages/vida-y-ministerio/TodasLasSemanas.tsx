import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, ChevronLeft, ChevronRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import EditorVidaMinisterio from "./Editor";

export default function TodasLasSemanasVidaMinisterio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mesParam = searchParams.get("mes");
  const [mesActual, setMesActual] = useState<Date>(() =>
    mesParam ? startOfMonth(parseISO(mesParam)) : startOfMonth(new Date())
  );

  const irAMes = (nuevoMes: Date) => {
    setMesActual(nuevoMes);
    setSearchParams({ mes: format(nuevoMes, "yyyy-MM-dd") });
  };

  const lunesDelMes = useMemo(() => {
    const dias = eachDayOfInterval({
      start: startOfMonth(mesActual),
      end: endOfMonth(mesActual),
    });
    return dias.filter((d) => d.getDay() === 1);
  }, [mesActual]);

  const nombreMes = format(mesActual, "MMMM yyyy", { locale: es });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/vida-y-ministerio")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Volver
          </Button>
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Todas las semanas</h1>
              <p className="text-sm text-muted-foreground capitalize">{nombreMes}</p>
            </div>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-3 py-3">
          <Button variant="outline" size="sm" onClick={() => irAMes(subMonths(mesActual, 1))}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Mes anterior
          </Button>
          <div className="text-center">
            <div className="text-lg font-semibold capitalize">{nombreMes}</div>
            <button
              type="button"
              onClick={() => irAMes(startOfMonth(new Date()))}
              className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
            >
              Ir al mes actual
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => irAMes(addMonths(mesActual, 1))}>
            Mes siguiente
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {lunesDelMes.map((lunes) => {
          const fecha = format(lunes, "yyyy-MM-dd");
          return (
            <div key={fecha} className="shrink-0 w-[340px] border rounded-lg p-3">
              <EditorVidaMinisterio fecha={fecha} embedded />
            </div>
          );
        })}
        {lunesDelMes.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">No hay semanas en este mes.</p>
        )}
      </div>
    </div>
  );
}
