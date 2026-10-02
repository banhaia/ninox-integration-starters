# Integración de terceros con Ninox

## Objetivo

Este documento está pensado para dos usos:

1. **Entender rápidamente qué ofrece la integración de terceros de Ninox**.
2. **Copiar y pegar este contenido en Claude, Codex o ChatGPT** para que un agente te ayude a implementar la integración.

Sirve tanto para casos de:

- chatbot con stock y catálogo
- ecommerce o storefront propio
- sincronización con sistemas externos
- automatizaciones que leen artículos y envían pedidos

---

## Qué permite hoy la integración

La integración de terceros de Ninox está orientada a exponer información del catálogo y permitir generar pedidos desde sistemas externos.

### Lectura de datos

Se puede obtener un listado completo de artículos de una integración, incluyendo:

- código
- descripción
- categorías
- etiquetas
- precios
- variantes
- stock disponible según la integración

### Envío de pedidos

También es posible enviar pedidos hacia Ninox. Esos pedidos generan **reservas**, por lo que este flujo sirve para:

- ecommerce
- bots de venta
- integraciones con CRM
- pedidos asistidos por IA
- canales de venta externos

### Autenticación

La autenticación se realiza mediante token en el header:

`X-NX-TOKEN`

---

## Ejemplo base para obtener datos

```bash
curl --request GET \
  --url https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  --header 'X-NX-TOKEN: {TU_TOKEN}' \
  --header 'content-type: application/json'
```

### Qué devuelve este endpoint

Devuelve un array con los artículos de la integración configurada para ese token.

En términos prácticos, este endpoint suele ser el punto de partida para:

- mostrar catálogo
- consultar stock
- indexar productos en un chatbot
- construir buscadores
- sincronizar precios y variantes

---

## Casos de uso típicos

### 1. Chatbot con stock y catálogo

Un bot consulta periódicamente o bajo demanda el catálogo de Ninox para responder preguntas como:

- “¿tenés stock del producto X?”
- “¿qué variantes hay?”
- “¿cuánto sale?”
- “mostrame productos de cierta categoría”

### 2. Ecommerce propio

Un frontend o backend externo consume `GetData`, publica el catálogo y luego envía pedidos a Ninox para que queden reservados.

### 3. Integración con CRM o sistema externo

Otro sistema puede leer artículos, precios y stock, y eventualmente generar pedidos o reservas desde oportunidades comerciales o flujos automáticos.

---

## Enfoque recomendado para una integración

### Paso 1: obtener catálogo desde Ninox

Consumir `GetData` y guardar o procesar la información necesaria:

- identificador interno o código
- descripción visible
- categorías
- etiquetas
- precios
- variantes
- stock

### Paso 2: mapear el modelo de datos local

Definir cómo se representarán en tu sistema:

- productos
- variantes
- stock por artículo o variante
- precio principal y precios adicionales si existieran
- categorías y tags

### Paso 3: definir estrategia de sincronización

Puede ser:

- bajo demanda
- por polling cada cierta cantidad de minutos
- cache local temporal
- sincronización nocturna

### Paso 4: generar pedidos hacia Ninox

Cuando el usuario confirme una compra o reserva, enviar el pedido a Ninox según la documentación del flujo de pedidos.

### Paso 5: contemplar validaciones

Antes de pasar a producción conviene validar:

- productos sin stock
- variantes inexistentes
- diferencias de precio
- duplicación de pedidos
- reintentos por errores de red
- manejo de timeouts

---

## Información mínima que conviene definir antes de integrar

Antes de pedirle a un agente de IA que implemente la integración, conviene tener claro esto:

### Datos funcionales

- cuál es el objetivo de la integración
- si solo necesita lectura o también envío de pedidos
- si debe trabajar con stock en tiempo real o con cache
- si importa categorías y etiquetas
- si debe soportar variantes
- qué campos del producto son obligatorios

### Datos técnicos

- lenguaje y framework del proyecto
- si la integración va en frontend, backend o ambos
- dónde se guardará el token
- cómo se hará el cache o persistencia local
- cómo se loguearán errores
- cómo se manejarán reintentos

---

## Prompt base para Claude / Codex / ChatGPT

Copiar y pegar:

```markdown
Quiero que me ayudes a desarrollar una integración con Ninox usando su integración de terceros.

Contexto funcional:
- Ninox expone un endpoint para obtener artículos de una integración.
- El endpoint devuelve productos con código, descripción, categorías, etiquetas, precios, variantes y stock.
- También existe la posibilidad de enviar pedidos a Ninox, lo cual genera reservas.
- Esta integración puede servir para chatbot, ecommerce o sincronización con sistemas externos.

Ejemplo de consumo inicial:

```bash
curl --request GET \
  --url https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  --header 'X-NX-TOKEN: {TU_TOKEN}' \
  --header 'content-type: application/json'
