import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { KnowledgeBase } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, "..", "..", "..", "data", "knowledge-base.json");

const DEFAULT_KNOWLEDGE_BASE: KnowledgeBase = {
  nombreEmpresa: "ModaBA",
  rubros: ["Indumentaria femenina", "Indumentaria masculina", "Accesorios"],
  descripcionProductos:
    "Ofrecemos ropa de moda para mujeres y hombres de todas las edades. Nuestra colección incluye remeras, pantalones, vestidos, camperas, accesorios y más. Trabajamos con talles del XS al XXL y una amplia gama de colores.",
  quienesSomos:
    "Somos ModaBA, una empresa argentina de indumentaria fundada en 2010. Nuestro compromiso es ofrecer moda accesible y de calidad para toda la familia. Tenemos presencia en las principales ciudades del país y una tienda online.",
  ubicaciones: [
    "Buenos Aires - Palermo: Av. Santa Fe 3500, L-V 10-20hs, S-D 11-19hs",
    "Buenos Aires - Belgrano: Cabildo 1200, L-V 10-20hs, S 10-18hs",
    "Córdoba - Centro: Av. Colón 500, L-V 9-19hs, S 9-14hs"
  ],
  systemPrompt:
    "Eres el asistente virtual de ModaBA, una tienda de indumentaria argentina. Tu rol es ayudar a los clientes con consultas sobre productos, talles, disponibilidad, precios, ubicaciones y envíos.\n\nCuando no puedas responder una pregunta con la información disponible, sé honesto y sugiere al cliente que contacte al equipo humano por WhatsApp al +54 11 1234-5678 o por email a hola@modaba.com.ar.\n\nSiempre sé amable, usa un tono cercano pero profesional, y responde en español. Si el cliente pregunta por algo fuera del rubro de la empresa (como consultas médicas, legales, etc.), explica amablemente que solo podés ayudar con temas relacionados a ModaBA."
};

export async function getKnowledgeBase(): Promise<KnowledgeBase> {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<KnowledgeBase>;
    return {
      nombreEmpresa: parsed.nombreEmpresa ?? DEFAULT_KNOWLEDGE_BASE.nombreEmpresa,
      rubros: Array.isArray(parsed.rubros) ? parsed.rubros : DEFAULT_KNOWLEDGE_BASE.rubros,
      descripcionProductos: parsed.descripcionProductos ?? DEFAULT_KNOWLEDGE_BASE.descripcionProductos,
      quienesSomos: parsed.quienesSomos ?? DEFAULT_KNOWLEDGE_BASE.quienesSomos,
      ubicaciones: Array.isArray(parsed.ubicaciones) ? parsed.ubicaciones : DEFAULT_KNOWLEDGE_BASE.ubicaciones,
      systemPrompt: parsed.systemPrompt ?? DEFAULT_KNOWLEDGE_BASE.systemPrompt
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      await saveKnowledgeBase(DEFAULT_KNOWLEDGE_BASE);
      return DEFAULT_KNOWLEDGE_BASE;
    }
    throw error;
  }
}

export async function saveKnowledgeBase(kb: KnowledgeBase): Promise<void> {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(kb, null, 2), "utf-8");
}
