import { afterEach, describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../server/src/auth/password.js";
import { createTestContext, startApp } from "./helpers.js";

let close: (() => Promise<void>) | null = null;

afterEach(async () => {
  await close?.();
  close = null;
});

describe("contraseñas", () => {
  it("hashea con scrypt y verifica", async () => {
    const hash = await hashPassword("secreto1");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("secreto1", hash)).toBe(true);
    expect(await verifyPassword("otra", hash)).toBe(false);
  });
});

describe("autosetup y login", () => {
  it("pide setup la primera vez, exige 6 caracteres y solo permite un setup", async () => {
    const { ctx } = createTestContext();
    const app = await startApp(ctx);
    close = app.close;

    let res = await app.api("/api/auth/status");
    expect(res.body).toMatchObject({ setupRequired: true, user: null });

    res = await app.api("/api/settings");
    expect(res.status).toBe(401);

    res = await app.api("/api/auth/setup", { method: "POST", json: { username: "admin", password: "12345" } });
    expect(res.status).toBe(400);

    res = await app.api("/api/auth/setup", { method: "POST", json: { username: "admin", password: "123456" } });
    expect(res.status).toBe(201);

    res = await app.api("/api/settings");
    expect(res.status).toBe(200);

    res = await app.api("/api/auth/setup", { method: "POST", json: { username: "otro", password: "123456" } });
    expect(res.status).toBe(409);

    await app.api("/api/auth/logout", { method: "POST" });
    app.clearCookie();
    res = await app.api("/api/settings");
    expect(res.status).toBe(401);

    res = await app.api("/api/auth/login", { method: "POST", json: { username: "admin", password: "mala12" } });
    expect(res.status).toBe(401);

    res = await app.api("/api/auth/login", { method: "POST", json: { username: "ADMIN", password: "123456" } });
    expect(res.status).toBe(200);
    expect((await app.api("/api/auth/status")).body).toMatchObject({ setupRequired: false, user: { username: "admin" } });
  });

  it("nunca devuelve el token de Ninox completo", async () => {
    const { ctx } = createTestContext();
    const app = await startApp(ctx);
    close = app.close;
    await app.api("/api/auth/setup", { method: "POST", json: { username: "admin", password: "123456" } });

    await app.api("/api/settings/ninox", { method: "PUT", json: { env: "test", token: "abcdef-token-secreto-9876" } });
    const res = await app.api("/api/settings");
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("abcdef-token-secreto");
    expect(res.body).toMatchObject({ ninox: { hasToken: true, tokenLast4: "9876" } });
  });
});
