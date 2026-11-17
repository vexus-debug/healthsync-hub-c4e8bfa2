import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { fetchCannedComments, saveCannedComment, deleteCannedComment } from "@/lib/cannedComments";

type Draft = { id?: string; shortcut: string; title: string; body: string };
const blank: Draft = { shortcut: "", title: "", body: "" };

export const CannedCommentsManager = () => {
  const qc = useQueryClient();
  const { data: comments = [] } = useQuery({ queryKey: ["canned_comments"], queryFn: fetchCannedComments });
  const [d, setD] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!d.shortcut.trim() || !d.title.trim() || !d.body.trim()) return toast.error("Fill shortcut, title and text");
    setBusy(true);
    try {
      await saveCannedComment(d);
      qc.invalidateQueries({ queryKey: ["canned_comments"] });
      setD(blank);
      toast.success("Comment saved");
    } catch (e: any) { toast.error(e.message || "Failed to save"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await deleteCannedComment(id); qc.invalidateQueries({ queryKey: ["canned_comments"] }); toast.success("Deleted"); }
    catch (e: any) { toast.error(e.message || "Failed to delete"); }
  };

  return (
    <Card className="border-border/60 shadow-soft">
      <CardHeader><CardTitle className="text-base">Canned Comments</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-[140px_1fr] gap-2">
          <Input placeholder=".shortcut" value={d.shortcut} onChange={(e) => setD({ ...d, shortcut: e.target.value })} className="font-mono" />
          <Input placeholder="Title" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} />
        </div>
        <Textarea placeholder="Full remark text" value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} />
        <div className="flex gap-2">
          <Button variant="hero" onClick={save} disabled={busy}><Plus className="h-4 w-4" /> {d.id ? "Update" : "Add"} comment</Button>
          {d.id && <Button variant="ghost" onClick={() => setD(blank)}>Cancel</Button>}
        </div>
        <div className="divide-y divide-border border border-border rounded-xl">
          {comments.map((c) => (
            <div key={c.id} className="p-3 flex gap-3 items-start">
              <div className="flex-1 min-w-0">
                <p className="text-sm"><span className="font-mono text-primary mr-2">{c.shortcut}</span>{c.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{c.body}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setD(c)}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          {comments.length === 0 && <p className="p-3 text-sm text-muted-foreground">No comments yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
};
