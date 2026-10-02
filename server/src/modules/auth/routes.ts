import { Router } from "express";
import type { Db } from "../../db/connection.js";
import { hashPassword, validatePassword, verifyPassword } from "../../auth/password.js";
import { currentUser, requireAuth } from "../../auth/require-auth.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  deleteUserSessions,
  readSessionToken,
  resolveSession,
  setSessionCookie
} from "../../auth/session.js";
import { asyncHandler, HttpError, readString } from "../../lib/http.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;

function countUsers(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
}

function validateUsername(value: unknown): string {
  const username = readString(value);
  if (!username) throw new HttpError(400, "El usuario es requerido");
  if (username.length > 64) throw new HttpError(400, "El usuario no puede superar 64 caracteres");
  return username;
}

/**
 * Autenticación local de un único dueño de la app.
 * - La primera vez (tabla users vacía) se habilita el autosetup del usuario.
 * - Luego, login con usuario y contraseña (mínimo 6 caracteres, sin otras reglas).
 */
export function authRouter(db: Db, secureCookies: boolean): Router {
  const router = Router();
  const attempts = new Map<string, { count: number; resetAt: number }>();

  function checkLoginRate(ip: string): void {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt <= now) {
      attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
      return;
    }
    entry.count += 1;
    if (entry.count > LOGIN_MAX_ATTEMPTS) {
      throw new HttpError(429, "Demasiados intentos. Probá de nuevo en unos minutos.");
    }
  }

  router.get("/status", (req, res) => {
    const token = readSessionToken(req);
    const session = token ? resolveSession(db, token) : null;
    if (token && session?.renewedExpiresAt) setSessionCookie(res, token, session.renewedExpiresAt, secureCookies);
    res.json({
      setupRequired: countUsers(db) === 0,
      user: session?.user ?? null
    });
  });

  router.post(
    "/setup",
    asyncHandler(async (req, res) => {
      const username = validateUsername(req.body?.username);
      const password: unknown = req.body?.password;
      const passwordError = validatePassword(password);
      if (passwordError) throw new HttpError(400, passwordError);

      const passwordHash = await hashPassword(password as string);

      // El chequeo y el alta van en la misma transacción: solo el primer setup gana.
      const userId = db.transaction(() => {
        if (countUsers(db) > 0) throw new HttpError(409, "La app ya tiene un usuario configurado");
        const result = db
          .prepare("INSERT INTO users (username, password_hash, created_at, last_login_at) VALUES (?, ?, ?, ?)")
          .run(username, passwordHash, new Date().toISOString(), new Date().toISOString());
        return Number(result.lastInsertRowid);
      })();

      const session = createSession(db, userId);
      setSessionCookie(res, session.token, session.expiresAt, secureCookies);
      res.status(201).json({ user: { id: userId, username } });
    })
  );

  router.post(
    "/login",
    asyncHandler(async (req, res) => {
      checkLoginRate(req.ip ?? "unknown");
      const username = validateUsername(req.body?.username);
      const password = typeof req.body?.password === "string" ? (req.body.password as string) : "";

      const user = db
        .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
        .get(username) as { id: number; username: string; password_hash: string } | undefined;

      if (!user || !(await verifyPassword(password, user.password_hash))) {
        throw new HttpError(401, "Usuario o contraseña incorrectos");
      }

      db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(new Date().toISOString(), user.id);
      attempts.delete(req.ip ?? "unknown");

      const session = createSession(db, user.id);
      setSessionCookie(res, session.token, session.expiresAt, secureCookies);
      res.json({ user: { id: user.id, username: user.username } });
    })
  );

  router.post("/logout", (req, res) => {
    const token = readSessionToken(req);
    if (token) deleteSession(db, token);
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.post(
    "/password",
    requireAuth(db, secureCookies),
    asyncHandler(async (req, res) => {
      const user = currentUser(res);
      const currentPassword = typeof req.body?.currentPassword === "string" ? (req.body.currentPassword as string) : "";
      const newPassword: unknown = req.body?.newPassword;

      const passwordError = validatePassword(newPassword);
      if (passwordError) throw new HttpError(400, passwordError);

      const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(user.id) as
        | { password_hash: string }
        | undefined;
      if (!row || !(await verifyPassword(currentPassword, row.password_hash))) {
        throw new HttpError(400, "La contraseña actual no es correcta");
      }

      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(await hashPassword(newPassword as string), user.id);
      deleteUserSessions(db, user.id, readSessionToken(req));
      res.status(204).end();
    })
  );

  return router;
}
