/**
 * Gemini API のエラーを日本語の実用的なメッセージに分類する。
 * gemini-analyzer/src/lib/gemini-error.ts の実装を流用（分岐の順序に意味があるので構造は変えない）。
 */

export type GeminiErrorCode =
  | "quota_exceeded"
  | "rate_limit"
  | "invalid_key"
  | "safety_blocked"
  | "model_not_found"
  | "context_too_long"
  | "server_error"
  | "unknown";

export interface GeminiError {
  message: string;
  code: GeminiErrorCode;
  actionUrl?: string;
}

export function classifyGeminiError(err: unknown): GeminiError {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  // ── 429 / RESOURCE_EXHAUSTED ─────────────────────────────────────────
  // 必ず最初に判定する。429のレスポンス本文には "token" を含むクォータ名が
  // 入っており、後段の context_too_long に誤って吸われるため。
  if (raw.includes("429") || lower.includes("resource_exhausted")) {
    const retryMatch = raw.match(/retry in (\d+(?:\.\d+)?)\s*s/i);
    const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;

    // 「1日あたり」の枯渇を示す語。単なる "quota" では分あたり制限と区別できない
    const hasPerDay =
      lower.includes("perday") || lower.includes("per_day") ||
      lower.includes("requestsperday") || lower.includes("daily");
    const hasBillingPhrase =
      lower.includes("billing") || lower.includes("monthly") ||
      lower.includes("current quota") || lower.includes("exceeded your current");

    if (hasPerDay || hasBillingPhrase) {
      return {
        message:
          "Gemini APIの1日あたりの上限（無料枠）に達しました。\n" +
          "翌日（UTC0時）にリセットされます。分析なしでも速報は作成できます。",
        code: "quota_exceeded",
        actionUrl: "https://aistudio.google.com/",
      };
    }
    return {
      message:
        `1分あたりのリクエスト上限に達しました。${retrySec ? `${retrySec}秒` : "1分ほど"}待って再度お試しください。\n` +
        "（無料枠の上限: 15リクエスト/分）",
      code: "rate_limit",
    };
  }

  // 401 / 403 — キーが無効
  if (raw.includes("401") || raw.includes("403") || lower.includes("api_key") || lower.includes("invalid") || lower.includes("permission")) {
    return {
      message: "Gemini APIキーが無効か、権限がありません。Google AI Studioでキーを確認してください。",
      code: "invalid_key",
      actionUrl: "https://aistudio.google.com/apikey",
    };
  }

  // セーフティフィルタ
  if (lower.includes("safety") || lower.includes("blocked") || lower.includes("harm") || lower.includes("candidate")) {
    return {
      message: "Geminiの安全フィルターによりブロックされました。対象の動画タイトルに不適切な表現が含まれている可能性があります。",
      code: "safety_blocked",
    };
  }

  // 404 — モデルが見つからない（"model" 単体では判定しない。429の文面にも含まれるため）
  if (raw.includes("404") || lower.includes("is not found") || lower.includes("is not supported for generatecontent") || lower.includes("model not found")) {
    return {
      message: "指定のモデルが利用できません。APIキーの対象プロジェクトで Gemini API が有効か確認してください。",
      code: "model_not_found",
      actionUrl: "https://ai.google.dev/gemini-api/docs/models",
    };
  }

  // コンテキスト超過（429の後に置くこと）
  if (lower.includes("context") || lower.includes("input is too long")) {
    return {
      message: "分析対象の情報量が多すぎます。速報の本数を減らして再試行してください。",
      code: "context_too_long",
    };
  }

  // 5xx
  if (raw.includes("500") || raw.includes("503") || lower.includes("server error") || lower.includes("unavailable") || lower.includes("high demand")) {
    return {
      message: "Geminiのサーバーが混雑しています。1〜2分待ってから再度お試しください。",
      code: "server_error",
      actionUrl: "https://status.cloud.google.com/",
    };
  }

  return { message: `Gemini APIエラー: ${raw}`, code: "unknown" };
}

/** モデルがコードフェンスを付けて返すことがあるので剥がす */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : raw).trim();
}
