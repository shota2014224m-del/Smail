import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { emailIds, labelId, action } = await request.json() as {
    emailIds: string[];
    labelId: string;
    action: "add" | "remove";
  };

  if (!emailIds?.length || !labelId || !action) {
    return NextResponse.json({ error: "emailIds, labelId, action は必須です" }, { status: 400 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  try {
    const auth = await getAuthenticatedClient(activeAccount.id);
    const gmail = google.gmail({ version: "v1", auth });

    await Promise.all(
      emailIds.map((id) =>
        gmail.users.messages.modify({
          userId: "me",
          id,
          requestBody: {
            addLabelIds: action === "add" ? [labelId] : [],
            removeLabelIds: action === "remove" ? [labelId] : [],
          },
        })
      )
    );

    for (const emailId of emailIds) {
      const email = await prisma.email.findUnique({ where: { id: emailId } });
      if (!email) continue;
      const labels: string[] = JSON.parse(email.labels);
      const updated =
        action === "add"
          ? [...new Set([...labels, labelId])]
          : labels.filter((l) => l !== labelId);
      await prisma.email.update({ where: { id: emailId }, data: { labels: JSON.stringify(updated) } });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Label action error:", err);
    return NextResponse.json({ error: err?.message ?? "操作に失敗しました" }, { status: 500 });
  }
}
