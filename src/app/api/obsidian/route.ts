import { NextRequest, NextResponse } from "next/server";
import { loadObsidianContext } from "@/lib/obsidian";
import { prisma } from "@/lib/db";
import path from "path";

// 許可するパスのプレフィックス（絶対パスのみ、..を含まない）
function isSafePath(inputPath: string): boolean {
  if (!inputPath || typeof inputPath !== "string") return false;
  if (inputPath.includes("..")) return false;
  if (!path.isAbsolute(inputPath)) return false;
  // 危険なシステムディレクトリを拒否
  const blocked = ["/etc", "/proc", "/sys", "/dev", "/root", "/var/log"];
  if (blocked.some((b) => inputPath.startsWith(b))) return false;
  return true;
}

export async function GET() {
  const context = await loadObsidianContext();
  return NextResponse.json({ available: context.length > 0, length: context.length });
}

export async function POST(request: NextRequest) {
  const { path: vaultPath } = await request.json();

  if (!isSafePath(vaultPath)) {
    return NextResponse.json({ error: "無効なパスです" }, { status: 400 });
  }

  await prisma.settings.upsert({
    where: { id: "global" },
    create: { id: "global", obsidianPath: vaultPath },
    update: { obsidianPath: vaultPath },
  });
  const context = await loadObsidianContext(vaultPath);
  return NextResponse.json({ available: context.length > 0, length: context.length });
}
