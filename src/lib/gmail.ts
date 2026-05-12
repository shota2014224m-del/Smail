import { google } from "googleapis";
import { prisma } from "./db";

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback`
  );
}

export function getAuthUrl(state?: string) {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
    state,
  });
}

export async function getAuthenticatedClient(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("Account not found");

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiry?.getTime(),
  });

  oauth2Client.on("tokens", async (tokens) => {
    await prisma.account.update({
      where: { id: accountId },
      data: {
        accessToken: tokens.access_token ?? account.accessToken,
        refreshToken: tokens.refresh_token ?? account.refreshToken,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      },
    });
  });

  return oauth2Client;
}

export async function fetchEmails(accountId: string, maxResults = 50) {
  const auth = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: "v1", auth });

  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults,
    labelIds: ["INBOX"],
  });

  const messages = listRes.data.messages ?? [];
  const emails = [];

  for (const msg of messages.slice(0, 20)) {
    if (!msg.id) continue;

    const existing = await prisma.email.findUnique({ where: { id: msg.id } });
    if (existing) {
      emails.push(existing);
      continue;
    }

    try {
      const detail = await gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      });

      const parsed = parseGmailMessage(detail.data, accountId);
      const saved = await prisma.email.upsert({
        where: { id: parsed.id },
        create: parsed,
        update: parsed,
      });
      emails.push(saved);
    } catch {
      // skip individual message errors
    }
  }

  return emails;
}

function parseGmailMessage(msg: any, accountId: string) {
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

  const fromRaw = getHeader("From");
  const fromMatch = fromRaw.match(/^(?:"?([^"<]*)"?\s*)?<?([^>]+)>?$/);
  const fromName = fromMatch?.[1]?.trim() ?? "";
  const from = fromMatch?.[2]?.trim() ?? fromRaw;

  const body = extractBody(msg.payload);

  return {
    id: msg.id,
    accountId,
    threadId: msg.threadId ?? msg.id,
    subject: getHeader("Subject") || "(件名なし)",
    from,
    fromName: fromName || undefined,
    to: getHeader("To"),
    body: body.text,
    bodyHtml: body.html || undefined,
    snippet: msg.snippet ?? undefined,
    date: new Date(parseInt(msg.internalDate ?? "0")),
    isRead: !msg.labelIds?.includes("UNREAD"),
    isStarred: msg.labelIds?.includes("STARRED") ?? false,
    labels: JSON.stringify(msg.labelIds ?? []),
  };
}

function extractBody(payload: any): { text: string; html: string } {
  if (!payload) return { text: "", html: "" };

  let text = "";
  let html = "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    text = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.mimeType === "text/html" && payload.body?.data) {
    html = Buffer.from(payload.body.data, "base64").toString("utf-8");
  } else if (payload.parts) {
    for (const part of payload.parts) {
      const sub = extractBody(part);
      if (sub.text) text = sub.text;
      if (sub.html) html = sub.html;
    }
  }

  if (!text && html) {
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  return { text, html };
}

export async function sendReply(
  accountId: string,
  originalEmail: { id: string; threadId: string; from: string; subject: string },
  replyBody: string
) {
  const auth = await getAuthenticatedClient(accountId);
  const gmail = google.gmail({ version: "v1", auth });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  const from = account?.email ?? "";

  const subject = originalEmail.subject.startsWith("Re:")
    ? originalEmail.subject
    : `Re: ${originalEmail.subject}`;

  const raw = createRawEmail({
    from,
    to: originalEmail.from,
    subject,
    body: replyBody,
    threadId: originalEmail.threadId,
    inReplyTo: originalEmail.id,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw,
      threadId: originalEmail.threadId,
    },
  });
}

function createRawEmail({
  from,
  to,
  subject,
  body,
  threadId,
  inReplyTo,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo: string;
}) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: <${inReplyTo}>`,
    `References: <${inReplyTo}>`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ];
  return Buffer.from(lines.join("\r\n")).toString("base64url");
}
