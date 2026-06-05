// Service Worker registration wrapper with safety guards.
// - Never registers in dev, Lovable preview iframes, or with ?sw=off
// - Activates new versions immediately (skipWaiting + clientsClaim in SW)
// - Auto-reloads the page once when a new SW takes control

const SW_URL = "/sw.js";

function isUnsafeHost(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  if (new URLSearchParams(window.location.search).has("sw") && new URLSearchParams(window.location.search).get("sw") === "off") return true;
  return false;
}

async function unregisterMatching() {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return url.endsWith(SW_URL);
      })
      .map((r) => r.unregister()),
  );
}

export async function registerPwa() {
  if (!("serviceWorker" in navigator)) return;

  if (isUnsafeHost()) {
    await unregisterMatching().catch(() => {});
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register(SW_URL, { scope: "/" });

    // When the controller changes (new SW took over), reload once.
    let hasReloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (hasReloaded) return;
      hasReloaded = true;
      window.location.reload();
    });

    // If there's already a waiting worker on load, tell it to activate.
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          installing.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    // Check for updates periodically (every 60s) while tab is open.
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60_000);
  } catch {
    // ignore
  }
}
