"use client";
import { useState, useEffect } from "react";

interface Settings {
  obsidianPath: string;
  claudeModel: string;
  replyLanguage: string;
  systemPrompt: string;
}

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [settings, setSettings] = useState<Settings>({
    obsidianPath: "",
    claudeModel: "claude-sonnet-4-6",
    replyLanguage: "ja",
    systemPrompt: "",
  });
  const [saving, setSaving] = useState(false);
  const [obsidianStatus, setObsidianStatus] = useState<{
    available: boolean;
    length: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then(setSettings);
    fetch("/api/obsidian").then((r) => r.json()).then(setObsidianStatus);
  }, []);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    if (settings.obsidianPath) {
      const res = await fetch("/api/obsidian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: settings.obsidianPath }),
      });
      const data = await res.json();
      setObsidianStatus(data);
    }
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">設定</h2>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Obsidian */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Obsidian Vaultパス
            </label>
            <input
              value={settings.obsidianPath}
              onChange={(e) => setSettings({ ...settings, obsidianPath: e.target.value })}
              placeholder="/Users/your-name/Documents/Obsidian/Vault"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {obsidianStatus && (
              <p className={`mt-1 text-xs ${obsidianStatus.available ? "text-green-600" : "text-gray-400"}`}>
                {obsidianStatus.available
                  ? `✓ ${obsidianStatus.length.toLocaleString()} 文字のコンテキストが利用可能`
                  : "Vaultが見つかりません"}
              </p>
            )}
          </div>

          {/* Claude Model */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              Claudeモデル
            </label>
            <select
              value={settings.claudeModel}
              onChange={(e) => setSettings({ ...settings, claudeModel: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="claude-opus-4-7">Claude Opus 4.7（最高品質）</option>
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6（バランス）</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5（高速）</option>
            </select>
          </div>

          {/* Reply Language */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              返信言語
            </label>
            <select
              value={settings.replyLanguage}
              onChange={(e) => setSettings({ ...settings, replyLanguage: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="ja">日本語</option>
              <option value="en">English</option>
              <option value="auto">自動（メールに合わせる）</option>
            </select>
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              カスタムシステムプロンプト
            </label>
            <textarea
              value={settings.systemPrompt}
              onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
              placeholder="例：私は○○会社の営業担当です。丁寧かつ簡潔な返信を心がけてください。"
              rows={4}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-800 hover:bg-gray-100 rounded-lg">
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
