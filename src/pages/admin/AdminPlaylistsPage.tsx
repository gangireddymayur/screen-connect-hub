import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, ListVideo, Trash2, Pencil, Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Playlist {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  company_id: string;
  item_count?: number;
}

interface ContentItem {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
}

export default function AdminPlaylistsPage() {
  const { user } = useAuth();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Add
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editPlaylist, setEditPlaylist] = useState<Playlist | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePlaylist, setDeletePlaylist] = useState<Playlist | null>(null);

  // Manage items
  const [manageOpen, setManageOpen] = useState(false);
  const [managePlaylist, setManagePlaylist] = useState<Playlist | null>(null);
  const [playlistItems, setPlaylistItems] = useState<any[]>([]);
  const [availableContent, setAvailableContent] = useState<ContentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchPlaylists(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchPlaylists = async (cId: string) => {
    const { data: playlistData, error } = await supabase.from("playlists").select("*").eq("company_id", cId).order("created_at", { ascending: false });
    if (error) { toast.error("Failed to load playlists"); setLoading(false); return; }

    // Get item counts
    const { data: items } = await supabase.from("playlist_items").select("playlist_id");
    const countMap = new Map<string, number>();
    (items ?? []).forEach((i: any) => countMap.set(i.playlist_id, (countMap.get(i.playlist_id) ?? 0) + 1));

    setPlaylists((playlistData ?? []).map((p: any) => ({ ...p, item_count: countMap.get(p.id) ?? 0 })));
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("playlists").insert({ company_id: companyId, name, description: description || null });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Playlist created!");
      setAddOpen(false); setName(""); setDescription("");
      fetchPlaylists(companyId);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editPlaylist || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("playlists").update({ name: editName, description: editDescription || null }).eq("id", editPlaylist.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Playlist updated!"); setEditOpen(false); fetchPlaylists(companyId); }
  };

  const handleDelete = async () => {
    if (!deletePlaylist || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("playlists").delete().eq("id", deletePlaylist.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Playlist deleted!"); setDeleteOpen(false); setDeletePlaylist(null); fetchPlaylists(companyId); }
  };

  const openManage = async (playlist: Playlist) => {
    setManagePlaylist(playlist);
    setManageOpen(true);
    setItemsLoading(true);

    const [itemsRes, contentRes] = await Promise.all([
      supabase.from("playlist_items").select("*, content(id, name, type, file_url)").eq("playlist_id", playlist.id).order("position"),
      supabase.from("content").select("id, name, type, file_url").eq("company_id", playlist.company_id),
    ]);

    setPlaylistItems(itemsRes.data ?? []);
    setAvailableContent(contentRes.data ?? []);
    setItemsLoading(false);
  };

  const addContentToPlaylist = async (contentId: string) => {
    if (!managePlaylist) return;
    const nextPos = playlistItems.length;
    const { error } = await supabase.from("playlist_items").insert({
      playlist_id: managePlaylist.id, content_id: contentId, position: nextPos,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Content added to playlist!");
      openManage(managePlaylist);
      if (companyId) fetchPlaylists(companyId);
    }
  };

  const removeFromPlaylist = async (itemId: string) => {
    const { error } = await supabase.from("playlist_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else if (managePlaylist) {
      toast.success("Removed from playlist");
      openManage(managePlaylist);
      if (companyId) fetchPlaylists(companyId);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Playlists</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage content playlists</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Create Playlist</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Morning Loop" /></div>
                <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." /></div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Creating..." : "Create Playlist"}</Button>
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
            ) : playlists.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <ListVideo className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No playlists yet. Create your first playlist.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Playlist</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-36">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {playlists.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{p.name}</p>
                          {p.description && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{p.item_count}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(p.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="sm" onClick={() => openManage(p)}>Manage</Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditPlaylist(p); setEditName(p.name); setEditDescription(p.description ?? ""); setEditOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeletePlaylist(p); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>Edit Playlist</DialogTitle></DialogHeader>
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
          <DialogHeader><DialogTitle>Delete Playlist</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deletePlaylist?.name}</strong>?</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Playlist Items */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Manage: {managePlaylist?.name}</DialogTitle></DialogHeader>
          {itemsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {playlistItems.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Current Items</p>
                  <div className="space-y-2">
                    {playlistItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-sm">{item.content?.name ?? "Unknown"}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">{item.content?.type}</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFromPlaylist(item.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Add Content</p>
                {availableContent.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No content available. Upload some first.</p>
                ) : (
                  <div className="space-y-1">
                    {availableContent.filter((c) => !playlistItems.some((pi: any) => pi.content_id === c.id)).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{c.name}</span>
                          <span className="text-[10px] uppercase text-muted-foreground">{c.type}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => addContentToPlaylist(c.id)}>
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
