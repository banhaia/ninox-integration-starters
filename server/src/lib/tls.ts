import tls from "node:tls";

/**
 * Suma los certificados raíz del sistema operativo a los que trae Node.
 *
 * Así una API con certificado de desarrollo confiado en el SO (por ejemplo IIS Express o
 * `dotnet dev-certs https --trust` en https://localhost) o un proxy corporativo funciona
 * sin desactivar la verificación TLS. Se puede desactivar con NINOX_USE_SYSTEM_CA=false.
 */
export function trustSystemCertificates(): void {
  if (process.env.NINOX_USE_SYSTEM_CA?.trim().toLowerCase() === "false") return;

  if (typeof tls.setDefaultCACertificates !== "function" || typeof tls.getCACertificates !== "function") {
    console.warn("[tls] Esta versión de Node no permite usar los certificados del sistema. Actualizá a Node 22.19+ o 24.5+.");
    return;
  }

  try {
    const system = tls.getCACertificates("system");
    tls.setDefaultCACertificates([...tls.getCACertificates("default"), ...system]);
  } catch (error) {
    console.warn("[tls] No se pudieron cargar los certificados del sistema:", error instanceof Error ? error.message : error);
  }
}
