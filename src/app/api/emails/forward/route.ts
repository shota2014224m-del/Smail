import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { emailId, to, body, cc, bcc } = await request.json();

  if (!emailId || !to || !body) {
    return NextResponse.json({ error: "emailId, to, body は必須です" }, { status: 400 });
  }

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) {
    return NextResponse.json({ error: "メールが見つかりません" }, { status: 404 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  const subject = email.subject.startsWith("Fwd:")
    ? email.subject
    : `Fwd: ${email.subject}`;

  try {
    await sendEmail(activeAccount.id, { to, subject, body, cc, bcc });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Forward email error:", err);
    return NextResponse.json({ error: err?.message ?? "転送に失敗しました" }, { status: 500 });
  }
}
