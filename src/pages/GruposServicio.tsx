import { useState } from "react";
import { Users, Loader2 } from "lucide-react";
import { useGruposServicio } from "@/hooks/useGruposServicio";
import { useParticipantes } from "@/hooks/useParticipantes";
import { GrupoCard } from "@/components/grupos-servicio/GrupoCard";
import { NuevoGrupoForm } from "@/components/grupos-servicio/NuevoGrupoForm";
import { NuevoParticipanteForm } from "@/components/grupos-servicio/NuevoParticipanteForm";
import { GrupoConMiembros } from "@/types/grupos-servicio";

export default function GruposServicio() {
  const {
    grupos,
    isLoading,
    crearGrupo,
    actualizarGrupo,
    eliminarGrupo,
    agregarMiembro,
    removerMiembro,
    toggleCapitan,
  } = useGruposServicio();

  const { crearParticipante } = useParticipantes();

  const [grupoEditar, setGrupoEditar] = useState<GrupoConMiembros | null>(null);
  const [editarOpen, setEditarOpen] = useState(false);

  const handleEditar = (grupo: GrupoConMiembros) => {
    setGrupoEditar(grupo);
    setEditarOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold">Grupos de Servicio</h1>
                <p className="text-sm text-muted-foreground">
                  Organiza y gestiona los grupos de predicación
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <NuevoParticipanteForm
                onCrear={(data) => crearParticipante.mutate(data)}
                isLoading={crearParticipante.isPending}
              />
              <NuevoGrupoForm
                onCrear={(data) => crearGrupo.mutate(data)}
                isLoading={crearGrupo.isPending}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : grupos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary mb-4">
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="font-display text-xl font-semibold mb-2">
              No hay grupos creados
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Comienza creando tu primer grupo de servicio para organizar a los
              publicadores en la predicación.
            </p>
            <NuevoGrupoForm
              onCrear={(data) => crearGrupo.mutate(data)}
              isLoading={crearGrupo.isPending}
            />
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.map((grupo) => (
              <GrupoCard
                key={grupo.id}
                grupo={grupo}
                onEliminar={(id) => eliminarGrupo.mutate(id)}
                onAgregarMiembro={(data) => agregarMiembro.mutate(data)}
                onRemoverMiembro={(data) => removerMiembro.mutate(data)}
                onToggleCapitan={(data) => toggleCapitan.mutate(data)}
                onEditar={handleEditar}
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal para editar grupo */}
      <NuevoGrupoForm
        onCrear={(data) => crearGrupo.mutate(data)}
        grupoEditar={grupoEditar}
        onActualizar={(data) => {
          actualizarGrupo.mutate(data);
          setGrupoEditar(null);
        }}
        open={editarOpen}
        onOpenChange={(open) => {
          setEditarOpen(open);
          if (!open) setGrupoEditar(null);
        }}
        isLoading={actualizarGrupo.isPending}
      />
    </div>
  );
}