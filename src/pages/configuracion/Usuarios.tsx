import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useCongregacion } from "@/contexts/CongregacionContext";
import { AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  SortableTableHead,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTableSort } from "@/hooks/useTableSort";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Shield, UserCog, UserCheck, UserX, Clock, Trash2, AlertTriangle, KeyRound } from "lucide-react";
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface UserWithRoles {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
  aprobado: boolean;
  fecha_aprobacion: string | null;
  roles: AppRole[];
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Administrador",
  editor: "Editor",
  viewer: "Visualizador",
  user: "Usuario",
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: "bg-amber-600 text-white",
  admin: "bg-destructive text-destructive-foreground",
  editor: "bg-primary text-primary-foreground",
  viewer: "bg-blue-500 text-white",
  user: "bg-muted text-muted-foreground",
};

export default function Usuarios() {
  const { isAdmin, isSuperAdmin, user: currentUser, roles } = useAuthContext();
  const { congregacionActual } = useCongregacion();
  const congregacionId = congregacionActual?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [orphanEmail, setOrphanEmail] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("user");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pendientes");

  const currentUserIsSuperAdmin = isSuperAdmin();

  // Verificar si es admin de esta congregación específica o super_admin
  const { data: isCongregationAdmin = false, isLoading: loadingAdminCheck } = useQuery({
    queryKey: ["is-congregation-admin", congregacionId, currentUserIsSuperAdmin],
    queryFn: async () => {
      // super_admin tiene acceso a todo
      if (currentUserIsSuperAdmin) return true;
      
      if (!congregacionId || !currentUser?.id) return false;
      const { data } = await supabase
        .from("usuarios_congregacion")
        .select("rol")
        .eq("user_id", currentUser.id)
        .eq("congregacion_id", congregacionId)
        .eq("activo", true)
        .single();
      return data?.rol === "admin";
    },
    enabled: !!congregacionId && !!currentUser?.id,
  });

  // Obtener usuarios de esta congregación específica
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users", congregacionId],
    queryFn: async (): Promise<UserWithRoles[]> => {
      if (!congregacionId) return [];
      
      // Obtener los user_ids de esta congregación
      const { data: congUsers, error: congError } = await supabase
        .from("usuarios_congregacion")
        .select("user_id, rol")
        .eq("congregacion_id", congregacionId)
        .eq("activo", true);
      
      if (congError) throw congError;
      
      const userIds = congUsers?.map(u => u.user_id) || [];
      if (userIds.length === 0) return [];
      
      // Obtener perfiles de esos usuarios
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", userIds)
        .order("nombre");

      if (profilesError) throw profilesError;

      // Mapear con los roles de la congregación (no globales)
      const mappedUsers = profiles.map((profile) => {
        const congUser = congUsers?.find(u => u.user_id === profile.id);
        return {
          ...profile,
          roles: congUser?.rol ? [congUser.rol as AppRole] : [],
        };
      });

      // Filtrar super_admin de la lista si el usuario actual NO es super_admin
      if (!currentUserIsSuperAdmin) {
        return mappedUsers.filter(u => !u.roles.includes("super_admin"));
      }
      
      return mappedUsers;
    },
    enabled: isCongregationAdmin && !!congregacionId,
  });

  const approveUser = useMutation({
    mutationFn: async ({ userId, role, userEmail, userName, userApellido }: { 
      userId: string; 
      role: AppRole;
      userEmail: string;
      userName: string;
      userApellido: string;
    }) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      
      // Aprobar usuario
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          aprobado: true,
          fecha_aprobacion: new Date().toISOString(),
          aprobado_por: currentUser?.id,
        })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Actualizar rol en usuarios_congregacion (el registro ya existe)
      const { error: roleError } = await supabase
        .from("usuarios_congregacion")
        .update({ 
          rol: role,
          activo: true,
        })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);

      if (roleError) throw roleError;

      // Notificar al usuario por email
      try {
        await supabase.functions.invoke("notify-user-approved", {
          body: {
            userEmail,
            userName,
            userApellido,
            rolAsignado: role,
            congregacionNombre: congregacionActual?.nombre || "SuitePro",
          },
        });
      } catch (notifyError) {
        console.error("Error sending approval notification:", notifyError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", congregacionId] });
      toast({
        title: "Usuario aprobado",
        description: "El usuario ha sido aprobado y notificado por correo.",
      });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejectUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      
      // Usar edge function que elimina la membresía y, si queda huérfano, borra de auth.users
      const { data, error } = await supabase.functions.invoke("delete-user-complete", {
        body: { userId, congregacionId },
      });
      
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Usuario rechazado",
        description: "El usuario ha sido eliminado del sistema.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: AppRole;
      action: "add" | "remove";
    }) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      
      // Actualizar el rol en usuarios_congregacion
      const { error } = await supabase
        .from("usuarios_congregacion")
        .update({ rol: role })
        .eq("user_id", userId)
        .eq("congregacion_id", congregacionId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", congregacionId] });
      toast({
        title: "Rol actualizado",
        description: "El rol ha sido actualizado exitosamente.",
      });
      setIsDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      
      // Usar edge function que elimina la membresía y, si queda huérfano, borra de auth.users
      const { data, error } = await supabase.functions.invoke("delete-user-complete", {
        body: { userId, congregacionId },
      });
      
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      
      return data;
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users", congregacionId] });
      const wasDeletedCompletely = (_data as any)?.deletedCompletely;
      toast({
        title: "Usuario removido",
        description: wasDeletedCompletely 
          ? "El usuario ha sido eliminado completamente del sistema."
          : "El usuario ha sido removido de esta congregación.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Query para usuarios huérfanos (solo super_admin)
  const { data: orphanUsers = [], isLoading: loadingOrphans, refetch: refetchOrphans } = useQuery({
    queryKey: ["orphan-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_orphan_users");
      if (error) throw error;
      return data || [];
    },
    enabled: currentUserIsSuperAdmin,
  });

  const deleteOrphanUser = useMutation({
    mutationFn: async (payload: { userId?: string; email?: string }) => {
      const { data, error } = await supabase.functions.invoke("delete-orphan-user", {
        body: payload,
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
    },
    onSuccess: () => {
      refetchOrphans();
      toast({
        title: "Usuario eliminado",
        description: "El usuario huérfano ha sido eliminado del sistema.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async ({ userId, userEmail }: { userId: string; userEmail: string }) => {
      if (!congregacionId) throw new Error("No hay congregación seleccionada");
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId, congregacionId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "Correo enviado",
        description: `Se envió un enlace de restablecimiento de contraseña a ${variables.userEmail}.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const pendingUsers = users.filter((user) => !user.aprobado);
  const approvedUsers = users.filter((user) => user.aprobado);

  const filteredPendingUsers = pendingUsers.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.apellido?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredApprovedUsers = approvedUsers.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.apellido?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const { sortedData: sortedPending, sortConfig: pendingSortConfig, requestSort: pendingRequestSort } = useTableSort(filteredPendingUsers, { key: "apellido", direction: "asc" });
  const { sortedData: sortedApproved, sortConfig: approvedSortConfig, requestSort: approvedRequestSort } = useTableSort(filteredApprovedUsers, { key: "apellido", direction: "asc" });
  const { sortedData: sortedOrphans, sortConfig: orphanSortConfig, requestSort: orphanRequestSort } = useTableSort(orphanUsers, { key: "apellido", direction: "asc" });

  const handleApproveUser = (user: UserWithRoles) => {
    setSelectedUser(user);
    setNewRole("user");
    setIsDialogOpen(true);
  };

  const handleConfirmApproval = () => {
    if (selectedUser && newRole) {
      approveUser.mutate({
        userId: selectedUser.id,
        role: newRole,
        userEmail: selectedUser.email,
        userName: selectedUser.nombre || "",
        userApellido: selectedUser.apellido || "",
      });
    }
  };

  const handleManageRoles = (user: UserWithRoles) => {
    setSelectedUser(user);
    setNewRole("user");
    setIsDialogOpen(true);
  };

  const handleUpdateRole = () => {
    if (selectedUser && newRole) {
      updateRole.mutate({
        userId: selectedUser.id,
        role: newRole,
        action: "add", // kept for type compatibility
      });
    }
  };

  if (loadingAdminCheck) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!isCongregationAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No tienes permisos para administrar usuarios de esta congregación.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <UserCog className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Administración de Usuarios</h1>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nombre o correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="pendientes" className="gap-2">
            <Clock className="h-4 w-4" />
            Pendientes ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="aprobados" className="gap-2">
            <UserCheck className="h-4 w-4" />
            Aprobados ({approvedUsers.length})
          </TabsTrigger>
          {currentUserIsSuperAdmin && (
            <TabsTrigger value="huerfanos" className="gap-2">
              <AlertTriangle className="h-4 w-4" />
              Huérfanos ({orphanUsers.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="pendientes">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios Pendientes de Aprobación</CardTitle>
              <CardDescription>
                Aprueba o rechaza las solicitudes de nuevos usuarios
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : sortedPending.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay usuarios pendientes de aprobación
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="apellido" currentSort={pendingSortConfig} onSort={pendingRequestSort}>Nombre</SortableTableHead>
                      <SortableTableHead sortKey="email" currentSort={pendingSortConfig} onSort={pendingRequestSort}>Correo</SortableTableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPending.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          {user.apellido}, {user.nombre}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApproveUser(user)}
                            className="gap-1"
                          >
                            <UserCheck className="h-4 w-4" />
                            Aprobar
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => rejectUser.mutate(user.id)}
                            disabled={rejectUser.isPending}
                            className="gap-1"
                          >
                            <UserX className="h-4 w-4" />
                            Rechazar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aprobados">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios Aprobados</CardTitle>
              <CardDescription>Gestiona los roles y permisos de los usuarios</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead sortKey="apellido" currentSort={approvedSortConfig} onSort={approvedRequestSort}>Nombre</SortableTableHead>
                      <SortableTableHead sortKey="email" currentSort={approvedSortConfig} onSort={approvedRequestSort}>Correo</SortableTableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedApproved.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          {user.apellido}, {user.nombre}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.map((role) => (
                              <Badge key={role} className={ROLE_COLORS[role]}>
                                {ROLE_LABELS[role]}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageRoles(user)}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Roles
                          </Button>
                          {user.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resetUserPassword.mutate({ userId: user.id, userEmail: user.email })}
                              disabled={resetUserPassword.isPending}
                              title="Enviar correo para restablecer contraseña"
                            >
                              <KeyRound className="h-4 w-4" />
                            </Button>
                          )}
                          {user.id !== currentUser?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará permanentemente a {user.apellido}, {user.nombre} ({user.email}) del sistema.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteUser.mutate(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {currentUserIsSuperAdmin && (
          <TabsContent value="huerfanos">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  Usuarios Huérfanos
                </CardTitle>
                <CardDescription>
                  Usuarios que se registraron pero no quedaron asociados a ninguna congregación.
                  Puedes eliminarlos permanentemente del sistema.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOrphans ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : sortedOrphans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No hay usuarios huérfanos en el sistema
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <SortableTableHead sortKey="apellido" currentSort={orphanSortConfig} onSort={orphanRequestSort}>Nombre</SortableTableHead>
                        <SortableTableHead sortKey="email" currentSort={orphanSortConfig} onSort={orphanRequestSort}>Correo</SortableTableHead>
                        <SortableTableHead sortKey="created_at" currentSort={orphanSortConfig} onSort={orphanRequestSort}>Fecha de registro</SortableTableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedOrphans.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            {user.apellido || ""}{user.apellido && user.nombre ? ", " : ""}{user.nombre || "—"}
                          </TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            {format(new Date(user.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                          </TableCell>
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="gap-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Eliminar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar usuario huérfano?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Esta acción eliminará permanentemente a <strong>{user.email}</strong> del sistema.
                                    Esta acción no se puede deshacer.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOrphanUser.mutate(user.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Eliminar permanentemente
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.aprobado ? "Gestionar roles" : "Aprobar usuario"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.apellido}, {selectedUser?.nombre} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>

          {selectedUser?.aprobado ? (
            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Rol actual</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedUser?.roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin rol asignado</p>
                  ) : (
                    selectedUser?.roles.map((role) => (
                      <Badge key={role} className={ROLE_COLORS[role]}>
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Cambiar rol</h4>
                <div className="flex gap-2">
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "editor", "viewer", "user"] as AppRole[]).map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleUpdateRole}
                    disabled={!newRole || updateRole.isPending}
                  >
                    {updateRole.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Selecciona el rol que deseas asignar a este usuario:
              </p>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "editor", "viewer", "user"] as AppRole[]).map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancelar
            </Button>
            {!selectedUser?.aprobado && (
              <Button
                onClick={handleConfirmApproval}
                disabled={!newRole || approveUser.isPending}
              >
                {approveUser.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Aprobar y Asignar Rol
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}