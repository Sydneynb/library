"use client";

import { useEffect, useState, useCallback } from "react";
import AddNew from "@/components/add-new";
import TableView from "@/components/table-view";
import { createClient } from "@/lib/supabase/client";

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
        setBooks(data ?? []);
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

  const handleToggleStatus = async (
    id: string,
    current: string | undefined,
  ) => {
    const nextStatus = current === "checked-in" ? "checked-out" : "checked-in";
    await handleUpdate(id, { status: nextStatus });
  };

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
        <AddNew onCreated={triggerRefresh} />
      </div>

      <div className="mb-4">
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      <div>
        <TableView
          // force remount when data changes so the existing TableView UI refreshes
          key={refreshSignal}
        />
      </div>
    </div>
  );
}
