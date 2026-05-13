"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import EmailList from "@/components/EmailList";
import ThreadDetail from "@/components/ThreadDetail";
import ToastContainer from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { useDarkMode } from "@/hooks/useDarkMode";
import AccountSwitcher from "@/components/AccountSwitcher";
import SettingsModal from "@/components/SettingsModal";
import ComposeModal from "@/components/ComposeModal";
import { EmailMessage, AccountInfo } from "@/types";

type NavItem = "inbox" | "priority" | "sent" | "starred" | "trash" | "spam" | "all" | `label:${string}`;
type CategoryTab = "all" | "primary" | "social" | "promotions" | "updates";

const CATEGORY_TABS: { id: CategoryTab; label: string; labelId: string | null }[] = [
  { id: "all", label: "すべて", labelId: null },
  { id: "primary", label: "メイン", labelId: "CATEGORY_PERSONAL" },
  { id: "social", label: "ソーシャル", labelId: "CATEGORY_SOCIAL" },
  { id: "promotions", label: "プロモーション", labelId: "CATEGORY_PROMOTIONS" },
  { id: "updates", label: "最新情報", labelId: "CATEGORY_UPDATES" },
];

interface GmailLabel {
  id: string;
  name: string;
  unread: number;
  color: string | null;
}

const SYSTEM_NAV = [
  { id: "inbox" as NavItem, label: "受信トレイ", icon: "M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
  { id: "priority" as NavItem, label: "優先トレイ", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
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
  const [categoryTab, setCategoryTab] = useState<CategoryTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const { toasts, toast, dismiss } = useToast();
  const { dark, toggle: toggleDark } = useDarkMode();
  const [searchResults, setSearchResults] = useState<EmailMessage[] | null>(null);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      let url = currentNav === "priority" ? "/api/emails/priority" : "/api/emails";
      const params = new URLSearchParams();
      if (refresh && currentNav !== "priority") params.set("refresh", "true");
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

  // Server-side search with 400ms debounce
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/emails/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data.emails ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const filteredEmails = (searchResults ?? emails).filter((email) => {
    if (searchResults) return true; // server already filtered
    if (navItem === "priority") return true; // server already ranked/filtered

    let matchesNav = true;
    if (navItem === "inbox") matchesNav = email.labels.includes("INBOX");
    else if (navItem === "sent") matchesNav = email.labels.includes("SENT");
    else if (navItem === "starred") matchesNav = email.isStarred;
    else if (navItem === "trash") matchesNav = email.labels.includes("TRASH");
    else if (navItem === "spam") matchesNav = email.labels.includes("SPAM");
    else if (typeof navItem === "string" && navItem.startsWith("label:")) {
      matchesNav = email.labels.includes(navItem.slice(6));
    }

    // Category tab filter (only applies to inbox)
    if (navItem === "inbox" && categoryTab !== "all") {
      const tab = CATEGORY_TABS.find((t) => t.id === categoryTab);
      if (tab?.labelId) matchesNav = matchesNav && email.labels.includes(tab.labelId);
    }

    return matchesNav;
  });

  const hasActiveAccount = accounts.some((a) => a.isActive);

  function toggleThreadSelect(threadId: string) {
    setSelectedThreadIds((prev) => {
      const next = new Set(prev);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }

  async function handleBulkAction(action: "archive" | "trash" | "markRead" | "markUnread") {
    if (!selectedThreadIds.size) return;
    // Collect actual email IDs for each selected thread
    const emailIds = filteredEmails
      .filter((e) => selectedThreadIds.has(e.threadId ?? e.id))
      .map((e) => e.id);
    if (!emailIds.length) return;
    setBulkActionLoading(true);
    try {
      await fetch("/api/emails/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds, action }),
      });
      setSelectedThreadIds(new Set());
      loadEmails(true);
      const labels: Record<string, string> = { archive: "アーカイブしました", trash: "ゴミ箱に移動しました", markRead: "既読にしました", markUnread: "未読にしました" };
      toast(labels[action] ?? "操作完了");
    } finally {
      setBulkActionLoading(false);
    }
  }
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
    if (navItem === "priority") return "優先トレイ";
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
    <div className="flex h-screen bg-gray-100 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-gray-100">Smail</span>
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
                    ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-200"
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
                          ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
        <div className="border-t border-gray-100 dark:border-gray-700 p-3 space-y-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center gap-3 flex-1 px-3 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            設定
            </button>
            <button
              onClick={toggleDark}
              title={dark ? "ライトモード" : "ダークモード"}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {dark ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>
          </div>
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
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center gap-4">
          <div className="flex-1 relative">
            {searching ? (
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="メールをGmail検索..."
              className="w-full pl-10 pr-8 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => loadEmails(true)}
            disabled={refreshing}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 disabled:opacity-50"
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
              <div className={`w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col shrink-0 bg-white dark:bg-gray-900 ${selectedEmail ? "hidden lg:flex" : "flex"}`}>
                <div className="border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between px-4 py-3">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {searchResults ? `検索: ${searchQuery}` : getNavLabel()}
                    </h3>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{filteredEmails.length}件</span>
                  </div>
                  {navItem === "inbox" && !searchResults && (
                    <div className="flex border-t border-gray-100 dark:border-gray-700 overflow-x-auto">
                      {CATEGORY_TABS.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setCategoryTab(tab.id)}
                          className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                            categoryTab === tab.id
                              ? "border-blue-500 text-blue-600 dark:text-blue-400"
                              : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {error && (
                  <div className="m-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                    {error}
                  </div>
                )}
                {selectedThreadIds.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border-b border-blue-100">
                    <span className="text-xs text-blue-700 font-medium">{selectedThreadIds.size}件選択中</span>
                    <button
                      onClick={() => handleBulkAction("markRead")}
                      disabled={bulkActionLoading}
                      className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      既読
                    </button>
                    <button
                      onClick={() => handleBulkAction("archive")}
                      disabled={bulkActionLoading}
                      className="text-xs px-2 py-1 rounded bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      アーカイブ
                    </button>
                    <button
                      onClick={() => handleBulkAction("trash")}
                      disabled={bulkActionLoading}
                      className="text-xs px-2 py-1 rounded bg-white border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      ゴミ箱
                    </button>
                    <button
                      onClick={() => setSelectedThreadIds(new Set())}
                      className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                    >
                      解除
                    </button>
                  </div>
                )}
                <EmailList
                  emails={filteredEmails}
                  selectedId={selectedEmail?.id}
                  onSelect={(e) => { setSelectedEmail(e); setSelectedThreadIds(new Set()); }}
                  loading={loading}
                  selectedIds={selectedThreadIds}
                  onToggleSelect={toggleThreadSelect}
                />
              </div>

              {/* Email detail */}
              <div className={`flex-1 min-w-0 ${selectedEmail ? "flex" : "hidden lg:flex"} flex-col bg-white dark:bg-gray-900`}>
                {selectedEmail ? (
                  <ThreadDetail
                    email={selectedEmail}
                    onClose={() => setSelectedEmail(null)}
                    replyOpen={replyOpen}
                    onReplyOpenChange={setReplyOpen}
                    availableLabels={labels}
                    onReplySuccess={() => {
                      setReplyOpen(false);
                      setSelectedEmail(null);
                      loadEmails(true);
                    }}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600">
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
            toast("メールを送信しました", "success");
          }}
        />
      )}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
