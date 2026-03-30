import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, LayoutGrid, Trash2, Pencil, Monitor } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Layout {
  id: string;
  name: string;
  description: string | null;
  resolution_width: number;
  resolution_height: number;
  background_color: string;
  created_at: string;
  updated_at: string;
  company_id: string;
}

export default function AdminLayoutsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resWidth, setResWidth] = useState(1920);
  const [resHeight, setResHeight] = useState(1080);
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLayout, setEditLayout] = useState<Layout | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLayout, setDeleteLayout] = useState<Layout | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchLayouts(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchLayouts = async (cId: string) => {
    const { data, error } = await supabase
      .from("layouts")
      .select("*")
      .eq("company_id", cId)
      .order("updated_at", { ascending: false });
    if (error) { toast.error("Failed to load layouts"); setLoading(false); return; }
    setLayouts(data ?? []);
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("layouts").insert({
      company_id: companyId,
      name,
      description: description || null,
      resolution_width: resWidth,
      resolution_height: resHeight,
    }).select().single();
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Layout created!");
      setAddOpen(false);
      setName(""); setDescription(""); setResWidth(1920); setResHeight(1080);
      // Navigate to editor
      navigate(`/admin/layouts/${data.id}`);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLayout || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("layouts").update({
      name: editName,
      description: editDescription || null,
      updated_at: new Date().toISOString(),
    }).eq("id", editLayout.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Layout updated!"); setEditOpen(false); fetchLayouts(companyId); }
  };

  const handleDelete = async () => {
    if (!deleteLayout || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("layouts").delete().eq("id", deleteLayout.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Layout deleted!"); setDeleteOpen(false); setDeleteLayout(null); fetchLayouts(companyId); }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Layouts</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage screen layouts</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Layout</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Layout</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Lobby Display" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Width (px)</Label>
                    <Input type="number" value={resWidth} onChange={(e) => setResWidth(parseInt(e.target.value) || 1920)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Height (px)</Label>
                    <Input type="number" value={resHeight} onChange={(e) => setResHeight(parseInt(e.target.value) || 1080)} />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating..." : "Create & Edit Layout"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : layouts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <LayoutGrid className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No layouts yet. Create your first layout.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Layout</TableHead>
                    <TableHead>Resolution</TableHead>
                    <TableHead>Last Modified</TableHead>
                    <TableHead className="w-44">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {layouts.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{l.name}</p>
                          {l.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{l.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{l.resolution_width}×{l.resolution_height}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(l.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => navigate(`/admin/layouts/${l.id}`)}>
                            Edit Layout
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                            setEditLayout(l); setEditName(l.name); setEditDescription(l.description ?? ""); setEditOpen(true);
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                            setDeleteLayout(l); setDeleteOpen(true);
                          }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Layout</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2"><Label>Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Layout</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteLayout?.name}</strong>?</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
