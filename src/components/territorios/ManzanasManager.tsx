import { useState } from "react";
import { X, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ManzanaTerritorio } from "@/types/programa-predicacion";

interface ManzanasManagerProps {
  territorioId: string;
}

const LETRAS_DISPONIBLES = Array.from({ length: 15 }, (_, i) =>
  String.fromCharCode(65 + i)
); // A-O

export function ManzanasManager({ territorioId }: ManzanasManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: manzanas = [], isLoading } = useQuery({
    queryKey: ["manzanas", territorioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manzanas_territorio")
        .select("*")
        .eq("territorio_id", territorioId)
        .eq("activo", true)
        .order("letra");
      if (error) throw error;
      return data as ManzanaTerritorio[];
    },
  });

  const letrasSeleccionadas = manzanas.map((m) => m.letra);

  const handleToggleLetra = async (letra: string) => {
    const existe = manzanas.find((m) => m.letra === letra);

    try {
      if (existe) {
        const { error } = await supabase
          .from("manzanas_territorio")
          .update({ activo: false })
          .eq("id", existe.id);
        if (error) throw error;
        toast({ title: `Manzana ${letra} eliminada` });
      } else {
        const { error } = await supabase
          .from("manzanas_territorio")
          .insert({ territorio_id: territorioId, letra });
        if (error) throw error;
        toast({ title: `Manzana ${letra} agregada` });
      }
      queryClient.invalidateQueries({ queryKey: ["manzanas", territorioId] });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {manzanas.map((m) => (
          <Badge key={m.id} variant="secondary" className="gap-1 px-2 py-1">
            {m.letra}
            <button
              onClick={() => handleToggleLetra(m.letra)}
              className="ml-1 rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {manzanas.length === 0 && (
          <span className="text-sm text-muted-foreground">Sin manzanas</span>
        )}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <ChevronsUpDown className="h-4 w-4" />
            Seleccionar manzanas
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3 bg-popover" align="start">
          <div className="grid grid-cols-5 gap-2">
            {LETRAS_DISPONIBLES.map((letra) => {
              const isSelected = letrasSeleccionadas.includes(letra);
              return (
                <label
                  key={letra}
                  className="flex items-center justify-center gap-1 p-2 rounded-md border cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleLetra(letra)}
                  />
                  <span className="font-medium">{letra}</span>
                </label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
