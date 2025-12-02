"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AddNew from "@/components/add-new";
import TableView from "@/components/table-view";
import AIRecommendations from "@/components/ai-recommendations";
import { createClient } from "@/lib/supabase/client";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Book = {
  id: string;
  title: string;
  assignee?: string | null;
  book_type?: string | null;
  bookType?: string | null;
  status?: "checked-in" | "checked-out" | string | null;
  due_date?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  created_at?: string | null;
};

export default function BooksManager() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [search, setSearch] = useState("");

  const supabase = createClient();

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      if (fetchError) {
        setError(fetchError.message || "Failed to fetch books");
        setBooks([]);
      } else {
        setBooks((data as Book[] | null) ?? []);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks, refreshSignal]);

  const triggerRefresh = () => setRefreshSignal((s) => s + 1);

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from("books")
        .delete()
        .eq("id", id);
      if (deleteError) {
        setError(deleteError.message || "Failed to delete book");
      } else {
        triggerRefresh();
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Book>) => {
    setLoading(true);
    setError(null);
    try {
      const { error: updateError } = await supabase
        .from("books")
        .update(patch)
        .eq("id", id);
      if (updateError) {
        setError(updateError.message || "Failed to update book");
      } else {
        triggerRefresh();
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, current?: string) => {
    const nextStatus = current === "checked-in" ? "checked-out" : "checked-in";
    await handleUpdate(id, { status: nextStatus });
  };

  const filteredCount = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return books.length;
    return books.filter((b) => {
      const title = (b.title ?? "").toLowerCase();
      const assignee = (b.assignee ?? "").toLowerCase();
      const type = (b.book_type ?? b.bookType ?? "").toLowerCase();
      const notes = (b.notes ?? "").toLowerCase();
      return (
        title.includes(q) ||
        assignee.includes(q) ||
        type.includes(q) ||
        notes.includes(q)
      );
    }).length;
  }, [books, search]);

  return (
    <div className="w-full h-full">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="font-mono text-2xl font-medium">Books</h1>
          <div className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${books.length} book${books.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Sheet>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>AI Recommendations</SheetTitle>
                <SheetDescription>
                  Suggestions based on your saved books
                </SheetDescription>
              </SheetHeader>
              <div className="p-4">
                <AIRecommendations bookId={books[0]?.id ?? ""} topK={5} />
              </div>
            </SheetContent>
          </Sheet>

          <AddNew onCreated={triggerRefresh} />
        </div>
      </div>

      <div className="mb-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      <InputGroup className="mb-3">
        <InputGroupInput
          placeholder="Search..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setSearch(e.target.value)
          }
        />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          {filteredCount} results
        </InputGroupAddon>
      </InputGroup>

      <div>
        {/* Pass the search prop to TableView so the table can filter server- or client-side */}
        {/* @ts-ignore - TableView's props may not include `search` in its current type; runtime passing is intended */}
        <TableView
          key={refreshSignal}
          refreshSignal={refreshSignal}
          search={search}
        />
      </div>
    </div>
  );
}
