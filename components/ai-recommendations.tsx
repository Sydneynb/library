"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type BookBrief = {
  id: string;
  title: string;
  assignee?: string | null;
  book_type?: string | null;
  status?: string | null;
  notes?: string | null;
};

type Recommendation = {
  score?: number;
  tags?: string[];
  summary?: string;
  book?: BookBrief | null;
  title?: string;
  author?: string;
  source?: string;
};

type Props = {
  bookId: string;
  topK?: number;
};

/**
 * AIRecommendations
 *
 * Shows AI-driven book recommendations for a given book.
 * - Calls POST /api/ai/recommend { bookId, topK }
 * - Optionally calls POST /api/ai/generate to refresh AI metadata first
 *
 * Usage:
 * <AIRecommendations bookId={book.id} topK={5} />
 */
export default function AIRecommendations({ bookId, topK = 5 }: Props) {
  const [recs, setRecs] = useState<Recommendation[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // When true, only show web-sourced recommendations (do not mix with local/table-view books)
  // Web recommendations will be the default behavior when opening recommendations from the table.
  const [onlyWeb, setOnlyWeb] = useState(true);

  useEffect(() => {
    if (!bookId) return;
    // By default show web recommendations when this component mounts (e.g. opened from table-view)
    // generate a fresh numeric seed so the server-side shuffle returns a different ordering
    const seed = Date.now() + Math.floor(Math.random() * 100000);
    void fetchWebRecommendations(undefined, seed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, topK]);

  async function fetchRecommendations() {
    // If currently in web-only mode, delegate to the web fetcher so local books are never shown
    if (onlyWeb) {
      await fetchWebRecommendations();
      return;
    }
    setLoading(true);
    setError(null);

    // helper to call recommend endpoint
    async function callRecommend() {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, topK }),
      });
      const json = await res.json().catch(() => ({}));
      return { res, json };
    }

    try {
      let { res, json } = await callRecommend();

      // If recommend failed because target embedding is missing or similar error,
      // attempt to generate AI metadata once, then poll the recommend endpoint
      // with exponential backoff until results are available or a timeout occurs.
      const needsGeneration =
        !res.ok &&
        json &&
        typeof json.error === "string" &&
        /no ai data|target embedding|not available/i.test(json.error);

      if (needsGeneration) {
        // Trigger server-side generation
        const genRes = await fetch("/api/ai/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookId }),
        });
        const genJson = await genRes.json().catch(() => ({}));
        if (!genRes.ok) {
          throw new Error(genJson?.error || "Failed to generate AI metadata");
        }

        // Poll recommend endpoint with backoff until we get results or exceed attempts
        const backoff = [500, 1000, 2000, 4000, 8000]; // ms
        let success = false;
        for (let i = 0; i < backoff.length; i++) {
          await new Promise((resolve) => setTimeout(resolve, backoff[i]));
          const attempt = await callRecommend();
          res = attempt.res;
          json = attempt.json;
          if (res.ok) {
            success = true;
            break;
          }
        }

        if (!success) {
          throw new Error(
            "AI metadata generation is in progress. Please try again in a few seconds.",
          );
        }
      }

      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch recommendations");
      }

      // Expect { recommendations: [{ score, tags, summary, book }] }
      setRecs(json.recommendations ?? []);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }

  // Regenerate AI metadata for the given book (summary/embedding) then refresh recommendations
  async function regenerateAndRefresh() {
    // regenerating implies using local AI metadata — exit web-only mode
    setOnlyWeb(false);
    setRegenLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate AI metadata");
      }
      // After generation, refresh recommendations (will use local recommendations because onlyWeb was set false)
      await fetchRecommendations();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setRegenLoading(false);
    }
  }

  // Fetch recommendations from the web (Open Library) and exclude local books.
  // Accepts an optional `excludeTitles` set and optional `seed` so callers can request
  // recommendations different from those currently displayed (seed controls server shuffle).
  async function fetchWebRecommendations(
    excludeTitles?: Set<string>,
    seed?: number | string,
  ) {
    setLoading(true);
    setError(null);
    try {
      // Request a larger set from the server so we can filter and shuffle candidates
      const FETCH_LIMIT = Math.max(12, (topK ?? 5) * 6);
      const res = await fetch("/api/ai/web-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, topK: Math.min(FETCH_LIMIT, 50), seed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || "Failed to fetch web recommendations");
      }

      const mapped = (json.recommendations ?? []).map((r: any) => ({
        score: undefined,
        title: r.title,
        author: r.author,
        source: r.source,
        summary: r.author ? `Author: ${r.author}` : (r.summary ?? undefined),
        book: null,
      })) as Recommendation[];

      // Shuffle helper (Fisher-Yates)
      function shuffle<T>(arr: T[]) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = a[i];
          a[i] = a[j];
          a[j] = tmp;
        }
        return a;
      }

      const shuffled = shuffle(mapped);

      // Build a set of currently displayed titles (lowercased) if excludeTitles not provided
      const currentTitles =
        excludeTitles && excludeTitles.size > 0
          ? excludeTitles
          : new Set<string>(
              (Array.isArray(recs) ? recs : [])
                .map((r) => r.title ?? "")
                .filter(Boolean)
                .map((t) => String(t).toLowerCase().trim()),
            );

      // Choose up to MAX_WEB_RECS distinct recommendations not in currentTitles
      const MAX_WEB_RECS = 3;
      const chosen: Recommendation[] = [];
      const seen = new Set<string>();

      for (const candidate of shuffled) {
        if (!candidate?.title) continue;
        const t = String(candidate.title).toLowerCase().trim();
        if (!t) continue;
        if (seen.has(t)) continue; // avoid duplicates in pool
        if (currentTitles.has(t)) continue; // skip currently displayed
        chosen.push(candidate);
        seen.add(t);
        if (chosen.length >= MAX_WEB_RECS) break;
      }

      // If we couldn't find enough new items, try a second pass allowing items
      // that are not exact duplicates but weren't selected before (keeps variety)
      if (chosen.length < MAX_WEB_RECS) {
        for (const candidate of shuffled) {
          if (!candidate?.title) continue;
          const t = String(candidate.title).toLowerCase().trim();
          if (!t || seen.has(t)) continue;
          // allow items even if they were in currentTitles as a last resort
          chosen.push(candidate);
          seen.add(t);
          if (chosen.length >= MAX_WEB_RECS) break;
        }
      }

      // Fallback: if still empty and we have existing recs, rotate them to show something different
      if (chosen.length === 0 && Array.isArray(recs) && recs.length > 0) {
        const rotated = [...recs];
        const first = rotated.shift();
        if (first) rotated.push(first);
        chosen.push(...(rotated.slice(0, MAX_WEB_RECS) as Recommendation[]));
      }

      // Ensure final length is at most MAX_WEB_RECS
      const finalRecs = chosen.slice(0, MAX_WEB_RECS);

      // Mark web-only mode and set results
      setOnlyWeb(true);
      setRecs(finalRecs);
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setRecs([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full min-w-0">
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-medium truncate">Recommended</h3>
            <p className="text-sm text-muted-foreground">
              Books similar to this one.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                // switch to web-only mode and refresh web-based recommendations
                // but attempt to fetch recommendations different from the ones currently shown
                setOnlyWeb(true);
                // build a set of currently displayed web titles to exclude
                const exclude = new Set<string>();
                if (recs && Array.isArray(recs)) {
                  for (const r of recs) {
                    if (r?.title)
                      exclude.add(String(r.title).toLowerCase().trim());
                  }
                }
                // Generate a fresh seed so the server-side shuffle returns a different ordering
                const seed = Date.now();
                await fetchWebRecommendations(exclude, seed);
              }}
              disabled={loading || regenLoading}
            >
              {loading ? "Refreshing…" : "Refresh"}
            </Button>
            {/* Web recommend removed — web recommendations are shown by default when opening from the table */}
          </div>
        </div>

        <div className="mt-4">
          {error && (
            <div className="text-sm text-destructive mb-3">{error}</div>
          )}

          {loading && !recs && (
            <div className="text-sm text-muted-foreground">
              Loading recommendations…
            </div>
          )}

          {!loading && recs && recs.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No recommendations found.
            </div>
          )}

          <ul className="mt-2 space-y-3">
            {recs &&
              recs.map((r, idx) => {
                const book = r.book;
                const key = book?.id ?? `rec-${idx}`;
                return (
                  <li
                    key={key}
                    className="flex flex-col gap-1 border-b last:border-b-0 pb-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 min-w-0">
                        {book ? (
                          <Link
                            href={`/books/${book.id}`}
                            className="font-medium hover:underline truncate block max-w-[200px]"
                          >
                            {book.title}
                          </Link>
                        ) : r.title ? (
                          <div className="min-w-0">
                            <div className="font-medium truncate block max-w-[200px]">
                              {r.title}
                            </div>
                            {r.author && (
                              <div className="text-xs text-muted-foreground">
                                by {r.author}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="font-medium">Unknown book</span>
                        )}

                        {r.tags && r.tags.length > 0 && (
                          <div className="flex gap-1 ml-2">
                            {r.tags.slice(0, 3).map((t) => (
                              <Badge
                                key={t}
                                variant="secondary"
                                className="text-xs"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {typeof r.score === "number" && !isNaN(r.score)
                          ? `${Math.round((r.score ?? 0) * 100)}%`
                          : "-"}
                      </div>
                    </div>

                    {r.summary && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {r.summary.length > 200
                          ? r.summary.slice(0, 200) + "…"
                          : r.summary}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
