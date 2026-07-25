import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight, Zap, Search, TrendingUp, Send, KeyRound, Clock,
  CalendarRange, ListOrdered, Heart, CheckCircle2, AlertTriangle,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════
   1ページ目（ダッシュボード）
   資料として展開する前提で、この仕組みの「目的・流れ・使い方」を
   誰が見ても一目で掴めるようにまとめた概要ページ。
════════════════════════════════════════════════════════════════════════ */

export const metadata = {
  title: "業界トレンド速報メーカー | EAVAL",
  description: "担当クライアントに毎月「業界トレンド速報」を届けるための社内ツール。目的・仕組み・使い方の概要。",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: "rgba(0,0,0,0.32)" }}>
      {children}
    </p>
  );
}

const stats = [
  { icon: Clock, label: "作成にかかる時間", value: "約1分", note: "キーワードを入れて実行するだけ" },
  { icon: CalendarRange, label: "送る頻度の目安", value: "月1回", note: "定例以外の接点として" },
  { icon: ListOrdered, label: "速報に載せる本数", value: "3〜10本", note: "上位から自動で選出" },
  { icon: KeyRound, label: "必要なもの", value: "APIキーのみ", note: "各自で取得・ブラウザに保存" },
];

const flow = [
  { icon: Zap, step: "1", title: "キーワードを入力", desc: "担当業界の言葉を2〜4個。入力内容はブラウザに保存されるので次回はそのまま使えます" },
  { icon: Search, step: "2", title: "YouTubeを自動検索", desc: "指定期間内に投稿された動画を、キーワードごとに再生数順で収集します" },
  { icon: TrendingUp, step: "3", title: "拡散率で並べ替え", desc: "各チャンネルの平常値と比べて「本当に伸びた動画」を上位に抽出します" },
  { icon: Send, step: "4", title: "速報テキストを生成", desc: "Chatworkにそのまま貼れる形式で出力。コピーしてクライアントへ送るだけ" },
];

const howto = [
  { n: "1", title: "APIキーを用意する", desc: "Google Cloud Console で YouTube Data API v3 を有効化し、APIキーを発行します。初回だけの作業です。" },
  { n: "2", title: "キーワードを入れる", desc: "担当クライアントの業界の言葉を入力して Enter。カンマ区切りでまとめて追加もできます。" },
  { n: "3", title: "速報を作ってコピー", desc: "「トレンド速報を作成」を押すと速報テキストが完成。コピーしてChatworkへ貼り付けます。" },
];

