"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Eye, EyeOff, Copy, Check, X, Zap, Download, Plus, ArrowLeft } from "lucide-react";
import { TrendVideoItem, TrendResponse } from "@/app/api/trend/route";

/* ═══════════════════════════════════════════════════════════════════════
   業界トレンド速報メーカー
   担当業界のキーワードを入力するだけで、直近の新規・伸びているYouTube動画を
   洗い出し、クライアントに送る「トレンド速報」を自動生成する。
════════════════════════════════════════════════════════════════════════ */

const LS_KEY = "tf-api-key";
const LS_KEYWORDS = "tf-keywords";

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

/* キーワードから速報の見出しラベルを作る */
function genreLabelOf(keywords: string[]): string {
  if (keywords.length === 0) return "";
  if (keywords.length <= 2) return keywords.join("・");
  return `${keywords.slice(0, 2).join("・")} 他${keywords.length - 2}件`;
}

/* 速報テキスト（Chatwork用）を生成 */
function buildReport(genre: string, videos: TrendVideoItem[], days: number, topN: number): string {
  const now = new Date();
  const month = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, "0")}月`;
  const lines: string[] = [];
  lines.push(`[info][title]📊 業界トレンド速報（${genre ? `${genre} / ` : ""}${month}）[/title]`);
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
  a.download = `trend_${genre || "keywords"}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  // キーワード入力
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState("");

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

  // 初期ロード（localStorage）
  useEffect(() => {
    try {
      const k = localStorage.getItem(LS_KEY);
      if (k) setApiKey(k);
      const kw = localStorage.getItem(LS_KEYWORDS);
      if (kw) {
        const parsed = JSON.parse(kw) as string[];
        if (Array.isArray(parsed)) setKeywords(parsed.filter((x) => typeof x === "string" && x.trim()));
      }
    } catch { /* ignore */ }
  }, []);

  const persistKey = useCallback((k: string) => {
    setApiKey(k);
    try { localStorage.setItem(LS_KEY, k); } catch { /* ignore */ }
  }, []);

  const persistKeywords = useCallback((next: string[]) => {
    setKeywords(next);
    try { localStorage.setItem(LS_KEYWORDS, JSON.stringify(next)); } catch { /* ignore */ }
  }, []);

  /* 入力中のテキストをキーワードとして確定する。カンマ・読点区切りで複数まとめて追加できる */
  const commitInput = useCallback((raw: string) => {
    const parts = raw.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...keywords];
    for (const p of parts) if (!next.includes(p)) next.push(p);
    persistKeywords(next);
    setKwInput("");
  }, [keywords, persistKeywords]);

  const removeKeyword = useCallback((kw: string) => {
    persistKeywords(keywords.filter((k) => k !== kw));
  }, [keywords, persistKeywords]);

  const handleKwKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME変換中のEnterは確定に使われるので無視する
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitInput(kwInput);
    } else if (e.key === "Backspace" && kwInput === "" && keywords.length > 0) {
      persistKeywords(keywords.slice(0, -1));
    }
  }, [kwInput, keywords, commitInput, persistKeywords]);

  const genreLabel = useMemo(() => genreLabelOf(keywords), [keywords]);

  const handleGenerate = useCallback(async () => {
    // 未確定の入力が残っていても拾って検索する
    const pending = kwInput.split(/[,、\n]/).map((s) => s.trim()).filter(Boolean);
    const effective = [...keywords];
    for (const p of pending) if (!effective.includes(p)) effective.push(p);
    if (!apiKey.trim() || effective.length === 0) return;
    if (pending.length > 0) { persistKeywords(effective); setKwInput(""); }

    setLoading(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await fetch("/api/trend", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-youtube-api-key": apiKey.trim() },
        body: JSON.stringify({
          genre: genreLabelOf(effective),
          keywords: effective,
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
  }, [apiKey, keywords, kwInput, days, persistKeywords]);

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

  const hasAnyKeyword = keywords.length > 0 || kwInput.trim().length > 0;
  const canGenerate = Boolean(apiKey.trim()) && hasAnyKeyword && !loading;

  return (
    <div className="lg-base">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="lg-header sticky top-0 z-20 px-6 py-3.5 flex items-center gap-3">
        <Image src="/eaval-logo.png" alt="EAVAL" width={30} height={30} className="flex-shrink-0 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: "#111827" }}>業界トレンド速報メーカー</span>
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>by 株式会社EAVAL</span>
        </div>
        <Link href="/" className="ml-auto lg-chip flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium" style={{ color: "#4b5563" }}>
          <ArrowLeft className="h-3.5 w-3.5" /> 概要を見る
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {/* ── Overview ─────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-4 text-center">
          <h1 className="text-xl font-bold leading-relaxed" style={{ color: "#111827" }}>
            キーワードを入れるだけで、<span style={{ color: "#e63946" }}>クライアントに送るトレンド速報</span>が完成
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
            担当業界のキーワードを入力すると、<strong style={{ color: "#374151" }}>直近{days}日で新規・伸びているYouTube動画</strong>を自動で洗い出します。<br />
            各チャンネルの実力を基準にした「<strong style={{ color: "#374151" }}>拡散率</strong>」で、規模に関係なく本当に伸びた動画を発見。<br />
            そのまま<strong style={{ color: "#374151" }}>Chatworkに貼れる速報テキスト</strong>をワンクリックで生成します。
          </p>
          <div className="lg-amber px-4 py-3 text-xs text-left" style={{ color: "#78350f" }}>
            <strong>この速報の目的：</strong>
            業界でいま伸びている動画を毎月まとめて共有し、次の企画を考える材料にしていただくためのものです。誰でも同じ品質で・続けられるように仕組み化しています。
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

        {/* ── Keywords ─────────────────────────────────────────────────── */}
        <div className="lg-panel p-6 space-y-4">
          <SectionLabel>検索キーワード（担当業界・ジャンル）</SectionLabel>

          <div className="flex gap-2">
            <input
              type="text"
              value={kwInput}
              onChange={(e) => setKwInput(e.target.value)}
              onKeyDown={handleKwKeyDown}
              onBlur={() => commitInput(kwInput)}
              placeholder="例: 整形外科 治療（入力して Enter で追加）"
              className="lg-input flex-1 px-3 py-2.5 text-sm"
              style={{ color: "#111827" }}
            />
            <button
              type="button"
              onClick={() => commitInput(kwInput)}
              disabled={!kwInput.trim()}
              className="lg-chip flex items-center gap-1 px-4 py-2 text-xs font-medium disabled:opacity-40"
              style={{ color: "#4b5563" }}
            >
              <Plus className="h-3.5 w-3.5" /> 追加
            </button>
          </div>

          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {keywords.map((kw) => (
                <span key={kw} className="lg-chip-on inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white">
                  {kw}
                  <button type="button" onClick={() => removeKeyword(kw)} title="削除" className="opacity-70 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => persistKeywords([])}
                className="text-[11px] underline underline-offset-2 px-1"
                style={{ color: "rgba(0,0,0,0.35)" }}
              >
                すべてクリア
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: "rgba(0,0,0,0.35)" }}>
              キーワードがまだありません。担当業界の言葉を入力して Enter で追加してください。
            </p>
          )}

          <p className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>
            カンマ・読点で区切ると複数まとめて追加できます。キーワードが多いほどAPIの消費量が増えるため<strong>2〜4個</strong>が目安です。入力内容はこのブラウザに保存されます。
          </p>
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
          {!loading && !apiKey.trim() && (
            <p className="text-[11px] text-center" style={{ color: "rgba(0,0,0,0.35)" }}>APIキーを入力すると実行できます</p>
          )}
          {!loading && apiKey.trim() && !hasAnyKeyword && (
            <p className="text-[11px] text-center" style={{ color: "rgba(0,0,0,0.35)" }}>キーワードを1つ以上追加すると実行できます</p>
          )}
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
                    {result.genre || genreLabel}：{filtered.length}件（取得 {result.totalFetched}件中）
                  </span>
                  <button type="button" onClick={() => exportCsv(result.genre || genreLabel, filtered)}
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
    </div>
  );
}
