# Acceso (login y autosetup)

## Propósito

Proteger la app con un usuario local. La primera vez que se abre no hay usuarios y la pantalla de acceso funciona como **autosetup**: el primero que crea usuario queda como dueño de la instalación.

## Código

- `server/src/auth/password.ts`: hash `scrypt` con salt aleatorio (`scrypt$<salt>$<hash>`) y `timingSafeEqual`. `MIN_PASSWORD_LENGTH = 6`. No hay otras reglas de complejidad.
- `server/src/auth/session.ts`: sesiones en la tabla `sessions`. La cookie `nx_session` (`httpOnly`, `SameSite=Lax`, `Secure` en producción) lleva un token aleatorio; en la base solo se guarda su SHA-256. TTL de 7 días, que se renueva con el uso.
- `server/src/auth/require-auth.ts`: middleware que protege todo `/api` salvo `auth/status`, `auth/setup` y `auth/login`.
- `server/src/modules/auth/routes.ts`: status, setup, login (rate limit en memoria de 10 intentos cada 15 minutos por IP), logout y cambio de contraseña (cierra las demás sesiones).
- Frontend: `src/lib/auth-context.tsx` y `src/routes/login-page.tsx`.

## Reglas

- `POST /auth/setup` verifica que `users` esté vacía **dentro de la misma transacción** que el alta. Un segundo setup responde 409.
- Los usuarios se comparan sin distinguir mayúsculas (`COLLATE NOCASE`).
- **Riesgo conocido:** mientras no exista el primer usuario, cualquiera que acceda a la URL puede crearlo. Hay que crearlo antes de exponer la app.

## Extender

- **Más usuarios o roles:** agregar una columna `role` con una migración nueva y una ruta de administración; `requireAuth` ya deja el usuario en `res.locals.user`.
- **SSO:** reemplazar `routes.ts` y mantener `sessions` como estado de sesión.
