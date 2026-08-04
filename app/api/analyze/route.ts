import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { classifyGeminiError, extractJson } from "@/app/lib/gemini-error";

/**
 * 速報のAI分析。
 * 抽出済みの動画リストを渡し、「今月の傾向」「なぜ伸びたか」「自社への応用案」を作る。
 *
 * 動画の内容そのものは公式APIでは取得できない（他人の動画の字幕は
 * captions.download に所有者のOAuthが必要）ため、タイトル・説明文・チャンネル名・
 * 数値から推測させる。実務上はこれで「企画の型」は十分に言語化できる。
 */

export interface AnalyzedVideo {
  id: string;
  whyItWorked: string;   // なぜ伸びたか（切り口の言語化）
  applyIdea: string;     // 自社チャンネルへの応用案
}

export interface AnalyzeResponse {
  headline: string;          // 今月の傾向（1〜2文）
  videos: AnalyzedVideo[];
}

interface InputVideo {
  id: string;
  title: string;
  channelName: string;
  viewCount: number;
  spreadRate: number;
  description?: string;
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-gemini-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini APIキーが必要です" }, { status: 400 });
  }

  let videos: InputVideo[];
  let genre = "";
  let clientContext = "";
  try {
    const body = await request.json();
    videos = Array.isArray(body.videos) ? body.videos : [];
    genre = String(body.genre ?? "");
    clientContext = String(body.clientContext ?? "").slice(0, 300);
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  if (videos.length === 0) {
    return NextResponse.json({ error: "分析対象の動画がありません" }, { status: 400 });
  }

  const list = videos
    .slice(0, 10)
    .map((v, i) =>
      `${i + 1}. 【動画ID】${v.id}\n` +
      `   タイトル: ${v.title}\n` +
      `   チャンネル: ${v.channelName}\n` +
      `   再生数: ${v.viewCount.toLocaleString()}回（このチャンネルの平均の約${v.spreadRate.toFixed(1)}倍）\n` +
      (v.description ? `   説明文(冒頭): ${v.description.slice(0, 200).replace(/\n/g, " ")}\n` : "")
    )
    .join("\n");

  const prompt = `あなたはYouTube運用代行会社のコンテンツ戦略アドバイザーです。
クライアントに毎月お送りする「業界トレンド速報」の解説文を書きます。

読み手はYouTubeの専門家ではない事業主です。専門用語を避け、
「なぜその動画が伸びたのか」と「自分たちならどう応用できるのか」が
一読して分かる言葉で書いてください。

${genre ? `【対象の業界・ジャンル】\n${genre}\n` : ""}
${clientContext ? `【クライアントのチャンネル情報】\n${clientContext}\n` : ""}
【今月伸びた動画一覧】
${list}

必ず以下のJSON形式のみで出力してください（説明文やコードフェンスは不要）：
{
  "headline": "今月の傾向を1〜2文で。個別の動画ではなく、共通する切り口や型を束ねて指摘する（例: 「実は逆効果」という常識を否定する切り口が伸びています。上位3本中2本がこの型でした。）",
  "videos": [
    {
      "id": "上の一覧にある動画IDをそのまま",
      "whyItWorked": "なぜ伸びたのかを40〜70文字。企画の切り口・タイトルの型を言語化する。「面白いから」のような曖昧な説明は禁止",
      "applyIdea": "クライアントが真似できる具体的な企画案を40〜70文字。可能なら動画タイトル案の形にする"
    }
  ]
}

制約:
- videos は入力された全ての動画について、入力と同じ順序で出力すること
- 数字や事実を創作しないこと。与えられた情報から読み取れる範囲で書くこと
- 断定できない場合は「〜と考えられます」と推測であることを示すこと`;

  let raw = "";
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: { responseMimeType: "application/json" },
    });
    const result = await model.generateContent(prompt);
    raw = result.response.text();
  } catch (err) {
    const info = classifyGeminiError(err);
    return NextResponse.json({ error: info.message, code: info.code, actionUrl: info.actionUrl }, { status: 502 });
  }

  try {
    const parsed = JSON.parse(extractJson(raw)) as AnalyzeResponse;
    const byId = new Map((parsed.videos ?? []).map((v) => [v.id, v]));
    // 入力順を正とし、モデルが取りこぼしたものは空で埋める
    const aligned: AnalyzedVideo[] = videos.slice(0, 10).map((v) => ({
      id: v.id,
      whyItWorked: byId.get(v.id)?.whyItWorked ?? "",
      applyIdea: byId.get(v.id)?.applyIdea ?? "",
    }));
    return NextResponse.json({ headline: parsed.headline ?? "", videos: aligned } satisfies AnalyzeResponse);
  } catch {
    return NextResponse.json({ error: "AIの応答を解析できませんでした。もう一度お試しください。" }, { status: 502 });
  }
}
