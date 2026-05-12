import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL(`/?error=${error ?? "no_code"}`, request.url)
    );
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.email) {
      throw new Error("メールアドレスを取得できませんでした");
    }

    await prisma.account.upsert({
      where: { email: userInfo.email },
      create: {
        email: userInfo.email,
        name: userInfo.name ?? undefined,
        picture: userInfo.picture ?? undefined,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? "",
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
      },
      update: {
        name: userInfo.name ?? undefined,
        picture: userInfo.picture ?? undefined,
        accessToken: tokens.access_token ?? "",
        refreshToken: tokens.refresh_token ?? "",
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
      },
    });

    await prisma.account.updateMany({
      where: { email: { not: userInfo.email } },
      data: { isActive: false },
    });

    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("OAuth callback error:", err);
    return NextResponse.redirect(new URL("/?error=oauth_failed", request.url));
  }
}
