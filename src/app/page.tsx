"use client";
import { useState, useEffect, useCallback } from "react";
import EmailList from "@/components/EmailList";
import EmailDetail from "@/components/EmailDetail";
import AccountSwitcher from "@/components/AccountSwitcher";
import SettingsModal from "@/components/SettingsModal";
import { EmailMessage, AccountInfo } from "@/types";

type NavItem = "inbox" | "sent" | "starred" | "all";

export default function Home() {
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [navItem, setNavItem] = useState<NavItem>("inbox");
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data);
    return data as AccountInfo[];
  }, []);

  const loadEmails = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/emails${refresh ? "?refresh=true" : ""}`);
      const data = await res.json();
      if (data.emails) setEmails(data.emails);
    } catch {
      setError("メールの読み込みに失敗しました");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts().then((accs) => {
      if (accs.length > 0) loadEmails();
    });
  }, [loadAccounts, loadEmails]);

  async function handleSwitchAccount(id: string) {
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "switch", accountId: id }),
    });
    await loadAccounts();
    setSelectedEmail(null);
    await loadEmails(true);
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

    const matchesNav =
      navItem === "all" ||
      (navItem === "inbox" && email.labels.includes("INBOX")) ||
      (navItem === "sent" && email.labels.includes("SENT")) ||
      (navItem === "starred" && email.isStarred);

    return matchesSearch && matchesNav;
  });

  const hasActiveAccount = accounts.some((a) => a.isActive);
  const unreadCount = emails.filter((e) => !e.isRead && e.labels.includes("INBOX")).length;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-gray-100">
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

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {(
            [
              { id: "inbox", label: "受信トレイ", icon: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z", badge: unreadCount },
              { id: "starred", label: "スター付き", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
              { id: "sent", label: "送信済み", icon: "M12 19l9 2-9-18-9 18 9-2zm0 0v-8" },
              { id: "all", label: "すべてのメール", icon: "M3 7h18M3 12h18M3 17h18" },
            ] as Array<{ id: NavItem; label: string; icon: string; badge?: number }>
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setNavItem(item.id)}
              className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                navItem === item.id
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 font-medium">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Settings + Account */}
        <div className="border-t border-gray-100 p-3 space-y-2">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
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
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
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
        </header>

        <div className="flex-1 flex min-h-0">
          {/* No account state */}
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
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {navItem === "inbox" && "受信トレイ"}
                      {navItem === "sent" && "送信済み"}
                      {navItem === "starred" && "スター付き"}
                      {navItem === "all" && "すべてのメール"}
                    </h3>
                    <span className="text-xs text-gray-400">{filteredEmails.length}件</span>
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
                  <EmailDetail
                    email={selectedEmail}
                    onClose={() => setSelectedEmail(null)}
                    onReplySuccess={() => {
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
    </div>
  );
}
