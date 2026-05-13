import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

const SYSTEM_LABELS = new Set([
  "INBOX", "SENT", "DRAFT", "TRASH", "SPAM",
  "STARRED", "IMPORTANT", "UNREAD", "CATEGORY_PERSONAL",
  "CATEGORY_SOCIAL", "CATEGORY_PROMOTIONS", "CATEGORY_UPDATES", "CATEGORY_FORUMS",
]);

export async function GET() {
  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ labels: [] });

  try {
    const auth = await getAuthenticatedClient(activeAccount.id);
    const gmail = google.gmail({ version: "v1", auth });

    const res = await gmail.users.labels.list({ userId: "me" });
    const allLabels = res.data.labels ?? [];

    const userLabels = allLabels
      .filter((l) => l.type === "user" && l.name && !SYSTEM_LABELS.has(l.id ?? ""))
      .map((l) => ({
        id: l.id ?? "",
        name: l.name ?? "",
        unread: l.messagesUnread ?? 0,
        total: l.messagesTotal ?? 0,
        color: l.color?.backgroundColor ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));

    return NextResponse.json({ labels: userLabels });
  } catch (err) {
    console.error("Labels fetch error:", err);
    return NextResponse.json({ labels: [] });
  }
}
