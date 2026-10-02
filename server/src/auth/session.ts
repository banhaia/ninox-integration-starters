import { createHash, randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import type { Db } from "../db/connection.js";

export const SESSION_COOKIE = "nx_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Se renueva la expiración cuando queda menos de este margen (sesión deslizante). */
const RENEW_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: number;
  username: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createSession(db: Db, userId: number): { token: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  db.prepare("INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").run(
    hashToken(token),
    userId,
    now.toISOString(),
    expiresAt.toISOString()
  );

  return { token, expiresAt };
}

export function resolveSession(db: Db, token: string): { user: SessionUser; renewedExpiresAt?: Date } | null {
  const id = hashToken(token);
  const row = db
    .prepare(
      `SELECT s.expires_at, u.id, u.username
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ?`
    )
    .get(id) as { expires_at: string; id: number; username: string } | undefined;

  if (!row) return null;

  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();
  if (expiresAt <= now) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    return null;
  }

  let renewedExpiresAt: Date | undefined;
  if (expiresAt - now < SESSION_TTL_MS - RENEW_THRESHOLD_MS) {
    renewedExpiresAt = new Date(now + SESSION_TTL_MS);
    db.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(renewedExpiresAt.toISOString(), id);
  }

  return { user: { id: row.id, username: row.username }, renewedExpiresAt };
}

export function deleteSession(db: Db, token: string): void {
  db.prepare("DELETE FROM sessions WHERE id = ?").run(hashToken(token));
}

export function deleteUserSessions(db: Db, userId: number, exceptToken?: string): void {
  if (exceptToken) {
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND id <> ?").run(userId, hashToken(exceptToken));
  } else {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}

export function purgeExpiredSessions(db: Db): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}

export function readSessionToken(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function setSessionCookie(res: Response, token: string, expiresAt: Date, secure: boolean): void {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    expires: expiresAt,
    path: "/"
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}
