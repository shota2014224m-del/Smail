import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { to, subject, body, cc, bcc, attachments } = await request.json();

  if (!to || !subject || !body) {
    return NextResponse.json({ error: "to, subject, body は必須です" }, { status: 400 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  try {
    await sendEmail(activeAccount.id, { to, subject, body, cc, bcc, attachments });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Send email error:", err);
    return NextResponse.json({ error: err?.message ?? "送信に失敗しました" }, { status: 500 });
  }
}
