"use client";
import { useState, useEffect, useCallback } from "react";
import type { Template } from "./TemplatePicker";

export default function TemplatesPanel() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", subject: "", body: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/templates");
    const data = await res.json();
    setTemplates(data.templates ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(t: Template) {
    setEditingId(t.id);
    setForm({ name: t.name, subject: t.subject, body: t.body });
    setShowAdd(false);
  }

  function startAdd() {
    setShowAdd(true);
    setEditingId(null);
    setForm({ name: "", subject: "", body: "" });
  }

  async function handleSave() {
    if (!form.name.trim() || !form.body.trim()) return;
    setSaving(true);
    if (editingId) {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: editingId, ...form }),
      });
      setEditingId(null);
    } else {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...form }),
      });
      setShowAdd(false);
    }
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  const isEditing = showAdd || editingId !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">テンプレート管理</h3>
        {!isEditing && (
          <button
            onClick={startAdd}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            + テンプレートを追加
          </button>
        )}
      </div>

      {isEditing && (
        <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
          <p className="text-xs font-medium text-gray-600">{editingId ? "テンプレートを編集" : "新規テンプレート"}</p>
          <div>
            <label className="block text-xs text-gray-500 mb-1">テンプレート名 <span className="text-red-400">*</span></label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="例: 会議の依頼"
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">件名（省略可）</label>
            <input
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              placeholder="例: 打ち合わせのご依頼"
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">本文 <span className="text-red-400">*</span></label>
            <textarea
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="テンプレートの本文を入力..."
              rows={5}
              className="w-full text-sm text-gray-900 placeholder-gray-400 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.body.trim()}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "保存中..." : "保存"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setEditingId(null); }}
              className="px-4 py-2 text-gray-600 text-sm rounded-lg hover:bg-gray-100"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {templates.length === 0 && !isEditing ? (
        <p className="text-xs text-gray-400 py-2">テンプレートがまだありません</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{t.name}</p>
                  {t.subject && <p className="text-xs text-gray-500 mt-0.5">件名: {t.subject}</p>}
                  <p className="text-xs text-gray-400 mt-1 truncate">{t.body.slice(0, 80)}{t.body.length > 80 ? "..." : ""}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(t)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
