import { NextRequest, NextResponse } from "next/server";
import { generateReply, generateNewEmail } from "@/lib/claude";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(request: NextRequest) {
  // 1分間に10回まで
  if (!rateLimit("ai-generate", 10, 60_000)) {
    return NextResponse.json({ error: "リクエストが多すぎます。しばらく待ってから再試行してください。" }, { status: 429 });
  }
  const { emailId, userInstruction, isNew, subject, to } = await request.json();

  // 新規メール作成モード
  if (isNew) {
    const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
    if (!activeAccount) {
      return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
    }
    try {
      const result = await generateNewEmail({
        accountId: activeAccount.id,
        to: to ?? "",
        subject: subject ?? "",
        userInstruction,
      });
      return NextResponse.json({ body: result.body, confidence: result.confidence });
    } catch (err) {
      console.error("New email generation error:", err);
      return NextResponse.json({ error: "生成に失敗しました" }, { status: 500 });
    }
  }

  // 返信モード
  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) return NextResponse.json({ error: "メールが見つかりません" }, { status: 404 });

  try {
    const result = await generateReply({
      accountId: email.accountId,
      emailSubject: email.subject,
      emailFrom: email.from,
      emailBody: email.body,
      userInstruction,
    });

    const pattern = await prisma.replyPattern.create({
      data: {
        accountId: email.accountId,
        emailId: email.id,
        originalSubject: email.subject,
        originalFrom: email.from,
        originalBody: email.body,
        replyBody: result.body,
        feedback: 0,
      },
    });

    return NextResponse.json({
      body: result.body,
      confidence: result.confidence,
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      to: email.from,
      patternId: pattern.id,
    });
  } catch (err) {
    console.error("Reply generation error:", err);
    return NextResponse.json({ error: "返信の生成に失敗しました" }, { status: 500 });
  }
}
