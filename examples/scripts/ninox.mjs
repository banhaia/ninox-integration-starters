// Cliente mínimo compartido por los scripts de ejemplo. Lee la configuración de variables
// de entorno (o de un .env en la raíz del repo). El token nunca se imprime.
try {
  process.loadEnvFile?.(".env");
} catch {
  // sin .env
}

const BASE_URLS = { test: "https://api.test-ninox.com.ar", prod: "https://api.ninox.com.ar" };
const env = process.env.NINOX_ENV ?? "test";
const baseUrl = (process.env.NINOX_BASE_URL || BASE_URLS[env] || BASE_URLS.test).replace(/\/+$/, "");
const token = process.env.NINOX_TOKEN;

if (!token) {
  console.error("Falta NINOX_TOKEN (variable de entorno o .env en la raíz del repo).");
  process.exit(1);
}

async function request(method, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-NX-TOKEN": token },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Ninox respondió ${response.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

export const ninoxGet = (path) => request("GET", path);
export const ninoxPost = (path, body) => request("POST", path, body);
