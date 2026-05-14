import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "smail_auth";
const MAX_AGE = 60 * 60 * 24 * 30; // 30日

export async function POST(req: NextRequest) {
  const { secret } = await req.json();
  const appSecret = process.env.APP_SECRET;

  if (!appSecret || secret !== appSecret) {
    return NextResponse.json({ error: "パスワードが違います" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, appSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
  return res;
}
