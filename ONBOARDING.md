# Onboarding guiado por IA

> **Para la IA que lee esto:** una persona te pidió ayuda para empezar un proyecto con este starter. Seguí esta guía antes de tocar código. Para trabajar sobre el código después, la referencia es [`AGENTS.md`](AGENTS.md) y [`CLAUDE.md`](CLAUDE.md).

Este repositorio es una **app lista para usar integrada a Ninox ERP** (catálogo y stock, reservas y ventas, ingesta de datos y reportes) pensada para que cada empresa la adapte a su caso. Si la persona quiere una **tienda online**, el starter indicado es otro: [ninox-ecommerce-starter](https://github.com/banhaia/ninox-ecommerce-starter). Confirmalo antes de seguir.

## Principios

- **La persona puede no ser técnica.** Explicá en lenguaje simple qué vas a hacer y por qué, un paso por vez. Nada de jerga sin traducir.
- **No asumas el entorno.** Puede estar en Windows, macOS, Linux, una tablet o un celular, con un agente que ejecuta comandos o con un chat que solo conversa. Averigualo (mirando tu entorno o preguntando) y decidí vos los detalles técnicos.
- **Pedí permiso antes de instalar** algo en la computadora de la persona o de crear cuentas o repositorios a su nombre.
- **Nunca pidas el token de Ninox por el chat.** Va en la pantalla de Configuración de la app o en un archivo `.env` local. Si la persona lo pega en el chat, avisale que conviene pedir uno nuevo.
- **Decí la verdad sobre lo que podés hacer.** Si no podés ejecutar comandos, no simules que lo hiciste.

## Paso 1. Entender a la persona

Preguntá, en una sola tanda y sin formulario largo:

1. **Qué quiere lograr**: una app para gestionar su empresa (stock, pedidos, reportes, integraciones internas) o una tienda online.
2. **Si ya usa Ninox** y si tiene el **token de la integración de terceros**. Si no lo tiene se pide en [ninoxnet.com/integraciones/terceros](https://www.ninoxnet.com/integraciones/terceros) o a dev@banhaia.com. Se puede avanzar sin token: la app levanta igual y los tests usan datos ficticios.
3. **Quién lo va a mantener**: ella misma, alguien de su equipo o un tercero (desarrollador, agencia).

Si la persona no se siente cómoda manejando una computadora con terminal, o la app va a manejar datos de clientes en producción, sugerí sumar a alguien técnico. Podés igual dejar todo preparado para pasárselo (ver "Paso 7").

## Paso 2. Ver desde dónde estás trabajando

| Tu entorno | Qué hacer |
|---|---|
| Agente con terminal y archivos en la computadora de la persona | Hacé los pasos vos, explicando cada uno. |
| Entorno de desarrollo en la nube (un workspace con terminal en el navegador) | Hacelo ahí. Explicá cómo abrir la app desde el puerto que exponga el entorno. |
| Solo chat (app de celular, web sin herramientas) | No podés ejecutar nada. Guiá paso a paso o recomendá una alternativa: un entorno en la nube que funcione desde el navegador, una computadora con un agente de código, o pasárselo a alguien. |

## Paso 3. Crear la copia propia del proyecto

El starter es un punto de partida: la persona necesita **su propio repositorio**, no trabajar sobre este. Elegí la opción según su situación y explicale la diferencia en una línea:

- **Repositorio nuevo a partir de este** (botón *Use this template* en GitHub, si está disponible): repo propio, puede ser privado, sin el historial del starter. Es la opción recomendada.
- **Fork**: copia pública vinculada a este repo. Sirve si quiere proponer mejoras al starter.
- **Clonar y subir a un repo nuevo**: si no usa GitHub o prefiere otro servicio. Conservá este repo como remoto `upstream` para traer mejoras más adelante.

Si no tiene cuenta en un servicio de repositorios, explicale para qué sirve (respaldo, historial, publicar la app) y ayudala a crearla, o seguí en local y dejalo anotado como pendiente.

## Paso 4. Instalar lo necesario

Requisitos: **Git** y **Node.js** en la versión de [`.nvmrc`](.nvmrc) (mínimo 20.17). Verificá qué hay instalado y, con permiso, instalá lo que falte con el método habitual del sistema operativo. No hace falta nada más: la base de datos (SQLite) viene incluida.

```bash
npm install
npm run dev
```

La app queda en `http://localhost:5173` (el backend corre en el puerto 3030). Si querés confirmar que todo está sano: `npm run validate`.

## Paso 5. Primer uso y conexión con Ninox

Acompañá a la persona por la app:

1. **Primer acceso**: crea su usuario administrador.
2. **Configuración**: pega el token, elige **testing** y toca *Guardar y probar*. Desarrollar siempre contra testing hasta que todo funcione.
3. **Inicio**: sincroniza el catálogo.
4. **Ingesta** y **Reportes**: importa algunos meses y mira los indicadores.

Si algo falla, [`docs/getting-started.md`](docs/getting-started.md) y la sección de errores de [`CLAUDE.md`](CLAUDE.md) explican cada caso (403 por sucursales sin habilitar, esperas por rate limit, certificados).

## Paso 6. Adaptarla a su caso

Preguntá qué le gustaría que haga la app que hoy no hace y proponé **un primer cambio chico** que pueda ver funcionando. Para cambios que tocan Ninox seguí el playbook de [`.claude/agents/ninox-integration-expert.md`](.claude/agents/ninox-integration-expert.md) y la metodología de 5 pasos de [`CLAUDE.md`](CLAUDE.md). Ideas frecuentes: tablero de ventas a medida, chatbot con stock, sincronización con un CRM, alertas de stock bajo.

Guardá cada avance con un commit en su repositorio y explicale qué quedó guardado.

## Paso 7. Dejarlo listo para seguir

Antes de terminar, dejale a la persona un resumen corto:

- dónde está su repositorio y cómo volver a levantar la app;
- qué está configurado y qué falta (token de producción, publicar la app, etc.);
- el próximo paso sugerido.

Si va a continuar otra persona o un tercero, ese resumen más este repositorio alcanzan para que retome. Para publicar la app en un servidor: `npm run build` y `npm start` (ver [README](README.md#producción)).
