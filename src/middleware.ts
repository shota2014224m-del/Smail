import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "smail_auth";

// 認証不要なパス
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/callback",
  "/_next",
  "/favicon.ico",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 公開パスはスキップ
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const appSecret = process.env.APP_SECRET;
  if (!appSecret) {
    // APP_SECRET未設定の場合は開発環境とみなしてスキップ
    return NextResponse.next();
  }

  const cookie = req.cookies.get(AUTH_COOKIE);
  if (cookie?.value === appSecret) {
    return NextResponse.next();
  }

  // API呼び出しには401を返す
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // それ以外はログインページへリダイレクト
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
