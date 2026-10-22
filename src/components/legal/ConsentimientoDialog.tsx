import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuthContext } from "@/contexts/AuthProvider";
import { useConsentimiento } from "@/hooks/useConsentimiento";
import { estaImpersonando } from "@/lib/impersonacion";
import { VERSION_CONSENTIMIENTO } from "@/lib/consentimiento";

const CLAVE_POSPUESTO = "suitepro-consentimiento-pospuesto";

/** Identifica un inicio de sesión concreto: cada vez que se vuelve a entrar cambia. */
function marcaDeSesion(user: { id: string; last_sign_in_at?: string | null } | null): string {
  return `${VERSION_CONSENTIMIENTO}|${user?.id ?? ""}|${user?.last_sign_in_at ?? ""}`;
}

function pospuestoEnSesion(marca: string): boolean {
  try {
    return sessionStorage.getItem(CLAVE_POSPUESTO) === marca;
  } catch {
    return false;
  }
}

/**
 * Pide aceptar el tratamiento de datos al iniciar sesión. Con "consentimiento obligatorio"
 * activo en la congregación no se puede cerrar; si no, se puede dejar para después (vuelve a
 * aparecer en el siguiente inicio de sesión). No aparece mientras un administrador ve la app
 * como otro usuario: el consentimiento es personal.
 */
export function ConsentimientoDialog() {
  const { user, signOut } = useAuthContext();
  const { congregacionId, obligatorio, aceptado, cargando, aceptar } = useConsentimiento();
  const [edad, setEdad] = useState(false);
  const [terminos, setTerminos] = useState(false);
  const [autorizo, setAutorizo] = useState(false);
  const marca = marcaDeSesion(user);
  const [pospuestoMarca, setPospuestoMarca] = useState<string | null>(null);
  const pospuesto = pospuestoMarca === marca || pospuestoEnSesion(marca);

  if (!user || !congregacionId || cargando || aceptado || estaImpersonando()) return null;
  if (!obligatorio && pospuesto) return null;

  const posponer = () => {
    try {
      sessionStorage.setItem(CLAVE_POSPUESTO, marca);
    } catch {
      /* sin sessionStorage: se cierra solo en esta pantalla */
    }
    setPospuestoMarca(marca);
  };

  const confirmar = async () => {
    try {
      await aceptar.mutateAsync();
    } catch {
      toast.error("No se pudo guardar tu aceptación. Inténtalo de nuevo.");
    }
  };

  const todoMarcado = edad && terminos && autorizo;

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto && !obligatorio) posponer(); }}>
      <DialogContent
        className={`max-w-lg ${obligatorio ? "[&>button]:hidden" : ""}`}
        onPointerDownOutside={(e) => { if (obligatorio) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (obligatorio) e.preventDefault(); }}
      >
        <DialogHeader>
          <DialogTitle>Tratamiento de tus datos personales</DialogTitle>
          <DialogDescription>
            {obligatorio
              ? "Tu congregación requiere que aceptes lo siguiente para seguir usando SuitePro."
              : "Te pedimos que leas y aceptes lo siguiente. Puedes hacerlo ahora o más tarde."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={edad} onCheckedChange={(v) => setEdad(v === true)} className="mt-0.5" />
            <span>Declaro que tengo <strong>18 años o más</strong>.</span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={terminos} onCheckedChange={(v) => setTerminos(v === true)} className="mt-0.5" />
            <span>
              Acepto los{" "}
              <Link to="/terminos" target="_blank" className="text-primary underline">Términos de Uso</Link> y he leído la{" "}
              <Link to="/privacidad" target="_blank" className="text-primary underline">Política de Privacidad</Link>.
            </span>
          </label>
          <label className="flex items-start gap-3 cursor-pointer">
            <Checkbox checked={autorizo} onCheckedChange={(v) => setAutorizo(v === true)} className="mt-0.5" />
            <span>
              <strong>Autorizo</strong> que mi congregación y SuitePro traten mis datos personales para organizar los programas y
              asignaciones de la congregación. Entiendo que estos datos, como mi pertenencia a la congregación y mis responsabilidades,
              pueden relacionarse con mis creencias.
            </span>
          </label>
          <p className="text-xs text-muted-foreground">
            Puedes retirar tu autorización en cualquier momento desde Mi Cuenta o escribiendo a contacto@suitepro.org.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {obligatorio ? (
            <Button variant="outline" onClick={() => signOut()}>Cerrar sesión</Button>
          ) : (
            <Button variant="outline" onClick={posponer}>Ahora no</Button>
          )}
          <Button onClick={confirmar} disabled={!todoMarcado || aceptar.isPending}>
            {aceptar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Aceptar y continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