```

Necesito que me ayudes a construir esta integración de punta a punta.

Objetivo específico:
[COMPLETAR OBJETIVO]

Mi stack es:
[COMPLETAR STACK]

Quiero que resuelvas lo siguiente:
1. Proponer arquitectura simple para la integración.
2. Definir modelos de datos necesarios.
3. Crear cliente HTTP para consumir Ninox.
4. Mapear productos, categorías, etiquetas, precios, variantes y stock.
5. Proponer estrategia de sincronización.
6. Preparar el flujo para enviar pedidos a Ninox.
7. Agregar manejo de errores, logs y reintentos.
8. Entregar código listo para usar y explicar dónde configurar el token.

Condiciones:
- Priorizar implementación simple y mantenible.
- No inventar campos que no estén en la respuesta real del endpoint.
- Separar claramente lectura de catálogo y envío de pedidos.
- Si faltan datos de contrato del endpoint de pedidos, dejar el código preparado y marcar claramente qué parte depende de la documentación exacta.
- Usar buenas prácticas, pero sin complejidad innecesaria.
```

---

## Prompt específico para chatbot de stock

```markdown
Quiero integrar Ninox con un chatbot que responda consultas de productos, stock, precios y variantes.

Ninox tiene un endpoint GET para obtener el catálogo de una integración:

```bash
curl --request GET \
  --url https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  --header 'X-NX-TOKEN: {TU_TOKEN}' \
  --header 'content-type: application/json'
```

La respuesta incluye artículos con:
- código
- descripción
- categorías
- etiquetas
- precios
- variantes
- stock

Quiero que me ayudes a implementar:
1. Un servicio que consuma y normalice este catálogo.
2. Una estructura de búsqueda simple para que el bot pueda responder por texto.
3. Reglas para buscar por nombre, categoría, etiqueta o código.
4. Una estrategia de actualización de stock y precios.
5. Ejemplos de prompts o funciones para que un agente consulte el catálogo.

Mi stack es:
[COMPLETAR STACK]

Quiero código concreto y utilizable.
```

---

## Prompt específico para ecommerce

```markdown
Quiero desarrollar una integración entre Ninox y un ecommerce propio.

Tengo disponible un endpoint para obtener artículos desde Ninox:

```bash
curl --request GET \
  --url https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  --header 'X-NX-TOKEN: {TU_TOKEN}' \
  --header 'content-type: application/json'
```

Este endpoint devuelve productos con código, descripción, categorías, etiquetas, precios, variantes y stock.

Además, Ninox permite enviar pedidos que generan reservas.

Necesito que me ayudes a diseñar e implementar:
1. Importación y normalización del catálogo.
2. Publicación del catálogo en mi ecommerce.
3. Sincronización de stock y precios.
4. Flujo de creación de pedido hacia Ninox.
5. Validaciones para evitar inconsistencias.
6. Manejo de errores y reintentos.
7. Estructura de código mantenible.

Mi stack es:
[COMPLETAR STACK]

Quiero una solución simple, clara y lista para evolucionar.
```

---

## Recomendaciones prácticas

- Empezar por **solo lectura** con `GetData`.
- Validar bien cómo viene la respuesta real antes de modelar demasiado.
- No acoplar el frontend directamente al token si no es necesario.
- Implementar primero una capa backend o middleware cuando el proyecto lo permita.
- Dejar trazabilidad de sincronizaciones y errores.
- Separar claramente:
  - importación de catálogo
  - consulta de stock
  - creación de pedidos

---

## Versión corta tipo “getting started”

```markdown
# Getting Started - Integración de terceros con Ninox

La integración de terceros de Ninox permite:

- obtener artículos con código, descripción, categorías, etiquetas, precios, variantes y stock
- enviar pedidos hacia Ninox, generando reservas

## Autenticación

Usar header:

`X-NX-TOKEN`

## Primer request recomendado

```bash
curl --request GET \
  --url https://api.test-ninox.com.ar/integraciones/Terceros/GetData \
  --header 'X-NX-TOKEN: {TU_TOKEN}' \
  --header 'content-type: application/json'
```

## Casos de uso comunes

- chatbot con catálogo y stock
- ecommerce propio
- integración con CRM o sistema externo
- automatizaciones comerciales

## Recomendación

Comenzar integrando la lectura del catálogo, validar la estructura real de respuesta y luego avanzar con el envío de pedidos.
```

---

## Nota final

Este documento está hecho para que una persona técnica o semitécnica pueda entender rápidamente el alcance y además usarlo como prompt inicial en herramientas como Claude Code, Codex o ChatGPT para acelerar la implementación.

