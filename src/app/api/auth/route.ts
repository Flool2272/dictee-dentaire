import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const encodedHash = process.env.APP_PASSWORD_HASH;

  if (!encodedHash) {
    return NextResponse.json(
      { error: "APP_PASSWORD_HASH n'est pas configuré côté serveur" },
      { status: 500 }
    );
  }

  const passwordHash = Buffer.from(encodedHash, "base64").toString("utf-8");

  if (typeof password !== "string" || !bcrypt.compareSync(password, passwordHash)) {
    return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
