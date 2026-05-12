import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const email = await prisma.email.findUnique({ where: { id } });
  if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!email.isRead) {
    await prisma.email.update({ where: { id }, data: { isRead: true } });
  }

  return NextResponse.json({
    ...email,
    labels: JSON.parse(email.labels),
    date: email.date.toISOString(),
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await request.json();
  const updated = await prisma.email.update({
    where: { id },
    data,
  });
  return NextResponse.json({ ...updated, labels: JSON.parse(updated.labels) });
}
