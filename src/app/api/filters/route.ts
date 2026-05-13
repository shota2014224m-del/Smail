import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ rules: [] });

  const rules = await prisma.filterRule.findMany({
    where: { accountId: activeAccount.id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  const activeAccount = await prisma.account.findFirst({ where: { isActive: true } });
  if (!activeAccount) return NextResponse.json({ error: "アカウントが見つかりません" }, { status: 401 });

  if (action === "delete") {
    await prisma.filterRule.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  if (action === "create") {
    const rule = await prisma.filterRule.create({
      data: {
        accountId: activeAccount.id,
        fromContains: body.fromContains ?? "",
        subjectContains: body.subjectContains ?? "",
        bodyContains: body.bodyContains ?? "",
        addLabelId: body.addLabelId ?? "",
        markRead: body.markRead ?? false,
        archive: body.archive ?? false,
      },
    });
    return NextResponse.json({ rule });
  }

  return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
}
