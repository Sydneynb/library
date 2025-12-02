import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type GenerateRequest = {
  bookId?: string;
};

export async function POST(request: Request) {
  try {
    const body: GenerateRequest = await request.json();
    const { bookId } = body;
    if (!bookId) {
      return NextResponse.json({ error: "Missing bookId" }, { status: 400 });
    }

    const supabase = await createClient();

    // fetch book data
    const { data: bookData, error: bookError } = await supabase
      .from("books")
      .select("id, title, assignee, notes")
      .eq("id", bookId)
      .maybeSingle();

    if (bookError) {
      // An actual error occurred when querying the DB
      return NextResponse.json(
        { error: (bookError as any)?.message ?? "Failed to fetch book" },
        { status: 500 },
      );
    }

    if (!bookData) {
      // No row matched the provided bookId
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    // bookError and missing bookData are already handled above; no further action required here.

    const textToSummarize = [bookData.title, bookData.assignee, bookData.notes]
      .filter(Boolean)
      .join("\n\n");

    const OPENAI_KEY = process.env.OPENAI_API_KEY;

    let summary = "";
    let tags: string[] = [];
    let embedding: number[] | null = null;

    if (OPENAI_KEY) {
      // 1) Chat completion to generate summary + tags
      try {
        const summaryResp = await fetch(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${OPENAI_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "system",
                  content: "You are a concise book summarizer and tagger.",
                },
                {
                  role: "user",
                  content: `Summarize the following book in 2 sentences and return 4 comma-separated tags on the last line:\n\n${textToSummarize}`,
                },
              ],
              max_tokens: 200,
            }),
          },
        );

        const summaryJson = await summaryResp.json();
        const text = summaryJson?.choices?.[0]?.message?.content ?? "";
        summary = String(text).trim();

        // Try to parse tags from the last line (naive)
        const lastLine = summary.split("\n").pop() ?? "";
        if (lastLine.includes(",")) {
          tags = lastLine
            .split(",")
            .slice(0, 6)
            .map((t: string) => t.trim())
            .filter(Boolean);
        } else {
          // if not found in last line, leave tags empty for fallback below
          tags = [];
        }
      } catch (err) {
        console.error("Summary generation failed:", err);
      }

      // 2) Embedding generation
      try {
        const embResp = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-3-small",
            input: textToSummarize || bookData.title,
          }),
        });
        const embJson = await embResp.json();
        embedding = embJson?.data?.[0]?.embedding ?? null;
      } catch (err) {
        console.error("Embedding generation failed:", err);
      }
    }

    // Fallbacks if OpenAI is not configured or calls failed
    if (!summary) {
      summary =
        (bookData.notes && String(bookData.notes).slice(0, 200)) ||
        `A book titled "${bookData.title}"`;
    }

    if (!tags || tags.length === 0) {
      tags = (bookData.title || "")
        .split(/\s+/)
        .slice(0, 4)
        .map((s: string) => s.toLowerCase())
        .filter(Boolean);
    }

    if (!embedding) {
      // deterministic mock embedding (small vector)
      const seed = String(textToSummarize || bookData.title || "");
      const vec: number[] = new Array(153).fill(0).map((_, i) => {
        let v = 0;
        for (let j = i; j < seed.length; j += 1) v += seed.charCodeAt(j) % 97;
        return Number(((v % 100) / 100).toFixed(4));
      });
      embedding = vec;
    }

    // persist results into book_ai (create table beforehand)
    const upsertPayload = {
      book_id: bookId,
      summary,
      tags,
      embedding,
      updated_at: new Date().toISOString(),
    } as any;

    const { error: upsertError } = await supabase
      .from("book_ai")
      .upsert(upsertPayload, { onConflict: "book_id" });

    if (upsertError) {
      console.error("Failed to upsert book_ai:", upsertError);
      return NextResponse.json(
        { error: (upsertError as any)?.message ?? "Upsert failed" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, summary, tags });
  } catch (err: any) {
    console.error("AI generate error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
