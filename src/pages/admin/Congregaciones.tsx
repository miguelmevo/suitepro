import { useState } from "react";
import { Building2, Plus, Pencil, Trash2, EyeOff, Copy, Check, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCongregaciones } from "@/hooks/useCongregaciones";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface UsuarioCongregacion {
  id: string;
  user_id: string;
  rol: string;
  activo: boolean;
  created_at: string;
  profile: {
    nombre: string | null;
    apellido: string | null;
    email: string;
  } | null;
}

export default function Congregaciones() {
  const { 
    congregaciones, 
    isLoading, 
    conteoUsuarios,
    obtenerUsuariosCongregacion,
    crearCongregacion, 
    actualizarCongregacion, 
    eliminarCongregacion 
  } = useCongregaciones();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nombre: "", slug: "", url_oculta: false });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Estado para modal de usuarios
  const [usuariosModalOpen, setUsuariosModalOpen] = useState(false);
  const [usuariosCongregacion, setUsuariosCongregacion] = useState<UsuarioCongregacion[]>([]);
  const [congregacionSeleccionada, setCongregacionSeleccionada] = useState<string>("");
  const [cargandoUsuarios, setCargandoUsuarios] = useState(false);

  const buildAuthUrl = (slug: string) => {
    const url = new URL("/auth", window.location.origin);
    url.searchParams.set("slug", slug);
    return url.toString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre.trim()) return;

    if (editando) {
      await actualizarCongregacion.mutateAsync({
        id: editando,
        nombre: formData.nombre,
        slug: formData.slug,
        url_oculta: formData.url_oculta,
      });
    } else {
      await crearCongregacion.mutateAsync({
        nombre: formData.nombre,
        slug: formData.url_oculta ? undefined : formData.slug,
        url_oculta: formData.url_oculta,
      });
    }

    setDialogOpen(false);
    setEditando(null);
    setFormData({ nombre: "", slug: "", url_oculta: false });
  };

  const handleEditar = (congregacion: { id: string; nombre: string; slug: string; url_oculta: boolean }) => {
    setEditando(congregacion.id);
    setFormData({ 
      nombre: congregacion.nombre, 
      slug: congregacion.slug,
      url_oculta: congregacion.url_oculta 
    });
    setDialogOpen(true);
  };

  const handleEliminar = async (id: string) => {
    await eliminarCongregacion.mutateAsync(id);
  };

  const handleNombreChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nombre = e.target.value;
    // Auto-generar slug si no estamos editando y no es URL oculta
    if (!editando && !formData.url_oculta) {
      const slug = nombre.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormData({ ...formData, nombre, slug });
    } else {
      setFormData({ ...formData, nombre });
    }
  };

  const handleCopyUrl = async (slug: string, id: string) => {
    const url = buildAuthUrl(slug);
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success("URL copiada al portapapeles");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerUsuarios = async (congregacionId: string, congregacionNombre: string) => {
    setCargandoUsuarios(true);
    setCongregacionSeleccionada(congregacionNombre);
    setUsuariosModalOpen(true);
    
    try {
      const usuarios = await obtenerUsuariosCongregacion(congregacionId);
      setUsuariosCongregacion(usuarios);
    } catch (error) {
      console.error("Error al obtener usuarios:", error);
      toast.error("Error al cargar usuarios");
    } finally {
      setCargandoUsuarios(false);
    }
  };

  const getRolLabel = (rol: string) => {
    const roles: Record<string, string> = {
      admin: "Administrador",
      editor: "Editor",
      user: "Usuario",
      super_admin: "Super Admin",
    };
    return roles[rol] || rol;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Congregaciones</h1>
          <p className="text-muted-foreground">
            Administra las congregaciones registradas en el sistema
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditando(null);
            setFormData({ nombre: "", slug: "", url_oculta: false });
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Congregación
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editando ? "Editar Congregación" : "Nueva Congregación"}
                </DialogTitle>
                <DialogDescription>
                  {editando 
                    ? "Modifica los datos de la congregación"
                    : "Crea una nueva congregación. Serás asignado como administrador automáticamente."
                  }
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre de la Congregación</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={handleNombreChange}
                    placeholder="Ej: Villa Real"
                    required
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="url_oculta" className="text-base">URL Privada</Label>
                    <p className="text-sm text-muted-foreground">
                      Genera un identificador aleatorio en lugar del nombre de la congregación
                    </p>
                  </div>
                  <Switch
                    id="url_oculta"
                    checked={formData.url_oculta}
                    onCheckedChange={(checked) => setFormData({ ...formData, url_oculta: checked })}
                    disabled={!!editando}
                  />
                </div>

                {!formData.url_oculta && (
                  <div className="space-y-2">
                    <Label htmlFor="slug">Identificador (slug)</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      placeholder="Ej: villa-real"
                      pattern="[a-z0-9-]+"
                      title="Solo letras minúsculas, números y guiones"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tu URL será: <span className="font-medium">{buildAuthUrl(formData.slug || "tu-slug")}</span>
                    </p>
                  </div>
                )}

                {formData.url_oculta && !editando && (
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-sm text-muted-foreground">
                      <EyeOff className="h-4 w-4 inline-block mr-2" />
                      Se generará una URL privada tipo: <span className="font-mono">{buildAuthUrl("abc123xyz")}</span>
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={crearCongregacion.isPending || actualizarCongregacion.isPending}
                >
                  {editando ? "Guardar Cambios" : "Crear Congregación"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Modal de usuarios */}
      <Dialog open={usuariosModalOpen} onOpenChange={setUsuariosModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios de {congregacionSeleccionada}
            </DialogTitle>
            <DialogDescription>
              Lista de usuarios registrados en esta congregación
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {cargandoUsuarios ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : usuariosCongregacion.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No hay usuarios en esta congregación
              </p>
            ) : (
              <div className="space-y-2">
                {usuariosCongregacion.map((usuario) => (
                  <div 
                    key={usuario.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {usuario.profile?.nombre || ""} {usuario.profile?.apellido || ""}
                        {!usuario.profile?.nombre && !usuario.profile?.apellido && (
                          <span className="text-muted-foreground italic">Sin nombre</span>
                        )}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {usuario.profile?.email || "Sin email"}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 shrink-0">
                      {getRolLabel(usuario.rol)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : congregaciones.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No hay congregaciones</h3>
            <p className="text-muted-foreground text-center mb-4">
              Crea tu primera congregación para comenzar a usar el sistema
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Congregación
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {congregaciones.map((congregacion) => (
            <Card key={congregacion.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{congregacion.nombre}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {congregacion.url_oculta && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className="gap-1">
                              <EyeOff className="h-3 w-3" />
                              Privada
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>URL privada/encriptada</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <Badge variant={congregacion.activo ? "default" : "secondary"}>
                      {congregacion.activo ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="font-mono text-xs">{buildAuthUrl(congregacion.slug)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopyUrl(congregacion.slug, congregacion.id)}
                  >
                    {copiedId === congregacion.id ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Contador de usuarios clicable */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => handleVerUsuarios(congregacion.id, congregacion.nombre)}
                  >
                    <Users className="h-4 w-4" />
                    <span>{conteoUsuarios[congregacion.id] || 0} usuarios</span>
                  </Button>
                  
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Creada: {format(new Date(congregacion.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditar(congregacion)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>¿Eliminar congregación?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta acción no se puede deshacer. Se eliminará la congregación "{congregacion.nombre}" 
                              y todos sus datos asociados (usuarios, configuraciones, programas, etc.).
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleEliminar(congregacion.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Eliminar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
