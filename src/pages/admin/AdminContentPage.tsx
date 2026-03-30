import { useEffect, useState, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Image as ImageIcon, Video, Trash2, Upload, FileImage } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface ContentItem {
  id: string;
  name: string;
  type: string;
  file_url: string | null;
  file_size: number | null;
  duration: number;
  created_at: string;
  company_id: string;
}

export default function AdminContentPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ContentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchContent(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchContent = async (cId: string) => {
    const { data, error } = await supabase.from("content").select("*").eq("company_id", cId).order("created_at", { ascending: false });
    if (error) toast.error("Failed to load content");
    else setContent(data ?? []);
    setLoading(false);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !companyId) return;

    setUploading(true);
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
      const type = file.type.startsWith("video") ? "video" : "image";

      const { error: uploadError } = await supabase.storage.from("content").upload(path, file);
      if (uploadError) { toast.error(`Failed to upload ${file.name}`); continue; }

      const { data: urlData } = supabase.storage.from("content").getPublicUrl(path);

      const { error: insertError } = await supabase.from("content").insert({
        company_id: companyId,
        name: file.name,
        type,
        file_url: urlData.publicUrl,
        file_size: file.size,
        duration: type === "image" ? 10 : 30,
      });

      if (insertError) toast.error(`Failed to save ${file.name}`);
    }

    toast.success("Content uploaded!");
    setUploading(false);
    setUploadOpen(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchContent(companyId);
  };

  const handleDelete = async () => {
    if (!deleteItem || !companyId) return;
    setDeleting(true);

    // Delete from storage if file_url exists
    if (deleteItem.file_url) {
      const path = deleteItem.file_url.split("/content/")[1];
      if (path) await supabase.storage.from("content").remove([path]);
    }

    const { error } = await supabase.from("content").delete().eq("id", deleteItem.id);
    setDeleting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Content deleted!");
      setDeleteOpen(false);
      setDeleteItem(null);
      fetchContent(companyId);
    }
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Content</h1>
            <p className="text-sm text-muted-foreground mt-1">Upload and manage your media files</p>
          </div>
          <Button onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Upload Content
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : content.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileImage className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No content yet. Upload your first media file.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {content.map((item) => (
              <Card key={item.id} className="overflow-hidden group">
                <div className="aspect-video bg-muted relative flex items-center justify-center">
                  {item.file_url && item.type === "image" ? (
                    <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                  ) : item.file_url && item.type === "video" ? (
                    <video
                      src={item.file_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                      onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                    />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="destructive" size="icon" className="h-7 w-7" onClick={() => { setDeleteItem(item); setDeleteOpen(true); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white uppercase">{item.type}</span>
                  </div>
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-muted-foreground">{formatSize(item.file_size)}</span>
                    <span className="text-xs text-muted-foreground">{item.duration}s</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Content</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Select images or videos to upload</p>
              <Input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                multiple
                onChange={handleUpload}
                disabled={uploading}
                className="max-w-xs mx-auto"
              />
            </div>
            {uploading && (
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                <span className="text-sm text-muted-foreground">Uploading...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Content</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This will also remove it from any playlists.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
