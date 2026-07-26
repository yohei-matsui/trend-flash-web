import { NextRequest, NextResponse } from "next/server";

/**
 * 業界トレンド速報 API
 *
 * 1ジャンル分の keywords[] を受け取り、直近N日の新規・伸びている動画を洗い出す。
 * 拡散率（再生数 ÷ チャンネル平常値の中央値）ロジックは youtube-search の実装を踏襲。
 * トレンド用途向けにクォータを抑える（keywordあたり search 1回 + maxResults 少なめ、
 * チャンネル平常値はジャンル内でキャッシュして重複計算しない）。
 */

export interface TrendVideoItem {
  id: string;
  title: string;
  channelId: string;
  channelName: string;
  viewCount: number;
  publishedAt: string;
  thumbnailUrl: string;
  spreadRate: number;
  channelBaseline: number;
  subscriberCount: number;
  durationSeconds: number;
  keyword: string;
}

export interface TrendResponse {
  genre: string;
  videos: TrendVideoItem[];
  totalFetched: number;
}

function parseDurationSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? "0") * 3600) + (parseInt(m[2] ?? "0") * 60) + parseInt(m[3] ?? "0");
}

function calcMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

type VideoDetail = {
  viewCount: number;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  channelId: string;
  channelName: string;
  durationSeconds: number;
};

async function fetchVideoDetails(videoIds: string[], apiKey: string): Promise<Map<string, VideoDetail>> {
  const map = new Map<string, VideoDetail>();
  if (videoIds.length === 0) return map;
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/videos");
    url.searchParams.set("part", "statistics,snippet,contentDetails");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    for (const item of data.items ?? []) {
      const thumbs = item.snippet?.thumbnails;
      const thumbnailUrl = thumbs?.medium?.url ?? thumbs?.default?.url ?? "";
      map.set(item.id, {
        viewCount: parseInt(item.statistics?.viewCount ?? "0", 10),
        title: item.snippet?.title ?? "",
        publishedAt: item.snippet?.publishedAt ?? "",
        thumbnailUrl,
        channelId: item.snippet?.channelId ?? "",
        channelName: item.snippet?.channelTitle ?? "",
        durationSeconds: parseDurationSeconds(item.contentDetails?.duration ?? ""),
      });
    }
  }
  return map;
}

async function fetchChannelInfo(
  channelIds: string[],
  apiKey: string
): Promise<Map<string, { uploadPlaylistId: string; subscriberCount: number }>> {
  const map = new Map<string, { uploadPlaylistId: string; subscriberCount: number }>();
  const uniq = [...new Set(channelIds.filter(Boolean))];
  for (let i = 0; i < uniq.length; i += 50) {
    const chunk = uniq.slice(i, i + 50);
    const url = new URL("https://www.googleapis.com/youtube/v3/channels");
    url.searchParams.set("part", "contentDetails,statistics");
    url.searchParams.set("id", chunk.join(","));
    url.searchParams.set("key", apiKey);
    const res = await fetch(url.toString());
    const data = await res.json();
    for (const item of data.items ?? []) {
      const uploadPlaylistId = item.contentDetails?.relatedPlaylists?.uploads ?? "";
      const subscriberCount = parseInt(item.statistics?.subscriberCount ?? "0", 10);
      if (uploadPlaylistId) map.set(item.id, { uploadPlaylistId, subscriberCount });
    }
  }
  return map;
}

async function fetchChannelBaseline(uploadPlaylistId: string, apiKey: string): Promise<number> {
  const plUrl = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
  plUrl.searchParams.set("part", "contentDetails");
  plUrl.searchParams.set("playlistId", uploadPlaylistId);
  plUrl.searchParams.set("maxResults", "20");
  plUrl.searchParams.set("key", apiKey);
  const plRes = await fetch(plUrl.toString());
  const plData = await plRes.json();
  if (plData.error || !plData.items?.length) return 0;
  const videoIds: string[] = plData.items
    .map((item: { contentDetails?: { videoId?: string } }) => item.contentDetails?.videoId)
    .filter(Boolean);
  const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  statsUrl.searchParams.set("part", "statistics");
  statsUrl.searchParams.set("id", videoIds.join(","));
  statsUrl.searchParams.set("key", apiKey);
  const statsRes = await fetch(statsUrl.toString());
  const statsData = await statsRes.json();
  if (statsData.error || !statsData.items?.length) return 0;
  const views: number[] = statsData.items.map((item: { statistics?: { viewCount?: string } }) =>
    parseInt(item.statistics?.viewCount ?? "0", 10)
  );
  return calcMedian(views);
}

