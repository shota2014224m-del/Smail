import { NextRequest, NextResponse } from "next/server";
import { loadObsidianContext } from "@/lib/obsidian";
import { prisma } from "@/lib/db";

export async function GET() {
  const context = await loadObsidianContext();
  return NextResponse.json({ available: context.length > 0, length: context.length });
}

export async function POST(request: NextRequest) {
  const { path: vaultPath } = await request.json();
  await prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global", obsidianPath: vaultPath },
    update: { obsidianPath: vaultPath },
  });
  const context = await loadObsidianContext(vaultPath);
  return NextResponse.json({ available: context.length > 0, length: context.length });
}
