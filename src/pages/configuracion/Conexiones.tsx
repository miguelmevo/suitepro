import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, History, Wifi, Clock, MapPin, Monitor } from 'lucide-react';
import { useUserPresence } from '@/hooks/useUserPresence';
import { formatDistanceToNow, format } from 'date-fns';
import { es } from 'date-fns/locale';

const pageNames: Record<string, string> = {
  '/': 'Inicio',
  '/predicacion/programa': 'Programa de Predicación',
  '/predicacion/territorios': 'Territorios',
  '/predicacion/historial': 'Historial',
  '/predicacion/puntos-encuentro': 'Puntos de Encuentro',
  '/grupos-servicio': 'Grupos de Servicio',
  '/programas-del-mes': 'Programas del Mes',
  '/configuracion/participantes': 'Participantes',
  '/configuracion/grupos-predicacion': 'Grupos de Predicación',
  '/configuracion/usuarios': 'Usuarios',
  '/configuracion/ajustes': 'Ajustes del Sistema',
  '/configuracion/indisponibilidad': 'Indisponibilidad General',
  '/configuracion/mi-cuenta': 'Mi Cuenta',
  '/configuracion/conexiones': 'Conexiones'
};

const getPageName = (path: string | null): string => {
  if (!path) return 'Desconocida';
  return pageNames[path] || path;
};

export default function Conexiones() {
  const { usuariosConectados, historialSesiones, loadingPresence, loadingHistorial } = useUserPresence();
  const [activeTab, setActiveTab] = useState('conectados');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Wifi className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Conexiones del Sistema</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="conectados" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Conectados
            {usuariosConectados.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {usuariosConectados.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historial" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Historial
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conectados" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
                Usuarios Conectados Ahora
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPresence ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando...
                </div>
              ) : usuariosConectados.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay usuarios conectados en este momento
                </div>
              ) : (
                <div className="space-y-3">
                  {usuariosConectados.map((usuario) => (
                    <div
                      key={usuario.id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary">
                              {(usuario.nombre_completo || usuario.email).charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {usuario.nombre_completo || usuario.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {usuario.email}
                          </p>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span>{getPageName(usuario.current_page)}</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground mt-1">
                          <Clock className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(usuario.last_seen), {
                              addSuffix: true,
                              locale: es
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historial" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Historial de Accesos</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingHistorial ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cargando...
                </div>
              ) : historialSesiones.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No hay registros de acceso
                </div>
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {historialSesiones.map((sesion) => (
                      <div
                        key={sesion.id}
                        className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                            <Monitor className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {sesion.nombre_completo || sesion.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {sesion.email}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {format(new Date(sesion.fecha_login), 'dd/MM/yyyy', { locale: es })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(sesion.fecha_login), 'HH:mm', { locale: es })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
