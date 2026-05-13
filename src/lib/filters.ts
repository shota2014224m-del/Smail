import { prisma } from "./db";
import { google } from "googleapis";
import { getAuthenticatedClient } from "./gmail";

interface EmailInput {
  id: string;
  accountId: string;
  subject: string;
  from: string;
  body: string;
  labels: string;
}

export async function applyFilterRules(emails: EmailInput[]) {
  if (!emails.length) return;

  const rules = await prisma.filterRule.findMany({
    where: { accountId: emails[0].accountId },
  });

  if (!rules.length) return;

  for (const email of emails) {
    const currentLabels: string[] = JSON.parse(email.labels);

    for (const rule of rules) {
      const matchesFrom =
        !rule.fromContains || email.from.toLowerCase().includes(rule.fromContains.toLowerCase());
      const matchesSubject =
        !rule.subjectContains || email.subject.toLowerCase().includes(rule.subjectContains.toLowerCase());
      const matchesBody =
        !rule.bodyContains || email.body.toLowerCase().includes(rule.bodyContains.toLowerCase());

      if (!matchesFrom || !matchesSubject || !matchesBody) continue;

      const addLabels: string[] = [];
      const removeLabels: string[] = [];

      if (rule.addLabelId && !currentLabels.includes(rule.addLabelId)) {
        addLabels.push(rule.addLabelId);
      }
      if (rule.markRead && currentLabels.includes("UNREAD")) {
        removeLabels.push("UNREAD");
      }
      if (rule.archive && currentLabels.includes("INBOX")) {
        removeLabels.push("INBOX");
      }

      if (!addLabels.length && !removeLabels.length) continue;

      try {
        const auth = await getAuthenticatedClient(email.accountId);
        const gmail = google.gmail({ version: "v1", auth });

        await gmail.users.messages.modify({
          userId: "me",
          id: email.id,
          requestBody: { addLabelIds: addLabels, removeLabelIds: removeLabels },
        });

        const updated = [
          ...currentLabels.filter((l) => !removeLabels.includes(l)),
          ...addLabels,
        ];
        await prisma.email.update({
          where: { id: email.id },
          data: {
            labels: JSON.stringify(updated),
            isRead: rule.markRead ? true : undefined,
          },
        });
      } catch {
        // skip rule application errors silently
      }
    }
  }
}
