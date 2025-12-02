"use client";

import { useEffect, useState } from "react";
import { BookPlusIcon, CheckCircle, Edit, Loader2, PlayIcon, Trash2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

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

type Props = {
  refreshSignal?: number;
};

export default function TableView({ refreshSignal }: Props) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ id: string; action: string } | null>(
    null,
  );
  const [editing, setEditing] = useState<Book | null>(null);
  const supabase = createClient();

  const fetchBooks = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("books")
        .select("*")
        .order("created_at", { ascending: false });
      const booksData = data as Book[] | null;
      if (fetchError) {
        setError(fetchError.message || "Failed to fetch books");
        setBooks([]);
      } else {
        setBooks(booksData ?? []);
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooks();
  }, [refreshSignal]);

  const setPendingAction = (id: string, action: string) => {
    setPending({ id, action });
  };

  const clearPending = () => {
    setPending(null);
  };

  const toggleStatus = async (book: Book) => {
    if (!book?.id) return;
    setPendingAction(book.id, "toggle");
    try {
      const next = book.status === "checked-in" ? "checked-out" : "checked-in";
      const { error: updateError } = await supabase
        .from("books")
        .update({ status: next })
        .eq("id", book.id);
      if (updateError) throw updateError;
      await fetchBooks();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      clearPending();
    }
  };

  const deleteBook = async (book: Book) => {
    if (!book?.id) return;
    setPendingAction(book.id, "delete");
    try {
      const { error: deleteError } = await supabase
        .from("books")
        .delete()
        .eq("id", book.id);
      if (deleteError) throw deleteError;
      await fetchBooks();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      clearPending();
    }
  };

  const saveEdit = async (id: string, patch: Partial<Book>) => {
    setPendingAction(id, "save");
    try {
      const { error: updateError } = await supabase
        .from("books")
        .update(patch)
        .eq("id", id);
      if (updateError) throw updateError;
      setEditing(null);
      await fetchBooks();
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      clearPending();
    }
  };

  const isPending = (id: string, action?: string) => {
    if (!pending) return false;
    if (action) return pending.id === id && pending.action === action;
    return pending.id === id;
  };

  const renderRow = (book: Book) => {
    const id = book.id;
    const busy = isPending(id);
    return (
      <TableRow key={id} className="hover:bg-muted/50">
        <TableCell className="h-16 px-4 font-medium">{book.title}</TableCell>
        <TableCell className="h-16 px-4 text-sm text-muted-foreground">
          {book.assignee ?? "N/A"}
        </TableCell>
        <TableCell className="h-16 px-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{book.book_type ?? book.bookType ?? "other"}</span>
          </div>
        </TableCell>
        <TableCell className="h-16 px-4">
          {getStatusBadge((book.status as any) ?? "checked-in")}
        </TableCell>
        <TableCell className="h-16 px-4 text-sm text-muted-foreground">
          {book.due_date ?? book.dueDate ?? "-"}
        </TableCell>
        <TableCell className="h-16 px-4 max-w-[300px] text-sm text-muted-foreground">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block cursor-help truncate">
                  {book.notes ?? ""}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-md">
                {book.notes ?? ""}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell className="h-16 px-4 justify-end flex">
          <TooltipProvider>
            <div className="flex items-center gap-1">
              {book.status === "checked-in" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleStatus(book)}
                      disabled={busy}
                    >
                      {isPending(id, "toggle") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Check Out</TooltipContent>
                </Tooltip>
              )}
              {book.status === "checked-out" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => toggleStatus(book)}
                      disabled={busy}
                    >
                      {isPending(id, "toggle") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Check In</TooltipContent>
                </Tooltip>
              )}
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={busy}
                    onClick={() => setEditing(book)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Edit Book</SheetTitle>
                    <SheetDescription>
                      Edit "{book.title}" details below.
                    </SheetDescription>
                  </SheetHeader>
                  <EditForm
                    book={book}
                    onSave={(patch) => saveEdit(book.id, patch)}
                    onCancel={() => setEditing(null)}
                  />
                </SheetContent>
              </Sheet>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive hover:text-white"
                    disabled={busy}
                  >
                    {isPending(id, "delete") ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2Icon className="h-4 w-4" />
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete book?</AlertDialogTitle>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deleteBook(book)}
                      className="bg-destructive text-white"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TooltipProvider>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="rounded-lg border bg-card max-w-[calc(100vw-16rem-40px)] w-[calc(100vw-16rem-40px)]">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-b">
            <TableHead className="h-12 px-4 font-medium">Title</TableHead>
            <TableHead className="h-12 px-4 font-medium">Assignee</TableHead>
            <TableHead className="h-12 px-4 font-medium">Book Type</TableHead>
            <TableHead className="h-12 px-4 font-medium w-[120px]">
              Status
            </TableHead>
            <TableHead className="h-12 px-4 font-medium">Due Date</TableHead>
            <TableHead className="h-12 px-4 font-medium">Notes</TableHead>
            <TableHead className="h-12 px-4 font-medium text-end w-[180px]">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={7} className="p-4">
                Loading...
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={7} className="p-4 text-destructive">
                {error}
              </TableCell>
            </TableRow>
          ) : books.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="p-4">
                <Empty>
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <BookPlusIcon />
                    </EmptyMedia>
                    <EmptyTitle>No Books Yet</EmptyTitle>
                    <EmptyDescription>
                      You haven&apos;t created any books yet. Get started by
                      creating your first book.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              </TableCell>
            </TableRow>
          ) : (
            books.map(renderRow)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function getStatusBadge(status: Book["status"]) {
  switch (status) {
    case "checked-in":
      return (
        <Badge
          variant="outline"
          className="bg-green-500/15 text-green-700 border-0"
        >
          Checked In
        </Badge>
      );
    case "checked-out":
      return (
        <Badge
          variant="outline"
          className="bg-amber-500/15 text-amber-700 border-0"
        >
          Checked Out
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function EditForm({
  book,
  onSave,
  onCancel,
}: {
  book: Book;
  onSave: (patch: Partial<Book>) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(book.title ?? "");
  const [assignee, setAssignee] = useState(book.assignee ?? "");
  const [bookType, setBookType] = useState(
    book.book_type ?? book.bookType ?? "other",
  );
  const [status, setStatus] = useState<Book["status"]>(
    book.status ?? "checked-in",
  );
  const [dueDate, setDueDate] = useState(book.due_date ?? book.dueDate ?? "");
  const [notes, setNotes] = useState(book.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    await onSave({
      title: title.trim(),
      assignee: assignee.trim(),
      book_type: bookType,
      status,
      due_date: dueDate || null,
      notes: notes || "",
    });
    setSaving(false);
  };

  return (
    <form
      className="grid flex-1 auto-rows-min gap-6 px-4 py-2"
      onSubmit={handleSave}
    >
      <div className="grid gap-3">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-3">
        <Label>Assignee / Borrower</Label>
        <Input value={assignee} onChange={(e) => setAssignee(e.target.value)} />
      </div>
      <div className="grid gap-3">
        <Label>Book Type</Label>
        <Select value={bookType} onValueChange={(v) => setBookType(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a type" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Book type</SelectLabel>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="fiction">Fiction</SelectItem>
              <SelectItem value="non-fiction">Non-fiction</SelectItem>
              <SelectItem value="science-fiction">Science Fiction</SelectItem>
              <SelectItem value="biography">Biography</SelectItem>
              <SelectItem value="fantasy">Fantasy</SelectItem>
              <SelectItem value="mystery">Mystery</SelectItem>
              <SelectItem value="thriller">Thriller</SelectItem>
              <SelectItem value="romance">Romance</SelectItem>
              <SelectItem value="historical">Historical</SelectItem>
              <SelectItem value="poetry">Poetry</SelectItem>
              <SelectItem value="self-help">Self-help</SelectItem>
              <SelectItem value="young-adult">Young Adult</SelectItem>
              <SelectItem value="children">Children's</SelectItem>
              <SelectItem value="graphic-novel">Graphic Novel</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-3">
        <Label>Due Date</Label>
        <Input
          type="date"
          value={dueDate ?? ""}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>
      <div className="grid gap-3">
        <Label>Notes</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="grid gap-3">
        <Label>Status</Label>
        <Select
          value={(status as any) ?? "checked-in"}
          onValueChange={(v) => setStatus(v as any)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Status</SelectLabel>
              <SelectItem value="checked-in">Checked In</SelectItem>
              <SelectItem value="checked-out">Checked Out</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
        <SheetClose asChild>
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </SheetClose>
      </div>
    </form>
  );
}
