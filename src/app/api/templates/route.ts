import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const templates = await prisma.template.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    if (!body.name?.trim() || !body.body?.trim()) {
      return NextResponse.json({ error: "名前と本文は必須です" }, { status: 400 });
    }
    const template = await prisma.template.create({
      data: { name: body.name.trim(), subject: body.subject?.trim() ?? "", body: body.body.trim() },
    });
    return NextResponse.json({ template });
  }

  if (action === "update") {
    const template = await prisma.template.update({
      where: { id: body.id },
      data: {
        name: body.name?.trim(),
        subject: body.subject?.trim(),
        body: body.body?.trim(),
      },
    });
    return NextResponse.json({ template });
  }

  if (action === "delete") {
    await prisma.template.delete({ where: { id: body.id } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "不明なアクション" }, { status: 400 });
}
