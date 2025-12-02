"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";

type Props = {
  children?: React.ReactNode;
  onCreated?: () => void;
};

export default function AddNew({ children, onCreated }: Props) {
  const [title, setTitle] = useState("");
  const [bookType, setBookType] = useState("other");
  const [assignee, setAssignee] = useState("N/A");
  const [status, setStatus] = useState<"checked-in" | "checked-out">(
    "checked-in",
  );
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetForm = () => {
    setTitle("");
    setBookType("other");
    setAssignee("N/A");
    setStatus("checked-in");
    setDueDate("");
    setNotes("");
    setError(null);
    setSuccess(false);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const payload = {
        title: title.trim(),
        assignee: assignee.trim() || "N/A",
        book_type: bookType,
        status,
        due_date: dueDate || null,
        notes: notes || "",
      };

      const { data, error: insertError } = await supabase
        .from("books")
        .insert([payload]);

      if (insertError) {
        setError(insertError.message || "Failed to create book");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
      onCreated?.();
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? String(err));
      setLoading(false);
    }
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children ?? <Button>Add new</Button>}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Create new book</SheetTitle>
          <SheetDescription>
            Create a new book by filling out the form below.
          </SheetDescription>
        </SheetHeader>

        <form
          className="grid flex-1 auto-rows-min gap-6 px-4 py-2"
          onSubmit={handleCreate}
        >
          <div className="grid gap-3">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              required
            />
          </div>

          <div className="grid gap-3">
            <Label>Book type</Label>
            <Select value={bookType} onValueChange={(v: any) => setBookType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Book type</SelectLabel>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="fiction">Fiction</SelectItem>
                  <SelectItem value="non-fiction">Non-fiction</SelectItem>
                  <SelectItem value="science-fiction">
                    Science Fiction
                  </SelectItem>
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
            <Label>Assignee / Borrower</Label>
            <Input
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="N/A"
            />
          </div>

          <div className="grid gap-3">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v: any) => setStatus(v as any)}>
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

          <div className="grid gap-3">
            <Label>Due Date</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>

          <div className="grid gap-3">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes about the book"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create book"}
            </Button>
            <SheetClose asChild>
              <Button variant="outline">Close</Button>
            </SheetClose>
            {success && (
              <div className="text-sm text-green-600">Book created</div>
            )}
            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
        </form>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}
