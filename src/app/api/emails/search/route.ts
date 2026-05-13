import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();

  if (!q) return NextResponse.json({ emails: [] });

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ emails: [] });

  try {
    const auth = await getAuthenticatedClient(activeAccount.id);
    const gmail = google.gmail({ version: "v1", auth });

    const listRes = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: 30,
    });

    const messageIds = (listRes.data.messages ?? []).map((m) => m.id).filter(Boolean) as string[];

    // Try DB first for each message
    const emails = await prisma.email.findMany({
      where: { id: { in: messageIds }, accountId: activeAccount.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json({
      emails: emails.map((e) => ({
        ...e,
        labels: JSON.parse(e.labels),
        date: e.date.toISOString(),
      })),
      total: listRes.data.resultSizeEstimate ?? emails.length,
    });
  } catch (err: any) {
    console.error("Search error:", err);
    return NextResponse.json({ emails: [], error: err?.message }, { status: 500 });
  }
}
