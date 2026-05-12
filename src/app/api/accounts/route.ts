import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(request: NextRequest) {
  const { action, accountId } = await request.json();

  if (action === "switch") {
    await prisma.account.updateMany({ data: { isActive: false } });
    await prisma.account.update({
      where: { id: accountId },
      data: { isActive: true },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    await prisma.account.delete({ where: { id: accountId } });
    const remaining = await prisma.account.findFirst();
    if (remaining) {
      await prisma.account.update({
        where: { id: remaining.id },
        data: { isActive: true },
      });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
