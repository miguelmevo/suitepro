import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Search, Users, LogOut, Shield } from "lucide-react";
import { Loader2 } from "lucide-react";

interface CongregacionConUsuarios {
  id: string;
  nombre: string;
  slug: string;
  activo: boolean;
  usuariosCount: number;
}

interface SeleccionCongregacionProps {
  onSelect: (congregacionId: string) => void;
}

export default function SeleccionCongregacion({ onSelect }: SeleccionCongregacionProps) {
  const { signOut, profile } = useAuthContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Fetch all congregations for super_admin
  const { data: congregaciones = [], isLoading } = useQuery({
    queryKey: ["all-congregaciones-super-admin"],
    queryFn: async (): Promise<CongregacionConUsuarios[]> => {
      const { data: congregacionesData, error } = await supabase
        .from("congregaciones")
        .select("*")
        .eq("activo", true)
        .order("nombre");

      if (error) throw error;

      // Get user counts for each congregation
      const congregacionesConUsuarios = await Promise.all(
        (congregacionesData || []).map(async (cong) => {
          const { count } = await supabase
            .from("usuarios_congregacion")
            .select("*", { count: "exact", head: true })
            .eq("congregacion_id", cong.id)
            .eq("activo", true);

          return {
            ...cong,
            usuariosCount: count || 0,
          };
        })
      );

      return congregacionesConUsuarios;
    },
  });

  const filteredCongregaciones = congregaciones.filter(
    (cong) =>
      cong.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cong.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Panel Super Administrador</CardTitle>
          <CardDescription>
            Bienvenido, {profile?.nombre || "Administrador"}. Selecciona una congregación para administrar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar congregación..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {filteredCongregaciones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm
                    ? "No se encontraron congregaciones con ese nombre"
                    : "No hay congregaciones disponibles"}
                </div>
              ) : (
                filteredCongregaciones.map((cong) => (
                  <Button
                    key={cong.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-4 px-4 hover:bg-primary/5 hover:border-primary/50 transition-colors"
                    onClick={() => onSelect(cong.id)}
                  >
                    <div className="flex items-center gap-4 w-full">
                      <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{cong.nombre}</div>
                        <div className="text-sm text-muted-foreground">/{cong.slug}</div>
                      </div>
                      <Badge variant="secondary" className="gap-1">
                        <Users className="h-3 w-3" />
                        {cong.usuariosCount}
                      </Badge>
                    </div>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <LogOut className="h-4 w-4 mr-2" />
              )}
              Cerrar sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
