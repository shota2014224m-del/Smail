import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";
import { loadObsidianContext } from "./obsidian";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function generateReply(params: {
  accountId: string;
  emailSubject: string;
  emailFrom: string;
  emailBody: string;
  userInstruction?: string;
}): Promise<{ body: string; confidence: number }> {
  const { accountId, emailSubject, emailFrom, emailBody, userInstruction } = params;

  const settings = await prisma.settings.findUnique({ where: { id: "global" } });
  const model = settings?.claudeModel ?? "claude-sonnet-4-6";
  const language = settings?.replyLanguage ?? "ja";
  const customSystemPrompt = settings?.systemPrompt ?? "";

  const obsidianContext = await loadObsidianContext();
  const replyExamples = await fetchReplyExamples(accountId, emailFrom, emailSubject);

  const systemPrompt = buildSystemPrompt({
    language,
    obsidianContext,
    replyExamples,
    customSystemPrompt,
  });

  const userMessage = buildUserMessage({
    emailSubject,
    emailFrom,
    emailBody,
    userInstruction,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as Anthropic.TextBlock).text)
    .join("");

  const parsed = parseReplyResponse(text);
  return parsed;
}

function buildSystemPrompt(params: {
  language: string;
  obsidianContext: string;
  replyExamples: Array<{ originalBody: string; replyBody: string }>;
  customSystemPrompt: string;
}): string {
  const { language, obsidianContext, replyExamples, customSystemPrompt } = params;

  const langInstruction =
    language === "ja"
      ? "返信は日本語で書いてください。"
      : language === "en"
      ? "Write the reply in English."
      : `Write the reply in ${language}.`;

  let prompt = `あなたはメール返信アシスタントです。受け取ったメールに対して、適切で自然な返信を作成してください。
${langInstruction}

返信は以下のJSON形式で出力してください：
{"body": "返信本文", "confidence": 0.85}

confidenceは0.0〜1.0の数値で、返信の適切さへの自信度を表します。`;

  if (customSystemPrompt) {
    prompt += `\n\n## 追加指示\n${customSystemPrompt}`;
  }

  if (obsidianContext) {
    prompt += `\n\n## あなたの個人情報（Obsidianノートより）\n${obsidianContext.slice(0, 8000)}`;
  }

  if (replyExamples.length > 0) {
    prompt += `\n\n## 過去の返信パターン（参考）\n`;
    for (const ex of replyExamples.slice(0, 5)) {
      prompt += `\n元メール:\n${ex.originalBody.slice(0, 500)}\n\n返信:\n${ex.replyBody.slice(0, 500)}\n\n---\n`;
    }
  }

  return prompt;
}

function buildUserMessage(params: {
  emailSubject: string;
  emailFrom: string;
  emailBody: string;
  userInstruction?: string;
}): string {
  const { emailSubject, emailFrom, emailBody, userInstruction } = params;

  let msg = `以下のメールへの返信を作成してください。

件名: ${emailSubject}
送信者: ${emailFrom}

本文:
${emailBody.slice(0, 3000)}`;

  if (userInstruction) {
    msg += `\n\n返信時の指示: ${userInstruction}`;
  }

  return msg;
}

function parseReplyResponse(text: string): { body: string; confidence: number } {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        body: parsed.body ?? text,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      };
    }
  } catch {
    // fall through to raw text
  }
  return { body: text, confidence: 0.7 };
}

async function fetchReplyExamples(
  accountId: string,
  emailFrom: string,
  subject: string
) {
  const patterns = await prisma.replyPattern.findMany({
    where: { accountId },
    orderBy: [{ feedback: "desc" }, { createdAt: "desc" }],
    take: 10,
  });

  const fromDomain = emailFrom.split("@")[1] ?? "";
  const scored = patterns.map((p) => {
    let score = p.feedback;
    if (p.originalFrom.includes(fromDomain)) score += 2;
    if (
      p.originalSubject.toLowerCase().split(" ").some((w) =>
        subject.toLowerCase().includes(w)
      )
    )
      score += 1;
    return { ...p, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((p) => ({ originalBody: p.originalBody, replyBody: p.replyBody }));
}

export async function recordReply(params: {
  accountId: string;
  emailId: string;
  originalSubject: string;
  originalFrom: string;
  originalBody: string;
  replyBody: string;
}) {
  return prisma.replyPattern.create({
    data: {
      accountId: params.accountId,
      emailId: params.emailId,
      originalSubject: params.originalSubject,
      originalFrom: params.originalFrom,
      originalBody: params.originalBody.slice(0, 3000),
      replyBody: params.replyBody,
    },
  });
}

export async function updateReplyFeedback(patternId: string, delta: number) {
  return prisma.replyPattern.update({
    where: { id: patternId },
    data: { feedback: { increment: delta } },
  });
}
