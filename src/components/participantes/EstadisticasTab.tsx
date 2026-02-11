import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Shield,
  BookOpen,
  Star,
  UserX,
  Crown,
  Volume2,
  Video,
  Monitor,
  Mic,
  DoorOpen,
  Armchair,
  Layout,
  Wifi,
} from "lucide-react";
import type { Participante } from "@/hooks/useParticipantes";
import { useGruposServicio } from "@/hooks/useGruposServicio";

interface EstadisticaCard {
  label: string;
  abbr: string;
  count: number;
  icon: React.ReactNode;
  participantes: { nombre: string; apellido: string }[];
  color: string;
}

interface Props {
  participantes: Participante[];
}

export function EstadisticasTab({ participantes }: Props) {
  const { grupos: gruposServicio } = useGruposServicio();
  const [detalleModal, setDetalleModal] = useState<EstadisticaCard | null>(null);

  const activos = participantes.filter((p) => p.activo);

  // --- Principales ---
  const ancianos = activos.filter((p) =>
    p.responsabilidad?.includes("anciano")
  );
  const siervos = activos.filter((p) =>
    p.responsabilidad?.includes("siervo_ministerial")
  );
  const precursores = activos.filter((p) =>
    p.responsabilidad?.includes("precursor_regular")
  );
  const publicadores = activos.filter(
    (p) =>
      p.responsabilidad?.includes("publicador") &&
      !p.es_publicador_inactivo
  );
  const pubNoBautizados = activos.filter((p) =>
    p.responsabilidad?.includes("publicador_no_bautizado")
  );
  const pinList = activos.filter((p) => p.es_publicador_inactivo);

  const totalPublicadores =
    ancianos.length +
    siervos.length +
    precursores.length +
    publicadores.length +
    pubNoBautizados.length +
    pinList.length;

  const principales: EstadisticaCard[] = [
    {
      label: "Ancianos",
      abbr: "A",
      count: ancianos.length,
      icon: <Shield className="h-5 w-5" />,
      participantes: ancianos,
      color: "text-blue-600",
    },
    {
      label: "Siervos Ministeriales",
      abbr: "SM",
      count: siervos.length,
      icon: <BookOpen className="h-5 w-5" />,
      participantes: siervos,
      color: "text-indigo-600",
    },
    {
      label: "Precursores Regulares",
      abbr: "PR",
      count: precursores.length,
      icon: <Star className="h-5 w-5" />,
      participantes: precursores,
      color: "text-emerald-600",
    },
    {
      label: "Publicadores",
      abbr: "PB",
      count: publicadores.length,
      icon: <Users className="h-5 w-5" />,
      participantes: publicadores,
      color: "text-slate-600",
    },
    {
      label: "Publicadores No Bautizados",
      abbr: "PBN",
      count: pubNoBautizados.length,
      icon: <Users className="h-5 w-5" />,
      participantes: pubNoBautizados,
      color: "text-orange-600",
    },
    {
      label: "Publicadores Inactivos",
      abbr: "PIN",
      count: pinList.length,
      icon: <UserX className="h-5 w-5" />,
      participantes: pinList,
      color: "text-amber-600",
    },
  ];

  // --- Secundarias (Servicio) ---
  const capitanes = activos.filter((p) => p.es_capitan_grupo);

  // Map grupo servicio names to stats
  const servicioMapping: {
    keyword: string;
    label: string;
    icon: React.ReactNode;
    color: string;
  }[] = [
    { keyword: "audio", label: "Audio", icon: <Volume2 className="h-5 w-5" />, color: "text-purple-600" },
    { keyword: "zoom", label: "Zoom", icon: <Wifi className="h-5 w-5" />, color: "text-sky-600" },
    { keyword: "micr", label: "Micrófonos Pasillos", icon: <Mic className="h-5 w-5" />, color: "text-pink-600" },
    { keyword: "acomodador entrada", label: "Acomodador Entrada", icon: <DoorOpen className="h-5 w-5" />, color: "text-teal-600" },
    { keyword: "acomodador auditorio", label: "Acomodador Auditorio", icon: <Armchair className="h-5 w-5" />, color: "text-cyan-600" },
    { keyword: "video", label: "Video", icon: <Video className="h-5 w-5" />, color: "text-red-600" },
    { keyword: "plataforma", label: "Plataforma", icon: <Layout className="h-5 w-5" />, color: "text-violet-600" },
  ];

  const getGrupoMiembros = (keyword: string) => {
    const grupo = gruposServicio.find((g) =>
      g.nombre.toLowerCase().includes(keyword.toLowerCase())
    );
    if (!grupo) return [];
    return grupo.miembros
      .filter((m) => m.activo && m.participante)
      .map((m) => ({
        nombre: m.participante!.nombre,
        apellido: m.participante!.apellido,
      }));
  };

  const secundarias: EstadisticaCard[] = [
    {
      label: "Capitanes de Grupo",
      abbr: "CG",
      count: capitanes.length,
      icon: <Crown className="h-5 w-5" />,
      participantes: capitanes,
      color: "text-yellow-600",
    },
    ...servicioMapping.map((s) => {
      const miembros = getGrupoMiembros(s.keyword);
      return {
        label: s.label,
        abbr: s.label,
        count: miembros.length,
        icon: s.icon,
        participantes: miembros,
        color: s.color,
      };
    }),
  ];

  const renderCard = (stat: EstadisticaCard, size: "lg" | "sm" = "lg") => (
    <Card
      key={stat.label}
      className="cursor-pointer hover:shadow-md transition-shadow border"
      onClick={() => setDetalleModal(stat)}
    >
      <CardContent className={size === "lg" ? "p-5" : "p-4"}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {stat.label}
            </p>
            <p className={`${size === "lg" ? "text-3xl" : "text-2xl"} font-bold mt-1`}>
              {stat.count}
            </p>
          </div>
          <div className={`${stat.color} opacity-80`}>{stat.icon}</div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Total highlight */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium">
                Total Publicadores (activos)
              </p>
              <p className="text-4xl font-bold mt-1">{totalPublicadores}</p>
              <p className="text-xs text-muted-foreground mt-1">
                A + SM + PR + PB + PBN + PIN
              </p>
            </div>
            <Users className="h-8 w-8 text-primary opacity-60" />
          </div>
        </CardContent>
      </Card>

      {/* Principales */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Responsabilidades
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {principales.map((s) => renderCard(s))}
        </div>
      </div>

      {/* Secundarias */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Asignaciones de Servicio
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {secundarias.map((s) => renderCard(s, "sm"))}
        </div>
      </div>

      {/* Modal detalle */}
      <Dialog
        open={!!detalleModal}
        onOpenChange={(v) => !v && setDetalleModal(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detalleModal?.icon}
              {detalleModal?.label}
              <Badge variant="secondary" className="ml-auto">
                {detalleModal?.count}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Apellido</TableHead>
                  <TableHead>Nombre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalleModal?.participantes.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-center text-muted-foreground"
                    >
                      Sin participantes
                    </TableCell>
                  </TableRow>
                ) : (
                  detalleModal?.participantes
                    .sort((a, b) => {
                      const c = a.apellido.localeCompare(b.apellido);
                      return c !== 0 ? c : a.nombre.localeCompare(b.nombre);
                    })
                    .map((p, i) => (
                      <TableRow key={`${p.apellido}-${p.nombre}-${i}`}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium">
                          {p.apellido}
                        </TableCell>
                        <TableCell>{p.nombre}</TableCell>
                      </TableRow>
                    ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
