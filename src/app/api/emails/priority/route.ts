import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// Scores top unread inbox emails by importance using Claude
export async function GET() {
  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ emails: [] });

  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const model = settings?.claudeModel ?? "claude-sonnet-4-6";

  const unread = await prisma.email.findMany({
    where: {
      accountId: activeAccount.id,
      isRead: false,
      labels: { contains: "INBOX" },
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  if (!unread.length) return NextResponse.json({ emails: [] });

  try {
    const client = new Anthropic();
    const emailList = unread
      .map((e, i) => `[${i}] From: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet ?? e.body.slice(0, 100)}`)
      .join("\n\n");

    const response = await client.messages.create({
      model,
      max_tokens: 256,
      messages: [{
        role: "user",
        content: `以下のメールを重要度で評価し、最も重要な順にインデックス番号をカンマ区切りで返してください。返答はインデックスのみ（例: 2,0,5,1）。\n\n${emailList}`,
      }],
    });

    const text = (response.content[0] as { type: "text"; text: string }).text.trim();
    const order = text.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n < unread.length);
    const ranked = [
      ...order.map((i) => unread[i]),
      ...unread.filter((_, i) => !order.includes(i)),
    ];

    return NextResponse.json({
      emails: ranked.map((e) => ({
        ...e,
        labels: JSON.parse(e.labels),
        date: e.date.toISOString(),
      })),
    });
  } catch {
    // Fallback to date order if Claude fails
    return NextResponse.json({
      emails: unread.map((e) => ({
        ...e,
        labels: JSON.parse(e.labels),
        date: e.date.toISOString(),
      })),
    });
  }
}
