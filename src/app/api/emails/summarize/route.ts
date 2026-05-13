import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  const { threadId, emailIds } = await request.json() as {
    threadId: string;
    emailIds: string[];
  };

  if (!threadId && !emailIds?.length) {
    return NextResponse.json({ error: "threadId または emailIds は必須です" }, { status: 400 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const model = settings?.claudeModel ?? "claude-sonnet-4-6";

  const emails = await prisma.email.findMany({
    where: emailIds?.length
      ? { id: { in: emailIds }, accountId: activeAccount.id }
      : { threadId, accountId: activeAccount.id },
    orderBy: { date: "asc" },
    take: 20,
  });

  if (!emails.length) {
    return NextResponse.json({ error: "メールが見つかりません" }, { status: 404 });
  }

  const content = emails
    .map((e) => `[${new Date(e.date).toLocaleString("ja-JP")}] ${e.fromName ?? e.from}:\n${e.body.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [{
        role: "user",
        content: `以下のメールスレッドを3〜5行で簡潔に要約してください。重要なポイント、決定事項、アクションアイテムがあれば含めてください。\n\n${content}`,
      }],
    });

    const summary = (response.content[0] as { type: "text"; text: string }).text.trim();
    return NextResponse.json({ summary });
  } catch (err: any) {
    console.error("Summarize error:", err);
    return NextResponse.json({ error: err?.message ?? "要約に失敗しました" }, { status: 500 });
  }
}
