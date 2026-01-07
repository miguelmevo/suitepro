import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Normaliza rutas con doble "//" (ej: "/" + "/auth") antes de que React Router inicialice.
// Esto evita 404 internos y, sobre todo, que se pierda el query param ?slug.
(() => {
  const { pathname, search, hash } = window.location;
  const normalizedPathname = pathname.replace(/\/{2,}/g, "/");
  if (normalizedPathname !== pathname) {
    window.history.replaceState(null, "", `${normalizedPathname}${search}${hash}`);
  }
})();

createRoot(document.getElementById("root")!).render(<App />);

