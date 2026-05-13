import { NextRequest, NextResponse } from "next/server";
import { recordReply } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { sendReply as gmailSendReply } from "@/lib/gmail";

export async function POST(request: NextRequest) {
  const { emailId, replyBody, cc, bcc, attachments } = await request.json();

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  try {
    await gmailSendReply(
      email.accountId,
      { id: email.id, threadId: email.threadId, from: email.from, subject: email.subject },
      replyBody,
      { cc, bcc, attachments }
    );

    await recordReply({
      accountId: email.accountId,
      emailId: email.id,
      originalSubject: email.subject,
      originalFrom: email.from,
      originalBody: email.body,
      replyBody,
    });

    await prisma.email.update({
      where: { id: emailId },
      data: { isRead: true },
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Send reply error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to send reply" },
      { status: 500 }
    );
  }
}
