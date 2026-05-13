import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchEmails, fetchEmailsByLabel } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const refresh = url.searchParams.get("refresh") === "true";
  const label = url.searchParams.get("label") ?? null;

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ emails: [], accountId: null });
  }

  if (refresh) {
    try {
      if (label) {
        await fetchEmailsByLabel(activeAccount.id, label, 50);
      } else {
        await fetchEmails(activeAccount.id, 50);
      }
    } catch (err) {
      console.error("Failed to fetch emails from Gmail:", err);
    }
  }

  const emails = await prisma.email.findMany({
    where: {
      accountId: activeAccount.id,
      ...(label ? { labels: { contains: label } } : {}),
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return NextResponse.json({
    emails: emails.map((e) => ({
      ...e,
      labels: JSON.parse(e.labels),
      date: e.date.toISOString(),
    })),
    accountId: activeAccount.id,
  });
}
