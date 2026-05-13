import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getAuthenticatedClient } from "@/lib/gmail";
import { prisma } from "@/lib/db";

// Performs label-based actions on emails: archive, trash, untrash, star, unstar, markRead, markUnread
export async function POST(request: NextRequest) {
  const { emailIds, action } = await request.json() as {
    emailIds: string[];
    action: "archive" | "trash" | "untrash" | "star" | "unstar" | "markRead" | "markUnread";
  };

  if (!emailIds?.length || !action) {
    return NextResponse.json({ error: "emailIds と action は必須です" }, { status: 400 });
  }

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) {
    return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });
  }

  const addLabels: string[] = [];
  const removeLabels: string[] = [];

  switch (action) {
    case "archive":
      removeLabels.push("INBOX");
      break;
    case "trash":
      addLabels.push("TRASH");
      removeLabels.push("INBOX");
      break;
    case "untrash":
      removeLabels.push("TRASH");
      addLabels.push("INBOX");
      break;
    case "star":
      addLabels.push("STARRED");
      break;
    case "unstar":
      removeLabels.push("STARRED");
      break;
    case "markRead":
      removeLabels.push("UNREAD");
      break;
    case "markUnread":
      addLabels.push("UNREAD");
      break;
  }

  try {
    const auth = await getAuthenticatedClient(activeAccount.id);
    const gmail = google.gmail({ version: "v1", auth });

    await Promise.all(
      emailIds.map((id) =>
        gmail.users.messages.modify({
          userId: "me",
          id,
          requestBody: { addLabelIds: addLabels, removeLabelIds: removeLabels },
        })
      )
    );

    // Update DB to reflect label changes
    for (const emailId of emailIds) {
      const email = await prisma.email.findUnique({ where: { id: emailId } });
      if (!email) continue;
      const labels: string[] = JSON.parse(email.labels);
      const updated = [
        ...labels.filter((l) => !removeLabels.includes(l)),
        ...addLabels.filter((l) => !labels.includes(l)),
      ];
      await prisma.email.update({
        where: { id: emailId },
        data: {
          labels: JSON.stringify(updated),
          isRead: action === "markRead" ? true : action === "markUnread" ? false : email.isRead,
          isStarred: action === "star" ? true : action === "unstar" ? false : email.isStarred,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Email action error:", err);
    return NextResponse.json({ error: err?.message ?? "操作に失敗しました" }, { status: 500 });
  }
}