export default function Overview() {
  return (
    <div className="lg-base">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="lg-header sticky top-0 z-20 px-6 py-3.5 flex items-center gap-3">
        <Image src="/eaval-logo.png" alt="EAVAL" width={30} height={30} className="flex-shrink-0 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-[15px] font-bold" style={{ color: "#111827" }}>業界トレンド速報メーカー</span>
          <span className="text-[11px]" style={{ color: "rgba(0,0,0,0.35)" }}>by 株式会社EAVAL</span>
        </div>
        <Link href="/tool" className="ml-auto lg-chip-on flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white">
          ツールを開く <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-5">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="lg-panel p-10 space-y-5 text-center">
          <span className="inline-block px-3 py-1 text-[11px] font-semibold rounded-full"
            style={{ background: "rgba(230,57,70,0.08)", color: "#e63946" }}>
            運用代行事業部 / 社内ツール
          </span>
          <h1 className="text-2xl font-bold leading-relaxed" style={{ color: "#111827" }}>
            担当クライアントに、毎月<span style={{ color: "#e63946" }}>「業界のトレンド速報」</span>を届ける
          </h1>
          <p className="text-sm leading-relaxed max-w-2xl mx-auto" style={{ color: "#6b7280" }}>
            キーワードを入れるだけで、直近で伸びているYouTube動画を自動で洗い出し、<br />
            そのままChatworkに貼れる速報テキストを作ります。<br />
            <strong style={{ color: "#374151" }}>誰でも・同じ品質で・続けられる</strong>ように仕組み化したツールです。
          </p>
          <div className="flex items-center justify-center gap-3 pt-1">
            <Link href="/tool" className="lg-search-btn inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white">
              <Zap className="h-4 w-4" /> 速報を作る
            </Link>
          </div>
        </div>

        {/* ── Stats ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="lg-panel p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" style={{ color: "#e63946" }} />
                  <span className="text-[11px] font-medium" style={{ color: "rgba(0,0,0,0.4)" }}>{s.label}</span>
                </div>
                <p className="text-xl font-bold" style={{ color: "#111827" }}>{s.value}</p>
                <p className="text-[11px] leading-snug" style={{ color: "rgba(0,0,0,0.35)" }}>{s.note}</p>
              </div>
            );
          })}
        </div>

        {/* ── Why ──────────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-5">
          <SectionLabel>なぜやるのか（背景と目的）</SectionLabel>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
              style={{ background: "linear-gradient(145deg,#f04050,#c01020)", boxShadow: "0 4px 12px rgba(220,38,38,0.35)" }}>
              <Heart className="h-5 w-5 text-white" />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
              紹介が自然に生まれる状態をつくるには、金銭インセンティブに頼るのではなく
              <strong style={{ color: "#111827" }}>「紹介したくなる体験・関係性」</strong>を日々のクライアントワークで積み上げることが必要です。
              その具体策のひとつが、<strong style={{ color: "#111827" }}>定例以外の細やかなコミュニケーション</strong>。
              業界のトレンド速報を毎月届けることは、その代表的な接点にあたります。
            </p>
          </div>

          {/* 目的の連鎖 */}
          <div className="grid gap-2 sm:grid-cols-4">
            {[
              { t: "新規案件を増やす", s: "上位の目的" },
              { t: "紹介したくなる関係性", s: "そのための手段" },
              { t: "定例以外の細かな接点", s: "関係性のつくり方" },
              { t: "業界トレンド速報", s: "＝このツール", accent: true },
            ].map((x, i) => (
              <div key={x.t} className="relative">
                <div className="rounded-2xl px-4 py-3.5 h-full"
                  style={x.accent
                    ? { background: "rgba(230,57,70,0.07)", boxShadow: "inset 0 0 0 1px rgba(230,57,70,0.2)" }
                    : { background: "rgba(0,0,0,0.03)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}>
                  <p className="text-[10px] font-semibold mb-1" style={{ color: x.accent ? "#e63946" : "rgba(0,0,0,0.3)" }}>{x.s}</p>
                  <p className="text-xs font-bold leading-snug" style={{ color: "#111827" }}>{x.t}</p>
                </div>
                {i < 3 && (
                  <div className="hidden sm:block absolute top-1/2 -right-1.5 -translate-y-1/2 z-10" style={{ color: "rgba(0,0,0,0.18)" }}>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: "rgba(0,0,0,0.3)" }}>
            ※ 2026/07/22 の定例ミーティングで整理した方針にもとづいています
          </p>
        </div>

        {/* ── Flow ─────────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-5">
          <SectionLabel>ツールがやること（4ステップ）</SectionLabel>
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            {flow.map((f, i) => {
              const Icon = f.icon;
              return (
                <div key={f.step} className="flex flex-1 items-start">
                  <div className="lg-step-card flex flex-1 flex-col items-center gap-2.5 px-3 py-5 text-center h-full">
                    <div className="relative flex h-11 w-11 items-center justify-center lg-step-icon" style={{ color: "#e63946" }}>
                      <Icon className="h-5 w-5" />
                      <span className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: "linear-gradient(145deg,#f04050,#c01020)", boxShadow: "0 2px 6px rgba(220,38,38,0.4)" }}>
                        {f.step}
                      </span>
                    </div>
                    <p className="text-[12px] font-bold leading-tight" style={{ color: "#1f2937" }}>{f.title}</p>
                    <p className="text-[10px] leading-snug" style={{ color: "#9ca3af" }}>{f.desc}</p>
                  </div>
                  {i < 3 && (
                    <div className="hidden sm:block shrink-0 px-0.5 pt-6" style={{ color: "rgba(0,0,0,0.18)" }}>
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 拡散率とは ───────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-4">
          <SectionLabel>このツールの肝「拡散率」とは</SectionLabel>
          <p className="text-sm leading-relaxed" style={{ color: "#4b5563" }}>
            再生数の絶対値だけを見ると、大きいチャンネルの動画ばかりが並んでしまいます。
            そこで<strong style={{ color: "#111827" }}>「そのチャンネルの平常値と比べて何倍伸びたか」</strong>で並べ替えます。
            これにより、規模に関係なく<strong style={{ color: "#111827" }}>“いま刺さっているテーマ”</strong>が見つかります。
          </p>
          <div className="rounded-2xl px-5 py-4 text-center"
            style={{ background: "rgba(0,0,0,0.03)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.05)" }}>
            <p className="text-sm font-bold" style={{ color: "#111827" }}>
              拡散率 ＝ その動画の再生数 ÷ そのチャンネルの平常再生数（直近動画の中央値）
            </p>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { badge: "lg-badge-yellow", rate: "1.0〜1.5x", desc: "ふだんどおり。平常運転の動画" },
              { badge: "lg-badge-orange", rate: "1.5〜3.0x", desc: "よく伸びている。参考になるテーマ" },
              { badge: "lg-badge-red", rate: "3.0x 以上", desc: "跳ねた動画。速報で共有する価値が高い" },
            ].map((x) => (
              <div key={x.rate} className="rounded-2xl px-4 py-3.5 space-y-2"
                style={{ background: "rgba(0,0,0,0.02)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <span className={`inline-block px-2 py-0.5 text-xs font-semibold ${x.badge}`}>{x.rate}</span>
                <p className="text-[11px] leading-snug" style={{ color: "#6b7280" }}>{x.desc}</p>
              </div>
            ))}
          </div>
          <div className="lg-amber px-4 py-3 text-xs" style={{ color: "#78350f" }}>
            <strong>例：</strong>ふだん1万回のチャンネルで5万回再生された動画 → 拡散率 <strong>5.0倍</strong>。
            登録者数が少ないチャンネルでも、跳ねた動画はきちんと上位に出てきます。
          </div>
        </div>

        {/* ── 使い方 ───────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 space-y-5">
          <SectionLabel>使い方（はじめての人向け）</SectionLabel>
          <div className="space-y-2.5">
            {howto.map((h) => (
              <div key={h.n} className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: "rgba(0,0,0,0.02)", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.04)" }}>
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: "linear-gradient(145deg,#f04050,#c01020)" }}>{h.n}</span>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold" style={{ color: "#111827" }}>{h.title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>{h.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 運用の注意 ───────────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="lg-panel p-6 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: "#16a34a" }} />
              <p className="text-sm font-bold" style={{ color: "#111827" }}>安心して使える理由</p>
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: "#6b7280" }}>
              <li>・APIキーは<strong style={{ color: "#374151" }}>自分のブラウザにだけ</strong>保存され、サーバーには送られません</li>
              <li>・利用者ごとに自分のキーを使うので、<strong style={{ color: "#374151" }}>誰かの使いすぎで他の人が止まりません</strong></li>
              <li>・キーワードもブラウザに保存されるので、次回は開いてすぐ実行できます</li>
            </ul>
          </div>
          <div className="lg-panel p-6 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" style={{ color: "#d97706" }} />
              <p className="text-sm font-bold" style={{ color: "#111827" }}>使うときの注意</p>
            </div>
            <ul className="space-y-1.5 text-xs leading-relaxed" style={{ color: "#6b7280" }}>
              <li>・キーワードは<strong style={{ color: "#374151" }}>2〜4個が目安</strong>。増やすほどAPI消費量が増えます</li>
              <li>・APIの1日あたりの上限に達すると、その日は実行できなくなります（翌日回復）</li>
              <li>・結果はそのまま送らず、<strong style={{ color: "#374151" }}>クライアントに合うものを選んで</strong>共有してください</li>
            </ul>
          </div>
        </div>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <div className="lg-panel p-8 text-center space-y-4">
          <p className="text-sm" style={{ color: "#6b7280" }}>準備ができたら、実際に速報を作ってみましょう。</p>
          <Link href="/tool" className="lg-search-btn inline-flex items-center justify-center gap-2 px-8 py-3.5 text-sm font-semibold text-white">
            <Zap className="h-4 w-4" /> ツールを開く
          </Link>
        </div>
      </main>
    </div>
  );
}
