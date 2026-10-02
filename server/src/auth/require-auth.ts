import type { RequestHandler, Response } from "express";
import type { Db } from "../db/connection.js";
import { HttpError } from "../lib/http.js";
import { readSessionToken, resolveSession, setSessionCookie, type SessionUser } from "./session.js";

export function requireAuth(db: Db, secureCookies: boolean): RequestHandler {
  return (req, res, next) => {
    const token = readSessionToken(req);
    const session = token ? resolveSession(db, token) : null;

    if (!token || !session) {
      next(new HttpError(401, "Sesión inválida o expirada"));
      return;
    }

    if (session.renewedExpiresAt) {
      setSessionCookie(res, token, session.renewedExpiresAt, secureCookies);
    }

    res.locals.user = session.user;
    next();
  };
}

export function currentUser(res: Response): SessionUser {
  const user = res.locals.user as SessionUser | undefined;
  if (!user) throw new HttpError(401, "Sesión inválida o expirada");
  return user;
}
