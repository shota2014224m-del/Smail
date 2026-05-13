import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const { threadId } = await params;

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ emails: [] });

  // まずDBから取得
  let emails = await prisma.email.findMany({
    where: { accountId: activeAccount.id, threadId },
    orderBy: { date: "asc" },
  });

  // DBにスレッドの複数メールがない場合はGmailから取得
  if (emails.length <= 1) {
    try {
      const auth = await getAuthenticatedClient(activeAccount.id);
      const gmail = google.gmail({ version: "v1", auth });
      const thread = await gmail.users.threads.get({
        userId: "me",
        id: threadId,
        format: "full",
      });

      for (const msg of thread.data.messages ?? []) {
        if (!msg.id) continue;
        const headers = msg.payload?.headers ?? [];
        const getH = (n: string) =>
          headers.find((h: any) => h.name.toLowerCase() === n.toLowerCase())?.value ?? "";

        const fromRaw = getH("From");
        const fromMatch = fromRaw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
        const body = extractBody(msg.payload);

        const data = {
          id: msg.id,
          accountId: activeAccount.id,
          threadId: msg.threadId ?? threadId,
          subject: getH("Subject") || "(件名なし)",
          from: fromMatch?.[2]?.trim() ?? fromRaw,
          fromName: fromMatch?.[1]?.trim() || undefined,
          to: getH("To"),
          body: body.text,
          bodyHtml: body.html || undefined,
          snippet: msg.snippet ?? undefined,
          date: new Date(parseInt(msg.internalDate ?? "0")),
          isRead: !msg.labelIds?.includes("UNREAD"),
          isStarred: msg.labelIds?.includes("STARRED") ?? false,
          labels: JSON.stringify(msg.labelIds ?? []),
        };

        await prisma.email.upsert({
          where: { id: data.id },
          create: data,
          update: data,
        });
      }

      emails = await prisma.email.findMany({
        where: { accountId: activeAccount.id, threadId },
        orderBy: { date: "asc" },
      });
    } catch (err) {
      console.error("Thread fetch error:", err);
    }
  }

  return NextResponse.json({
    emails: emails.map((e) => ({
      ...e,
      labels: JSON.parse(e.labels),
      date: e.date.toISOString(),
    })),
  });
}

function extractBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: "", html: "" };
  let text = "";
  let html = "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    html = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractBody(part);
      if (sub.text) text = sub.text;
      if (sub.html) html = sub.html;
    }
  }
  if (!text && html) {
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return { text, html };
}
