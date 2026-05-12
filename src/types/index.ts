export interface EmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  fromName?: string;
  to: string;
  body: string;
  bodyHtml?: string;
  snippet?: string;
  date: string;
  isRead: boolean;
  isStarred: boolean;
  labels: string[];
  accountId: string;
}

export interface AccountInfo {
  id: string;
  email: string;
  name?: string;
  picture?: string;
  isActive: boolean;
}

export interface ReplyDraft {
  subject: string;
  body: string;
  to: string;
  confidence: number;
}

export interface ObsidianNote {
  path: string;
  content: string;
  title: string;
}