export async function POST(request: NextRequest) {
  const apiKey = request.headers.get("x-youtube-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "YouTube API key is required" }, { status: 400 });
  }

  const body = await request.json();
  const genre: string = (body.genre ?? "").toString();
  const keywords: string[] = Array.isArray(body.keywords)
    ? body.keywords.map((k: unknown) => String(k).trim()).filter(Boolean)
    : [];
  const daysWithin: number = Number(body.daysWithin) > 0 ? Number(body.daysWithin) : 30;
  const maxPerKeyword: number = Math.min(50, Number(body.maxPerKeyword) > 0 ? Number(body.maxPerKeyword) : 25);
  const regionCode: string = body.region === "korea" ? "KR" : body.region === "usa" ? "US" : "JP";
  const order: string = body.order === "date" ? "date" : "viewCount";
  // 尺の絞り込みは検索の時点で行う。取得後に絞ると、再生数上位を短尺が独占して
  // 中尺・長尺が1件も取得されず「0件」になってしまうため。
  // YouTube側の区分: short=4分未満 / medium=4〜20分 / long=20分超
  const durationsIn: string[] = Array.isArray(body.durations)
    ? body.durations.filter((d: unknown) => d === "short" || d === "medium" || d === "long")
    : [];
  // 未選択（＝すべて）なら any 1回だけ。選択があればその区分ごとに検索する
  const durationQueries: string[] = durationsIn.length > 0 ? durationsIn : ["any"];

  if (keywords.length === 0) {
    return NextResponse.json({ error: "キーワードを1つ以上指定してください" }, { status: 400 });
  }

  const publishedAfterIso = new Date(Date.now() - daysWithin * 86400000).toISOString();

  // 1) キーワードごとに search.list（直近N日・伸び順）→ videoId 収集
  const idToKeyword = new Map<string, string>();
  try {
    for (const kw of keywords) {
      for (const vd of durationQueries) {
        const url = new URL("https://www.googleapis.com/youtube/v3/search");
        url.searchParams.set("part", "id");
        url.searchParams.set("q", kw);
        url.searchParams.set("type", "video");
        url.searchParams.set("regionCode", regionCode);
        url.searchParams.set("relevanceLanguage", regionCode === "JP" ? "ja" : regionCode === "KR" ? "ko" : "en");
        url.searchParams.set("order", order);
        url.searchParams.set("maxResults", String(maxPerKeyword));
        url.searchParams.set("publishedAfter", publishedAfterIso);
        url.searchParams.set("videoDuration", vd);
        url.searchParams.set("key", apiKey);
        const res = await fetch(url.toString());
        const data = await res.json();
        if (data.error) {
          return NextResponse.json({ error: data.error.message }, { status: 500 });
        }
        for (const item of data.items ?? []) {
          const vid = item.id?.videoId;
          if (vid && !idToKeyword.has(vid)) idToKeyword.set(vid, kw);
        }
      }
    }
  } catch {
    return NextResponse.json({ error: "YouTube検索でエラーが発生しました" }, { status: 500 });
  }

  const allIds = [...idToKeyword.keys()];
  if (allIds.length === 0) {
    return NextResponse.json({ genre, videos: [], totalFetched: 0 } satisfies TrendResponse);
  }

  // 2) 動画詳細
  const details = await fetchVideoDetails(allIds, apiKey);

  // 3) チャンネル情報（登録者・uploadsプレイリスト）
  const channelIds = [...new Set([...details.values()].map((d) => d.channelId))];
  const channelInfo = await fetchChannelInfo(channelIds, apiKey);

  // 4) チャンネル平常値（中央値）— ジャンル内で1チャンネル1回だけ
  const baselineCache = new Map<string, number>();
  for (let i = 0; i < channelIds.length; i += 10) {
    const chunk = channelIds.slice(i, i + 10);
    const results = await Promise.all(
      chunk.map(async (cid) => {
        const info = channelInfo.get(cid);
        if (!info) return { cid, b: 0 };
        const b = await fetchChannelBaseline(info.uploadPlaylistId, apiKey);
        return { cid, b };
      })
    );
    for (const { cid, b } of results) baselineCache.set(cid, b);
  }

  // 5) 組み立て（拡散率で降順）
  const videos: TrendVideoItem[] = allIds
    .map((id) => {
      const d = details.get(id);
      if (!d) return null;
      const baseline = baselineCache.get(d.channelId) ?? 0;
      const subscriberCount = channelInfo.get(d.channelId)?.subscriberCount ?? 0;
      return {
        id,
        title: d.title,
        channelId: d.channelId,
        channelName: d.channelName,
        viewCount: d.viewCount,
        publishedAt: d.publishedAt,
        thumbnailUrl: d.thumbnailUrl,
        durationSeconds: d.durationSeconds,
        channelBaseline: baseline,
        subscriberCount,
        spreadRate: baseline > 0 ? d.viewCount / baseline : 0,
        keyword: idToKeyword.get(id) ?? "",
      } satisfies TrendVideoItem;
    })
    .filter((v): v is TrendVideoItem => v !== null)
    .sort((a, b) => b.spreadRate - a.spreadRate || b.viewCount - a.viewCount);

  return NextResponse.json({ genre, videos, totalFetched: videos.length } satisfies TrendResponse);
}
