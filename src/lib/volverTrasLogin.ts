const CLAVE = "suitepro.volver_tras_login";

/** Guarda la página a la que hay que volver después de iniciar sesión. */
export function recordarVolverTrasLogin(ruta: string) {
  try {
    sessionStorage.setItem(CLAVE, ruta);
  } catch {
    /* sin almacenamiento: se vuelve al inicio */
  }
}

/** Devuelve (y olvida) la página guardada; sólo rutas internas. */
export function tomarVolverTrasLogin(): string | null {
  try {
    const ruta = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return ruta && ruta.startsWith("/") && !ruta.startsWith("//") ? ruta : null;
  } catch {
    return null;
  }
}
