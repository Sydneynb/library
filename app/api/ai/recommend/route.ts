import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RecommendRequest = {
  bookId?: string;
  topK?: number;
};

/**
 * Compute cosine similarity between two vectors.
 * If vectors differ in length, compute over the min length.
 */
function cosineSimilarity(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const va = a[i] ?? 0;
    const vb = b[i] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) + Number.EPSILON;
  return dot / denom;
}

export async function POST(request: Request) {
  try {
    const body: RecommendRequest = await request
      .json()
      .catch(() => ({}) as RecommendRequest);
    const { bookId, topK = 5 } = body;

    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const supabase = await createClient();

    // 1) Get target embedding for the provided bookId
    const { data: targetRow, error: targetErr } = await supabase
      .from("book_ai")
      .select("book_id, embedding")
      .eq("book_id", bookId)
      .maybeSingle();

    if (targetErr || !targetRow) {
      return NextResponse.json(
        { error: targetErr?.message ?? "No AI data found for target book" },
        { status: 404 },
      );
    }

    const targetEmbedding = (targetRow.embedding ?? null) as number[] | null;
    if (!targetEmbedding || !Array.isArray(targetEmbedding)) {
      return NextResponse.json(
        { error: "Target embedding not available" },
        { status: 404 },
      );
    }

    // 2) Fetch other books with embeddings
    const { data: aiRows, error: aiErr } = await supabase
      .from("book_ai")
      .select("book_id, embedding, tags, summary")
      .not("book_id", "eq", bookId);

    if (aiErr) {
      return NextResponse.json({ error: aiErr.message }, { status: 500 });
    }

    const rows = (aiRows ?? []) as Array<{
      book_id: string;
      embedding: number[] | null;
      tags?: string[] | null;
      summary?: string | null;
    }>;

    // 3) Filter out entries without embeddings, compute similarity scores
    const validRows = rows.filter(
      (r) => Array.isArray(r.embedding) && (r.embedding as any).length > 0,
    );

    const scored = validRows
      .map((r) => {
        const emb = r.embedding as number[];
        const score = cosineSimilarity(targetEmbedding, emb);
        return {
          book_id: r.book_id,
          score,
          tags: r.tags ?? [],
          summary: r.summary ?? "",
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    if (scored.length === 0) {
      return NextResponse.json({ recommendations: [] });
    }

    // 4) Fetch book details for recommended ids
    const ids = scored.map((s) => s.book_id);
    const { data: booksData, error: booksErr } = await supabase
      .from("books")
      .select(
        "id, title, assignee, book_type, bookType, status, due_date, dueDate, notes, created_at",
      )
      .in("id", ids);

    if (booksErr) {
      // If fetching book details failed, still return ids + scores
      return NextResponse.json({
        recommendations: scored.map((s) => ({
          bookId: s.book_id,
          score: s.score,
          tags: s.tags,
          summary: s.summary,
        })),
      });
    }

    const books = (booksData ?? []) as Array<Record<string, any>>;

    // Map book details into the final recommendation objects preserving score order
    const recommendations = scored.map((s) => {
      const book = books.find((b) => b.id === s.book_id) ?? null;
      return {
        score: s.score,
        tags: s.tags,
        summary: s.summary,
        book,
      };
    });

    return NextResponse.json({ recommendations });
  } catch (err: any) {
    console.error("AI recommend error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
