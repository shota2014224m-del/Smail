import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { to, subject, body } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, body は必須です" }, { status: 400 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  try {
    const auth = await getAuthenticatedClient(activeAccount.id);
    const gmail = google.gmail({ version: "v1", auth });

    const lines = [
      `From: ${activeAccount.email}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      body,
    ];
    const raw = Buffer.from(lines.join("\r\n")).toString("base64url");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Send email error:", err);
    return NextResponse.json({ error: err?.message ?? "送信に失敗しました" }, { status: 500 });
  }
}
