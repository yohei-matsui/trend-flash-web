import { NextRequest, NextResponse } from "next/server";
import { classifyGeminiError } from "@/app/lib/gemini-error";

/**
 * 動画の内容そのものをGeminiに要約させる。
 *
 * YouTubeの概要欄（description）は宣伝文や定型文が多く中身を表さないため使わない。
 * GeminiはYouTubeのURLを file_data.file_uri で直接受け取り、映像と音声を解析できる。
 *   参考: https://ai.google.dev/gemini-api/docs/generate-content/video-understanding
 *
 * SDK（@google/generative-ai）は型が mimeType を必須にしており、YouTube URL に対して
 * 余計な mime_type を送ることになる。ドキュメントの REST 形式（file_uri のみ）が
 * 確実なので、ここは fetch で直接叩く。
 *
 * 制約:
 *  - 公開動画のみ（限定公開・非公開は不可）
 *  - 無料枠は1日あたり合計8時間ぶんのYouTube動画まで
 *  - 2.5より前のモデルは1リクエストにつき1動画。ここでは1本ずつ呼ぶ
 */

export const maxDuration = 60;

const MODEL = "gemini-2.0-flash";

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-gemini-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini APIキーが必要です" }, { status: 400 });
  }

  let videoId = "";
  let title = "";
  try {
    const body = await request.json();
    videoId = String(body.videoId ?? "").trim();
    title = String(body.title ?? "").trim();
  } catch {
    return NextResponse.json({ error: "リクエストの形式が不正です" }, { status: 400 });
  }

  if (!/^[\w-]{5,20}$/.test(videoId)) {
    return NextResponse.json({ error: "動画IDが不正です" }, { status: 400 });
  }

  const prompt =
    `次のYouTube動画を視聴し、内容を日本語で要約してください。\n` +
    (title ? `参考（動画タイトル）: ${title}\n` : "") +
    `\n条件:\n` +
    `- 100〜140文字の平易な日本語。1〜2文にまとめる\n` +
    `- 「この動画は」などの前置きは書かず、内容から直接書き始める\n` +
    `- 何を主張・解説している動画かが分かるように、具体的な中身に触れる\n` +
    `- 概要欄の宣伝文や自己紹介ではなく、本編で話している内容を書く\n` +
    `- 箇条書きや記号は使わず、地の文で書く`;

  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { file_data: { file_uri: `https://www.youtube.com/watch?v=${videoId}` } },
            ],
          },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      // classifyGeminiError は Error のメッセージを見て分類するので、その形に整える
      const msg = data?.error?.message ?? `HTTP ${res.status}`;
      const info = classifyGeminiError(new Error(`${res.status} ${msg}`));
      return NextResponse.json(
        { error: info.message, code: info.code, actionUrl: info.actionUrl },
        { status: 502 }
      );
    }

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const summary = parts
      .map((p: { text?: string }) => p.text ?? "")
      .join(" ")
      .trim()
      .replace(/\s*\n+\s*/g, " ");

    if (!summary) {
      const reason = data?.candidates?.[0]?.finishReason;
      return NextResponse.json(
        {
          error:
            reason === "SAFETY"
              ? "この動画は安全フィルターにより要約できませんでした。"
              : "要約を生成できませんでした。動画が非公開・限定公開の可能性があります。",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ videoId, summary });
  } catch (err) {
    const info = classifyGeminiError(err);
    return NextResponse.json(
      { error: info.message, code: info.code, actionUrl: info.actionUrl },
      { status: 502 }
    );
  }
}
