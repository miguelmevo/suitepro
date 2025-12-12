import { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ManzanaTerritorio } from "@/types/programa-predicacion";

interface ManzanasManagerProps {
  territorioId: string;
}

export function ManzanasManager({ territorioId }: ManzanasManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [nuevaLetra, setNuevaLetra] = useState("");
  const [adding, setAdding] = useState(false);

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

  const handleAddManzana = async () => {
    const letra = nuevaLetra.trim().toUpperCase();
    if (!letra) return;

    if (manzanas.some((m) => m.letra === letra)) {
      toast({ title: "La manzana ya existe", variant: "destructive" });
      return;
    }

    setAdding(true);
    try {
      const { error } = await supabase
        .from("manzanas_territorio")
        .insert({ territorio_id: territorioId, letra });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["manzanas", territorioId] });
      setNuevaLetra("");
      toast({ title: `Manzana ${letra} agregada` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveManzana = async (id: string, letra: string) => {
    try {
      const { error } = await supabase
        .from("manzanas_territorio")
        .update({ activo: false })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["manzanas", territorioId] });
      toast({ title: `Manzana ${letra} eliminada` });
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
              onClick={() => handleRemoveManzana(m.id, m.letra)}
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
      <div className="flex gap-2">
        <Input
          value={nuevaLetra}
          onChange={(e) => setNuevaLetra(e.target.value.slice(0, 3))}
          placeholder="Letra"
          className="w-20"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddManzana())}
        />
        <Button size="sm" onClick={handleAddManzana} disabled={adding || !nuevaLetra.trim()}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
