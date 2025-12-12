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
import { Loader2, Search, Shield, UserCog } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface UserWithRoles {
  id: string;
  email: string;
  nombre: string | null;
  apellido: string | null;
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
  const { isAdmin } = useAuthContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserWithRoles | null>(null);
  const [newRole, setNewRole] = useState<AppRole>("user");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async (): Promise<UserWithRoles[]> => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("nombre");

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: rolesData, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to users
      return profiles.map((profile) => ({
        ...profile,
        roles: rolesData
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role as AppRole),
      }));
    },
    enabled: isAdmin(),
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

  const filteredUsers = users.filter(
    (user) =>
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.apellido?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

      <Card>
        <CardHeader>
          <CardTitle>Usuarios registrados</CardTitle>
          <CardDescription>Gestiona los roles y permisos de los usuarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>

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
                {filteredUsers.map((user) => (
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar roles</DialogTitle>
            <DialogDescription>
              {selectedUser?.nombre} {selectedUser?.apellido} ({selectedUser?.email})
            </DialogDescription>
          </DialogHeader>

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

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
