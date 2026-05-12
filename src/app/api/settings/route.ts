import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  return NextResponse.json(
    settings ?? {
      id: "global",
      obsidianPath: "",
      claudeModel: "claude-sonnet-4-6",
      replyLanguage: "ja",
      systemPrompt: "",
    }
  );
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  const settings = await prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global", ...data },
    update: data,
  });
  return NextResponse.json(settings);
}
