import fs from "fs";
import path from "path";
import { prisma } from "./db";

export async function loadObsidianContext(vaultPath?: string): Promise<string> {
  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const resolvedPath = vaultPath ?? settings?.obsidianPath ?? process.env.OBSIDIAN_VAULT_PATH ?? "";

  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return "";
  }

  const notes = await readMarkdownFiles(resolvedPath, 30);
  if (notes.length === 0) return "";

  const context = notes
    .map((n) => `## ${n.title}\n${n.content.slice(0, 2000)}`)
    .join("\n\n---\n\n");

  return context;
}

async function readMarkdownFiles(
  dir: string,
  maxFiles: number
): Promise<Array<{ title: string; content: string; path: string }>> {
  const results: Array<{ title: string; content: string; path: string }> = [];

  function walk(currentDir: string) {
    if (results.length >= maxFiles) return;
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxFiles) break;
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".md")) {
          try {
            const content = fs.readFileSync(fullPath, "utf-8");
            const title = entry.name.replace(".md", "");
            results.push({ title, content, path: fullPath });
          } catch {
            // skip unreadable files
          }
        }
      }
    } catch {
      // skip unreadable directories
    }
  }

  walk(dir);
  return results;
}
