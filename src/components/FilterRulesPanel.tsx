"use client";
import { useState, useEffect, useCallback } from "react";

interface FilterRule {
  id: string;
  fromContains: string;
  subjectContains: string;
  bodyContains: string;
  addLabelId: string;
  markRead: boolean;
  archive: boolean;
}

interface GmailLabel {
  id: string;
  name: string;
  color: string | null;
}

export default function FilterRulesPanel() {
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    fromContains: "", subjectContains: "", bodyContains: "",
    addLabelId: "", markRead: false, archive: false,
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [rulesRes, labelsRes] = await Promise.all([
      fetch("/api/filters"),
      fetch("/api/labels"),
    ]);
    const rd = await rulesRes.json();
    const ld = await labelsRes.json();
    setRules(rd.rules ?? []);
    setLabels(ld.labels ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAdd() {
    if (!form.fromContains && !form.subjectContains && !form.bodyContains) return;
    setSaving(true);
    await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...form }),
    });
    setForm({ fromContains: "", subjectContains: "", bodyContains: "", addLabelId: "", markRead: false, archive: false });
    setShowAdd(false);
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch("/api/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">フィルター・振り分けルール</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + ルールを追加
        </button>
      </div>

      {showAdd && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-xs font-medium text-gray-600">条件（一つ以上入力）</p>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">差出人に含む</span>
              <input
                value={form.fromContains}
                onChange={(e) => setForm((f) => ({ ...f, fromContains: e.target.value }))}
                placeholder="例: @example.com"
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">件名に含む</span>
              <input
                value={form.subjectContains}
                onChange={(e) => setForm((f) => ({ ...f, subjectContains: e.target.value }))}
                placeholder="例: 請求書"
                className="flex-1 text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
          <p className="text-xs font-medium text-gray-600 pt-1">アクション</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-20 shrink-0">ラベル付け</span>
              <select
                value={form.addLabelId}
                onChange={(e) => setForm((f) => ({ ...f, addLabelId: e.target.value }))}
                className="flex-1 text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">なし</option>
                {labels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.markRead}
                  onChange={(e) => setForm((f) => ({ ...f, markRead: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">既読にする</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.archive}
                  onChange={(e) => setForm((f) => ({ ...f, archive: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">受信トレイをスキップ</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving || (!form.fromContains && !form.subjectContains && !form.bodyContains)}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-xs text-gray-400 py-2">ルールがまだありません</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-start justify-between p-3 border border-gray-200 rounded-xl">
              <div className="space-y-1 text-xs text-gray-700">
                {rule.fromContains && <p><span className="text-gray-400">差出人:</span> {rule.fromContains}</p>}
                {rule.subjectContains && <p><span className="text-gray-400">件名:</span> {rule.subjectContains}</p>}
                <div className="flex flex-wrap gap-2 mt-1">
                  {rule.addLabelId && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                      ラベル: {labels.find((l) => l.id === rule.addLabelId)?.name ?? rule.addLabelId}
                    </span>
                  )}
                  {rule.markRead && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-full">既読</span>}
                  {rule.archive && <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">アーカイブ</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(rule.id)}
                className="p-1 text-gray-400 hover:text-red-500 shrink-0"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
