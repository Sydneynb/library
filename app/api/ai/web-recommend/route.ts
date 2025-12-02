import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type WebRecommendRequest = {
  bookId?: string;
  topK?: number;
  // Optional seed to allow deterministic shuffling server-side (number or numeric string)
  seed?: number | string;
};

/**
 * POST /api/ai/web-recommend
 *
 * Uses Open Library (https://openlibrary.org) to find books similar to the provided
 * local book. Results that match titles already present in the local `books` table
 * are filtered out so the endpoint does not return books that are already in your DB.
 *
 * Request body:
 * { bookId: string, topK?: number }
 *
 * Response:
 * { recommendations: Array<{ title: string, author: string, key?: string, source: string }> }
 */
export async function POST(request: Request) {
  try {
    const body: WebRecommendRequest = await request
      .json()
      .catch(() => ({}) as WebRecommendRequest);
    const { bookId, topK = 5, seed } = body;
    // Clamp topK to a reasonable value and determine the fetch limit we'll use
    const requestedTopK = Math.max(1, Math.min(Number(topK) || 5, 50));

    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1) Load the target book from local DB to build a search query and know what to exclude
    const { data: targetBook, error: targetErr } = await supabase
      .from("books")
      .select("id, title, assignee, notes")
      .eq("id", bookId)
      .maybeSingle();

    if (targetErr || !targetBook) {
      return NextResponse.json(
        { error: (targetErr as any)?.message ?? "Book not found" },
        { status: 404 },
      );
    }

    const queryText = [targetBook.title, targetBook.assignee, targetBook.notes]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (!queryText) {
      return NextResponse.json({ recommendations: [] });
    }

    // 2) Collect local titles to exclude from web results (case-insensitive)
    const { data: allLocal, error: allErr } = await supabase
      .from("books")
      .select("title");
    const localTitles = new Set<string>();
    if (!allErr && Array.isArray(allLocal)) {
      allLocal.forEach((r: any) => {
        if (r?.title) localTitles.add(String(r.title).toLowerCase().trim());
      });
    }

    // Helper to query Open Library and map results
    async function queryOpenLibrary(q: string, limit = 20) {
      const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(
        q,
      )}&limit=${limit}`;
      const resp = await fetch(url);
      if (!resp.ok) return [];
      const json = await resp.json().catch(() => ({}));
      const docs = Array.isArray(json?.docs) ? json.docs : [];
      return docs
        .map((d: any) => ({
          title: d?.title ?? "",
          author: Array.isArray(d?.author_name)
            ? d.author_name.join(", ")
            : (d?.author_name ?? "Unknown"),
          key: d?.key ?? null,
          source: "openlibrary",
        }))
        .filter(
          (d: any) =>
            d.title && !localTitles.has(String(d.title).toLowerCase().trim()),
        );
    }

    // 3) Primary search using the combined fields
    // Request a larger candidate set so we can shuffle/deduplicate and return fresh subsets.
    const fetchLimit = Math.min(Math.max(requestedTopK * 6, 20), 100);
    const primaryDocs = await queryOpenLibrary(queryText, fetchLimit);
    let recommendations: Array<{
      title: string;
      author: string;
      key?: string;
      source: string;
    }> = primaryDocs.slice();

    // 4) If not enough recommendations, try a looser title-only search and merge unique titles
    if (
      recommendations.length < Math.min(2, requestedTopK) &&
      targetBook.title
    ) {
      const titleOnlyDocs = await queryOpenLibrary(
        String(targetBook.title),
        Math.min(fetchLimit * 2, 200),
      );
      const seen = new Set(
        recommendations.map((r: any) => String(r.title).toLowerCase().trim()),
      );
      for (const d of titleOnlyDocs) {
        if (seen.has(String(d.title).toLowerCase().trim())) continue;
        recommendations.push(d);
        seen.add(String(d.title).toLowerCase().trim());
      }
    }

    // 5) Deduplicate by normalized title (case-insensitive) preserving order
    const normalizedSeen = new Set<string>();
    const deduped: typeof recommendations = [];
    for (const d of recommendations) {
      const t = String(d?.title ?? "")
        .toLowerCase()
        .trim();
      if (!t) continue;
      if (normalizedSeen.has(t)) continue;
      normalizedSeen.add(t);
      deduped.push(d);
    }

    // 6) Shuffle deterministically when a seed is provided, otherwise randomize
    function mulberry32(a: number) {
      return function () {
        let t = (a += 0x6d2b79f5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function shuffleArray<T>(arr: T[], rand: () => number) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
      }
      return a;
    }

    const numericSeed = seed != null ? Number(seed) : NaN;
    const randFn = Number.isFinite(numericSeed)
      ? mulberry32(Math.floor(numericSeed))
      : Math.random;
    const shuffled = shuffleArray(deduped, randFn);

    // 7) Return up to requestedTopK items (may be fewer if web results are sparse)
    const finalRecommendations = shuffled.slice(0, requestedTopK);
    return NextResponse.json({ recommendations: finalRecommendations });
  } catch (err: any) {
    console.error("Web recommend error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
