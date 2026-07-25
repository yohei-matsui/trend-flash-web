"use client";

import Image from "next/image";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Eye, EyeOff, Copy, Check, Plus, Trash2, Pencil, X, Zap, Download } from "lucide-react";
import { TrendVideoItem, TrendResponse } from "@/app/api/trend/route";

/* ═══════════════════════════════════════════════════════════════════════
   業界トレンド速報メーカー
   ジャンル（＝担当クライアントの業界）を選ぶだけで、直近の新規・伸びている
   YouTube動画を洗い出し、クライアントに送る「トレンド速報」を自動生成する。
════════════════════════════════════════════════════════════════════════ */

interface Preset {
  id: string;
  name: string;
  keywords: string[];
}

const DEFAULT_PRESETS: Preset[] = [
  { id: "p-seikei", name: "整形外科・クリニック", keywords: ["整形外科 治療", "腰痛 改善", "肩こり ストレッチ"] },
  { id: "p-keiei", name: "経営・ビジネス", keywords: ["経営者 マインド", "中小企業 経営", "組織づくり"] },
  { id: "p-sustena", name: "サステナ・SDGs", keywords: ["サステナビリティ 企業", "SDGs 取り組み", "環境 ビジネス"] },
  { id: "p-youtube", name: "動画編集・YouTube運用", keywords: ["YouTube 運用 コツ", "動画編集 テクニック", "ショート動画 バズ"] },
];

const LS_KEY = "tf-api-key";
const LS_PRESETS = "tf-presets";

function fmt(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}億`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}千`;
  return n.toLocaleString();
}
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.32)" }}>
      {children}
    </p>
  );
}

/* 速報テキスト（Chatwork用）を生成 */
function buildReport(genre: string, videos: TrendVideoItem[], days: number, topN: number): string {
  const now = new Date();
  const month = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, "0")}月`;
  const lines: string[] = [];
  lines.push(`[info][title]📊 業界トレンド速報（${genre} / ${month}）[/title]`);
  lines.push(`直近${days}日で新規・伸びている動画を ${Math.min(topN, videos.length)} 本ピックアップしました。`);
  lines.push("");
  videos.slice(0, topN).forEach((v, i) => {
    const meta = v.spreadRate >= 1
      ? `${v.viewCount.toLocaleString()}回 / 拡散率${v.spreadRate.toFixed(1)}倍`
      : `${v.viewCount.toLocaleString()}回`;
    lines.push(`${i + 1}. ${v.title}`);
    lines.push(`　${v.channelName}（${meta}）`);
    lines.push(`　https://www.youtube.com/watch?v=${v.id}`);
  });
  lines.push("");
  lines.push("最近の伸び傾向として参考になりそうなものを共有します。");
  lines.push("[/info]");
  return lines.join("\n");
}

