"use client";
import { useState, useEffect, useCallback } from "react";
import EmailList from "@/components/EmailList";
import ThreadDetail from "@/components/ThreadDetail";
import AccountSwitcher from "@/components/AccountSwitcher";
import SettingsModal from "@/components/SettingsModal";
import ComposeModal from "@/components/ComposeModal";
import { EmailMessage, AccountInfo } from "@/types";

type NavItem = "inbox" | "sent" | "starred" | "trash" | "spam" | "all" | `label:${string}`;

interface GmailLabel {
  id: string;
  name: string;
  unread: number;
  color: string | null;
}

const SYSTEM_NAV = [
  { id: "inbox" as NavItem, label: "受信トレイ", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "starred" as NavItem, label: "スター付き", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { id: "sent" as NavItem, label: "送信済み", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
  { id: "all" as NavItem, label: "すべてのメール", icon: "M3 7h18M3 12h18M3 17h18" },
  { id: "trash" as NavItem, label: "ゴミ箱", icon: "M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" },
  { id: "spam" as NavItem, label: "迷惑メール", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
];

export default function Home() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [navItem, setNavItem] = useState<NavItem>("inbox");
  const [showSettings, setShowSettings] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
    return data as AccountInfo[];
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const res = await fetch("/api/labels");
      const data = await res.json();
      setLabels(data.labels ?? []);
    } catch { /* silent */ }
  }, []);

  const loadEmails = useCallback(async (refresh = false, nav?: NavItem) => {
    const currentNav = nav ?? navItem;
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      let url = "/api/emails";
      const params = new URLSearchParams();
      if (refresh) params.set("refresh", "true");
      if (currentNav === "trash") params.set("label", "TRASH");
      else if (currentNav === "spam") params.set("label", "SPAM");
      else if (typeof currentNav === "string" && currentNav.startsWith("label:")) {
        params.set("label", currentNav.slice(6));
      }
      if (params.toString()) url += "?" + params.toString();

      const res = await fetch(url);
      const data = await res.json();
      if (data.emails) setEmails(data.emails);
    } catch {
      setError("メールの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navItem]);

  useEffect(() => {
    loadAccounts().then((accs) => {
      if (accs.length > 0) {
        loadEmails();
        loadLabels();
      }
    });
  }, [loadAccounts, loadEmails, loadLabels]);

  function handleNavChange(item: NavItem) {
    setNavItem(item);
    setSelectedEmail(null);
    loadEmails(true, item);
  }

  async function handleSwitchAccount(id: string) {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", accountId: id }),
    });
    await loadAccounts();
    setSelectedEmail(null);
    loadLabels();
    loadEmails(true);
  }

  async function handleDeleteAccount(id: string) {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", accountId: id }),
    });
    await loadAccounts();
    await loadEmails();
  }

  function handleAddAccount() {
    window.location.href = "/api/auth";
  }

  const filteredEmails = emails.filter((email) => {
    const matchesSearch =
      !searchQuery ||
      email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
      email.body.toLowerCase().includes(searchQuery.toLowerCase());

    let matchesNav = true;
    if (navItem === "inbox") matchesNav = email.labels.includes("INBOX");
    else if (navItem === "sent") matchesNav = email.labels.includes("SENT");
    else if (navItem === "starred") matchesNav = email.isStarred;
    else if (navItem === "trash") matchesNav = email.labels.includes("TRASH");
    else if (navItem === "spam") matchesNav = email.labels.includes("SPAM");
    else if (typeof navItem === "string" && navItem.startsWith("label:")) {
      matchesNav = email.labels.includes(navItem.slice(6));
    }

    return matchesSearch && matchesNav;
  });

  const hasActiveAccount = accounts.some((a) => a.isActive);
  const unreadCount = emails.filter((e) => !e.isRead && e.labels.includes("INBOX")).length;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA";

      if (meta && e.key === "n" && !isInput) {
        e.preventDefault();
        setShowCompose(true);
        return;
      }
      if (meta && e.key === "r" && !isInput && selectedEmail) {
        e.preventDefault();
        setReplyOpen(true);
        return;
      }
      if (e.key === "Escape") {
        if (showCompose) { setShowCompose(false); return; }
        if (showSettings) { setShowSettings(false); return; }
        if (selectedEmail) { setSelectedEmail(null); return; }
        return;
      }
      if (e.key === "ArrowDown" && !isInput) {
        e.preventDefault();
        setSelectedEmail((prev) => {
          const idx = prev ? filteredEmails.findIndex((m) => m.id === prev.id) : -1;
          return filteredEmails[idx + 1] ?? prev;
        });
        return;
      }
      if (e.key === "ArrowUp" && !isInput) {
        e.preventDefault();
        setSelectedEmail((prev) => {
          const idx = prev ? filteredEmails.findIndex((m) => m.id === prev.id) : 0;
          return filteredEmails[Math.max(0, idx - 1)] ?? prev;
        });
        return;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedEmail, showCompose, showSettings, filteredEmails]);

  function getNavLabel() {
    if (navItem === "inbox") return "受信トレイ";
    if (navItem === "sent") return "送信済み";
    if (navItem === "starred") return "スター付き";
    if (navItem === "trash") return "ゴミ箱";
    if (navItem === "spam") return "迷惑メール";
    if (navItem === "all") return "すべてのメール";
    if (typeof navItem === "string" && navItem.startsWith("label:")) {
      const labelId = navItem.slice(6);
      return labels.find((l) => l.id === labelId)?.name ?? labelId;
    }
    return "";
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Smail</span>
            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">AI</span>
          </div>
        </div>

        {/* 作成ボタン */}
        <div className="px-3 py-3">
          <button
            onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            作成
          </button>
        </div>

        {/* スクロール可能なナビ */}
        <div className="flex-1 overflow-y-auto">
          {/* システムフォルダ */}
          <nav className="px-3 py-1 space-y-0.5">
            {SYSTEM_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavChange(item.id)}
                className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                  navItem === item.id
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                </svg>
                <span className="flex-1 text-left">{item.label}</span>
                {item.id === "inbox" && unreadCount > 0 && (
                  <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-medium">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* ラベル */}
          {labels.length > 0 && (
            <div className="px-3 py-2 mt-1">
              <button
                onClick={() => setShowLabels(!showLabels)}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
              >
                <svg className={`w-3 h-3 transition-transform ${showLabels ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                ラベル
              </button>
              {showLabels && (
                <div className="mt-1 space-y-0.5">
                  {labels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => handleNavChange(`label:${label.id}`)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
                        navItem === `label:${label.id}`
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: label.color ?? "#9CA3AF" }}
                      />
                      <span className="flex-1 text-left truncate">{label.name}</span>
                      {label.unread > 0 && (
                        <span className="text-xs text-gray-500 font-medium">{label.unread}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings + Account */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            設定
          </button>
          {accounts.length > 0 && (
            <AccountSwitcher
              accounts={accounts}
              onSwitch={handleSwitchAccount}
              onAddAccount={handleAddAccount}
              onDelete={handleDeleteAccount}
            />
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="メールを検索..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 text-gray-900 placeholder-gray-400"
            />
          </div>
          <button
            onClick={() => loadEmails(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-50"
            title="更新"
          >
            <svg className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* ショートカットヘルプ */}
          <div className="group relative">
            <button className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.1.9-2 2-2s2 .9 2 2-.9 2-2 2m0 4h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <div className="absolute right-0 top-full mt-1 w-56 bg-gray-900 text-white text-xs rounded-xl shadow-lg p-3 hidden group-hover:block z-50">
              <p className="font-semibold mb-2 text-gray-300">キーボードショートカット</p>
              <div className="space-y-1.5">
                {[
                  ["⌘+N", "新規メール作成"],
                  ["⌘+R", "返信（メール選択中）"],
                  ["⌘+Enter", "生成 / 送信"],
                  ["↑ / ↓", "メール移動"],
                  ["Escape", "閉じる"],
                ].map(([key, desc]) => (
                  <div key={key} className="flex items-center justify-between gap-3">
                    <span className="text-gray-400">{desc}</span>
                    <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-gray-200 font-mono">{key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          {!hasActiveAccount ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Smailへようこそ</h2>
              <p className="text-gray-500 mb-8 max-w-md">
                Claudeが過去の返信パターンを学習し、あなたらしいメール返信を自動生成します。
                まずGmailアカウントを連携してください。
              </p>
              <button
                onClick={handleAddAccount}
                className="flex items-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Googleアカウントを連携する
              </button>
            </div>
          ) : (
            <>
              {/* Email list */}
              <div className={`w-96 border-r border-gray-200 flex flex-col shrink-0 bg-white ${selectedEmail ? "hidden lg:flex" : "flex"}`}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 text-sm">{getNavLabel()}</h3>
                    <span className="text-xs text-gray-500">{filteredEmails.length}件</span>
                  </div>
                </div>
                {error && (
                  <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    {error}
                  </div>
                )}
                <EmailList
                  emails={filteredEmails}
                  selectedId={selectedEmail?.id}
                  onSelect={setSelectedEmail}
                  loading={loading}
                />
              </div>

              {/* Email detail */}
              <div className={`flex-1 min-w-0 ${selectedEmail ? "flex" : "hidden lg:flex"} flex-col bg-white`}>
                {selectedEmail ? (
                  <ThreadDetail
                    email={selectedEmail}
                    onClose={() => setSelectedEmail(null)}
                    replyOpen={replyOpen}
                    onReplyOpenChange={setReplyOpen}
                    onReplySuccess={() => {
                      setReplyOpen(false);
                      setSelectedEmail(null);
                      loadEmails(true);
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-20 h-20 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">メールを選択してください</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSent={() => {
            setShowCompose(false);
            loadEmails(true);
          }}
        />
      )}
    </div>
  );
}
