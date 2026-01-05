import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Loader2, Search, Shield, UserCog, UserCheck, UserX, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  admin: "Administrador",
  editor: "Editor",
  user: "Usuario",
};

const ROLE_COLORS: Record<AppRole, string> = {
  admin: "bg-destructive text-destructive-foreground",
  editor: "bg-primary text-primary-foreground",
  user: "bg-muted text-muted-foreground",
};

export default function Usuarios() {
  const { isAdmin, user: currentUser } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("user");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pendientes");

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserWithRoles[]> => {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("nombre");

      if (profilesError) throw profilesError;

      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      return profiles.map((profile) => ({
        ...profile,
        roles: rolesData
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
      }));
    },
    enabled: isAdmin(),
  });

  const approveUser = useMutation({
    mutationFn: async ({ userId, role, userEmail, userName, userApellido }: { 
      userId: string; 
      role: AppRole;
      userEmail: string;
      userName: string;
      userApellido: string;
    }) => {
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

      // Asignar rol
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });

      if (roleError) throw roleError;

      // Notificar al usuario por email
      try {
        await supabase.functions.invoke("notify-user-approved", {
          body: {
            userEmail,
            userName,
            userApellido,
            rolAsignado: role,
            congregacionNombre: "SuitePro", // Por ahora usamos nombre genérico
          },
        });
      } catch (notifyError) {
        console.error("Error sending approval notification:", notifyError);
        // Don't fail the approval if notification fails
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
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
      // Eliminar el perfil (esto también eliminará el usuario de auth por cascade)
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("id", userId);

      if (error) throw error;
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
      action,
    }: {
      userId: string;
      role: AppRole;
      action: "add" | "remove";
    }) => {
      if (action === "add") {
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", role);
        if (error) throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: variables.action === "add" ? "Rol agregado" : "Rol removido",
        description: `El rol ha sido ${variables.action === "add" ? "agregado" : "removido"} exitosamente.`,
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

  const handleAddRole = () => {
    if (selectedUser && newRole) {
      updateRole.mutate({
        userId: selectedUser.id,
        role: newRole,
        action: "add",
      });
    }
  };

  const handleRemoveRole = (role: AppRole) => {
    if (selectedUser) {
      updateRole.mutate({
        userId: selectedUser.id,
        role,
        action: "remove",
      });
    }
  };

  if (!isAdmin()) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No tienes permisos para acceder a esta página.</p>
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
              ) : filteredPendingUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay usuarios pendientes de aprobación
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPendingUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          {user.nombre} {user.apellido}
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
                      <TableHead>Nombre</TableHead>
                      <TableHead>Correo</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredApprovedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          {user.nombre} {user.apellido}
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
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleManageRoles(user)}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            Roles
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
      </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedUser?.aprobado ? "Gestionar roles" : "Aprobar usuario"}
            </DialogTitle>
            <DialogDescription>
              {selectedUser?.nombre} {selectedUser?.apellido} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>

          {selectedUser?.aprobado ? (
            // Diálogo para gestionar roles de usuarios aprobados
            <div className="space-y-4 py-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Roles actuales</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedUser?.roles.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin roles asignados</p>
                  ) : (
                    selectedUser?.roles.map((role) => (
                      <Badge
                        key={role}
                        className={`${ROLE_COLORS[role]} cursor-pointer`}
                        onClick={() => handleRemoveRole(role)}
                      >
                        {ROLE_LABELS[role]} ×
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Agregar rol</h4>
                <div className="flex gap-2">
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["admin", "editor", "user"] as AppRole[])
                        .filter((role) => !selectedUser?.roles.includes(role))
                        .map((role) => (
                          <SelectItem key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleAddRole}
                    disabled={
                      !newRole ||
                      selectedUser?.roles.includes(newRole) ||
                      updateRole.isPending
                    }
                  >
                    {updateRole.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Agregar"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Diálogo para aprobar nuevos usuarios
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Selecciona el rol que deseas asignar a este usuario:
              </p>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["admin", "editor", "user"] as AppRole[]).map((role) => (
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