function exportCsv(genre: string, videos: TrendVideoItem[]) {
  const header = ["#", "タイトル", "チャンネル", "登録者数", "公開日", "再生回数", "CH中央値", "拡散率", "キーワード", "URL"];
  const rows = videos.map((v, i) => [
    i + 1,
    `"${v.title.replace(/"/g, '""')}"`,
    `"${v.channelName.replace(/"/g, '""')}"`,
    v.subscriberCount,
    fmtDate(v.publishedAt),
    v.viewCount,
    Math.round(v.channelBaseline),
    v.spreadRate.toFixed(2),
    `"${v.keyword}"`,
    `https://www.youtube.com/watch?v=${v.id}`,
  ]);
  const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `trend_${genre}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(DEFAULT_PRESETS);
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_PRESETS[0].id);

  // フィルタ
  const [days, setDays] = useState(30);
  const [minViews, setMinViews] = useState(10000);
  const [minSpread, setMinSpread] = useState(1.0);
  const [excludeShorts, setExcludeShorts] = useState(true);
  const [topN, setTopN] = useState(5);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TrendResponse | null>(null);
  const [copied, setCopied] = useState(false);

  // プリセット編集モーダル
  const [editing, setEditing] = useState<Preset | null>(null);

  // 初期ロード（localStorage）
  useEffect(() => {
    try {
      const k = localStorage.getItem(LS_KEY);
      if (k) setApiKey(k);
      const p = localStorage.getItem(LS_PRESETS);
      if (p) {
        const parsed = JSON.parse(p) as Preset[];
        if (Array.isArray(parsed) && parsed.length) {
          setPresets(parsed);
          setSelectedId(parsed[0].id);
        }
      }
    } catch { /* ignore */ }
  }, []);

  const persistKey = useCallback((k: string) => {
    setApiKey(k);
    try { localStorage.setItem(LS_KEY, k); } catch { /* ignore */ }
  }, []);

  const persistPresets = useCallback((next: Preset[]) => {
    setPresets(next);
    try { localStorage.setItem(LS_PRESETS, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  const selected = presets.find((p) => p.id === selectedId) ?? presets[0];

  const handleGenerate = useCallback(async () => {
    if (!apiKey.trim() || !selected) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/trend", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-youtube-api-key": apiKey.trim() },
        body: JSON.stringify({
          genre: selected.name,
          keywords: selected.keywords,
          daysWithin: days,
          maxPerKeyword: 25,
          region: "japan",
          order: "viewCount",
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "エラーが発生しました"); return; }
      setResult(json as TrendResponse);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }, [apiKey, selected, days]);

  // クライアント側フィルタ
  const filtered = useMemo(() => {
    if (!result) return [];
    return result.videos.filter((v) => {
      if (v.viewCount < minViews) return false;
      if (minSpread > 0 && v.spreadRate < minSpread) return false;
      if (excludeShorts && v.durationSeconds > 0 && v.durationSeconds <= 60) return false;
      return true;
    });
  }, [result, minViews, minSpread, excludeShorts]);

  const report = useMemo(
    () => (result ? buildReport(result.genre, filtered, days, topN) : ""),
    [result, filtered, days, topN]
  );

  const canGenerate = apiKey.trim() && selected && !loading;

  return (
    <div className="lg-base">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="lg-header sticky top-0 z-20 px-6 py-3.5 flex items-center gap-3">
        <Image src="/eaval-logo.png" alt="EAVAL" width={30} height={30} className="flex-shrink-0 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: "#111827" }}>業界トレンド速報メーカー</span>
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>by 株式会社EAVAL</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {/* ── Overview ─────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-4 text-center">
          <h1 className="text-xl font-bold leading-relaxed" style={{ color: "#111827" }}>
            ジャンルを選ぶだけで、<span style={{ color: "#e63946" }}>クライアントに送るトレンド速報</span>が完成
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
            担当業界を選ぶと、<strong style={{ color: "#374151" }}>直近{days}日で新規・伸びているYouTube動画</strong>を自動で洗い出します。<br />
            各チャンネルの実力を基準にした「<strong style={{ color: "#374151" }}>拡散率</strong>」で、規模に関係なく本当に伸びた動画を発見。<br />
            そのまま<strong style={{ color: "#374151" }}>Chatworkに貼れる速報テキスト</strong>をワンクリックで生成します。
          </p>
          <div className="lg-amber px-4 py-3 text-xs text-left" style={{ color: "#78350f" }}>
            <strong>この仕組みの目的：</strong>
            日々の定例以外の細やかなコミュニケーションとして「業界トレンド速報」を送り、クライアントとの関係性を深めます。誰でも同じ品質で・月次で続けられるように仕組み化しています。
          </div>
        </div>

        {/* ── API Key ──────────────────────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-3">
          <SectionLabel>API設定</SectionLabel>
          <label className="text-sm font-medium" style={{ color: "#374151" }}>YouTube Data API キー</label>
          <div className="relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => persistKey(e.target.value)}
              placeholder="AIza..."
              className="lg-input w-full px-3 py-2.5 pr-10 text-sm"
              style={{ color: "#111827" }}
            />
            <button type="button" onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(0,0,0,0.3)" }}>
              {showKey ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs" style={{ color: "rgba(0,0,0,0.38)" }}>
            キーはこのブラウザにのみ保存されます（サーバーには送られません）。
            <a href="https://note.com/yuki_tech/n/na82ad826df1f" target="_blank" rel="noopener noreferrer"
              className="underline decoration-dashed underline-offset-2 hover:opacity-70 ml-1">取得方法はこちら</a>
          </p>
        </div>

        {/* ── Genre presets ────────────────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-4">
          <div className="flex items-center justify-between">
            <SectionLabel>ジャンル（担当業界）を選ぶ</SectionLabel>
            <button type="button" onClick={() => setEditing({ id: `p-${Date.now()}`, name: "", keywords: [""] })}
              className="lg-chip flex items-center gap-1 px-3 py-1 text-xs font-medium">
              <Plus className="h-3.5 w-3.5" /> ジャンルを追加
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <div key={p.id} className={`group relative flex items-center ${selectedId === p.id ? "lg-chip-on" : "lg-chip"}`}
                style={{ borderRadius: 9999 }}>
                <button type="button" onClick={() => setSelectedId(p.id)}
                  className="pl-3 pr-1 py-1 text-xs font-medium">{p.name || "（無名）"}</button>
                <button type="button" onClick={() => setEditing(p)} title="編集"
                  className="px-1 opacity-60 hover:opacity-100"><Pencil className="h-3 w-3" /></button>
                <button type="button" title="削除"
                  onClick={() => { const next = presets.filter((x) => x.id !== p.id); if (next.length) { persistPresets(next); if (selectedId === p.id) setSelectedId(next[0].id); } }}
                  className="pr-2 pl-0.5 opacity-60 hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
          {selected && (
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.4)" }}>
              検索キーワード: {selected.keywords.map((k) => `「${k}」`).join(" ")}
            </p>
          )}
        </div>

        {/* ── Filters ──────────────────────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-5">
          <SectionLabel>条件</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>対象期間</label>
              <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="lg-input w-full px-2 py-2 text-sm" style={{ color: "#111827" }}>
                <option value={7}>直近7日</option>
                <option value={14}>直近14日</option>
                <option value={30}>直近30日</option>
                <option value={60}>直近60日</option>
                <option value={90}>直近90日</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>最低再生数</label>
              <select value={minViews} onChange={(e) => setMinViews(Number(e.target.value))} className="lg-input w-full px-2 py-2 text-sm" style={{ color: "#111827" }}>
                <option value={0}>指定なし</option>
                <option value={1000}>1,000回以上</option>
                <option value={10000}>1万回以上</option>
                <option value={50000}>5万回以上</option>
                <option value={100000}>10万回以上</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>最低拡散率</label>
              <select value={minSpread} onChange={(e) => setMinSpread(Number(e.target.value))} className="lg-input w-full px-2 py-2 text-sm" style={{ color: "#111827" }}>
                <option value={0}>指定なし</option>
                <option value={1}>1.0倍以上</option>
                <option value={1.5}>1.5倍以上</option>
                <option value={2}>2.0倍以上</option>
                <option value={3}>3.0倍以上</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>速報の本数</label>
              <select value={topN} onChange={(e) => setTopN(Number(e.target.value))} className="lg-input w-full px-2 py-2 text-sm" style={{ color: "#111827" }}>
                <option value={3}>上位3本</option>
                <option value={5}>上位5本</option>
                <option value={10}>上位10本</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "#374151" }}>
            <input type="checkbox" checked={excludeShorts} onChange={(e) => setExcludeShorts(e.target.checked)} style={{ accentColor: "#e63946" }} />
            ショート動画（60秒以下）を除外する
          </label>
          <button type="button" onClick={handleGenerate} disabled={!canGenerate}
            className="lg-search-btn w-full flex items-center justify-center gap-2 py-3.5 text-sm font-semibold text-white">
            <Zap className="h-4 w-4" />
            {loading ? "速報を作成中…" : "トレンド速報を作成"}
          </button>
        </div>

        {/* ── Error / Loading ─────────────────────────────────────────── */}
        {error && <div className="lg-red-info px-4 py-3 text-sm" style={{ color: "#b91c1c" }}>{error}</div>}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3" style={{ color: "rgba(0,0,0,0.3)" }}>
            <svg className="animate-spin h-7 w-7" viewBox="0 0 24 24" fill="none" style={{ color: "#e63946" }}>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span className="text-sm">YouTubeから直近の動画を集計中…</span>
          </div>
        )}

        {/* ── Report + Results ────────────────────────────────────────── */}
        {result && (
          <>
            {/* 速報テキスト */}
            <div className="lg-panel p-6 space-y-3">
              <div className="flex items-center justify-between">
                <SectionLabel>速報テキスト（Chatworkにそのまま貼れます）</SectionLabel>
                <button type="button"
                  onClick={() => { navigator.clipboard.writeText(report); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  disabled={filtered.length === 0}
                  className="lg-chip-on flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40">
                  {copied ? <><Check className="h-3.5 w-3.5" /> コピーしました</> : <><Copy className="h-3.5 w-3.5" /> コピー</>}
                </button>
              </div>
              {filtered.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "rgba(0,0,0,0.35)" }}>
                  条件に合う動画がありませんでした。期間を延ばす・最低再生数や拡散率を下げてお試しください。
                </p>
              ) : (
                <pre className="text-xs leading-relaxed whitespace-pre-wrap rounded-xl p-4"
                  style={{ background: "rgba(0,0,0,0.03)", color: "#374151", fontFamily: "inherit" }}>{report}</pre>
              )}
            </div>

            {/* 一覧テーブル */}
            {filtered.length > 0 && (
              <div className="lg-panel overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 lg-divider">
                  <span className="text-sm" style={{ color: "rgba(0,0,0,0.4)" }}>
                    {result.genre}：{filtered.length}件（取得 {result.totalFetched}件中）
                  </span>
                  <button type="button" onClick={() => exportCsv(result.genre, filtered)}
                    className="lg-csv-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ color: "#4b5563" }}>
                    <Download className="h-3.5 w-3.5" /> CSV
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="text-xs" style={{ borderBottom: "1px solid rgba(0,0,0,0.05)", background: "rgba(0,0,0,0.015)", color: "#9ca3af" }}>
                        <th className="px-4 py-3 text-left w-10">#</th>
                        <th className="px-4 py-3 text-left">動画</th>
                        <th className="px-4 py-3 text-left whitespace-nowrap">チャンネル</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">公開日</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">再生回数</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">拡散率</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((v, i) => (
                        <tr key={v.id} className="lg-row" style={{ borderTop: "1px solid rgba(0,0,0,0.035)" }}>
                          <td className="px-4 py-3 text-xs" style={{ color: "rgba(0,0,0,0.25)" }}>{i + 1}</td>
                          <td className="px-4 py-3">
                            <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3">
                              <img src={v.thumbnailUrl} alt="" className="h-10 w-[72px] object-cover rounded-lg flex-shrink-0" style={{ background: "rgba(0,0,0,0.06)" }} />
                              <span className="line-clamp-2 leading-snug" style={{ color: "#1f2937" }}>{v.title}</span>
                            </a>
                          </td>
                          <td className="px-4 py-3 text-xs whitespace-nowrap max-w-[120px] truncate" style={{ color: "#9ca3af" }}>{v.channelName}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap text-xs" style={{ color: "#6b7280" }}>{fmtDate(v.publishedAt)}</td>
                          <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: "#111827" }}>{fmt(v.viewCount)}</td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${
                              v.spreadRate >= 3 ? "lg-badge-red" : v.spreadRate >= 1.5 ? "lg-badge-orange" : v.spreadRate >= 1 ? "lg-badge-yellow" : "lg-badge-gray"
                            }`}>{v.spreadRate > 0 ? `${v.spreadRate.toFixed(2)}x` : "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Preset editor modal ────────────────────────────────────────── */}
      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
          onClick={() => setEditing(null)}>
          <div className="w-full max-w-md rounded-3xl p-7 space-y-5"
            style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(32px)", WebkitBackdropFilter: "blur(32px)", boxShadow: "inset 0 1px 1px rgba(255,255,255,0.95), 0 24px 64px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-bold text-base" style={{ color: "#111827" }}>
                {presets.some((p) => p.id === editing.id) ? "ジャンルを編集" : "ジャンルを追加"}
              </p>
              <button type="button" onClick={() => setEditing(null)} style={{ color: "rgba(0,0,0,0.3)" }}><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>ジャンル名（担当業界・クライアント名など）</label>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="例: 整形外科・クリニック" className="lg-input w-full px-3 py-2 text-sm" style={{ color: "#111827" }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: "#374151" }}>検索キーワード（1行に1つ・2〜4個推奨）</label>
              <textarea value={editing.keywords.join("\n")} onChange={(e) => setEditing({ ...editing, keywords: e.target.value.split("\n") })}
                rows={4} placeholder={"整形外科 治療\n腰痛 改善\n肩こり ストレッチ"}
                className="lg-input w-full px-3 py-2 text-sm" style={{ color: "#111827", resize: "vertical" }} />
              <p className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>キーワードが多いほどAPIの消費量が増えます。2〜4個が目安です。</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)}
                className="lg-chip flex-1 py-2.5 text-sm font-medium" style={{ color: "#4b5563" }}>キャンセル</button>
              <button type="button"
                onClick={() => {
                  const cleaned: Preset = { ...editing, name: editing.name.trim() || "（無名）", keywords: editing.keywords.map((k) => k.trim()).filter(Boolean) };
                  if (cleaned.keywords.length === 0) return;
                  const exists = presets.some((p) => p.id === cleaned.id);
                  const next = exists ? presets.map((p) => (p.id === cleaned.id ? cleaned : p)) : [...presets, cleaned];
                  persistPresets(next);
                  setSelectedId(cleaned.id);
                  setEditing(null);
                }}
                className="lg-search-btn flex-1 py-2.5 text-sm font-semibold text-white">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
