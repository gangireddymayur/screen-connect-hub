import { useEffect, useState, useRef, useMemo } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Image as ImageIcon, Trash2, Upload, FileImage, X, Search, HardDrive, CheckSquare, Square } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getStorageQuota, formatBytes, PLAN_LABELS } from "@/lib/plan-quotas";

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

const formatSize = (bytes: number | null) => bytes ? formatBytes(bytes) : "—";

export default function AdminContentPage() {
  const { user } = useAuth();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("starter");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ContentItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewItem, setPreviewItem] = useState<ContentItem | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "image" | "video">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(async ({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          const { data: company } = await supabase.from("companies").select("plan").eq("id", data.company_id).single();
          if (company) setPlan(company.plan ?? "starter");
          fetchContent(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchContent = async (cId: string) => {
    const { data, error } = await supabase.from("content").select("*").eq("company_id", cId).order("created_at", { ascending: false });
    if (error) toast.error("Failed to load content");
    else setContent(data ?? []);
    setLoading(false);
    setSelected(new Set());
  };

  const totalStorage = useMemo(() => content.reduce((s, c) => s + (c.file_size || 0), 0), [content]);
  const storageQuota = getStorageQuota(plan);
  const storagePct = Math.min(100, (totalStorage / storageQuota) * 100);
  const isOverQuota = totalStorage >= storageQuota;

  const filtered = useMemo(() => content.filter((c) => {
    const matchesSearch = !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || c.type === typeFilter;
    return matchesSearch && matchesType;
  }), [content, searchQuery, typeFilter]);

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
        company_id: companyId, name: file.name, type,
        file_url: urlData.publicUrl, file_size: file.size,
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

  const handleBulkDelete = async () => {
    if (selected.size === 0 || !companyId) return;
    setDeleting(true);
    const items = content.filter((c) => selected.has(c.id));
    const paths = items.map((i) => i.file_url?.split("/content/")[1]).filter(Boolean) as string[];
    if (paths.length > 0) await supabase.storage.from("content").remove(paths);
    const { error } = await supabase.from("content").delete().in("id", Array.from(selected));
    setDeleting(false);
    if (error) toast.error(error.message);
    else {
      toast.success(`Deleted ${selected.size} items`);
      setBulkDeleteOpen(false);
      fetchContent(companyId);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((c) => c.id)));
  };

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

        <Card className={isOverQuota ? "border-destructive/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm">
                <HardDrive className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatSize(totalStorage)}</span>
                <span className="text-muted-foreground">of {formatBytes(storageQuota)} used</span>
                <Badge variant="secondary" className="ml-1 text-xs">{PLAN_LABELS[plan] ?? plan} plan</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{content.length} files</span>
            </div>
            <Progress value={storagePct} className="h-2" />
            {isOverQuota && (
              <p className="text-xs text-destructive mt-2">
                Storage quota reached. Delete files or upgrade your plan to upload more.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
              </SelectContent>
            </Select>
            {filtered.length > 0 && (
              <Button variant="outline" onClick={toggleSelectAll} className="gap-2">
                {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                {allSelected ? "Unselect all" : "Select all"}
              </Button>
            )}
          </CardContent>
        </Card>

        {selected.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg border bg-primary/5 border-primary/30">
            <span className="text-sm font-medium">{selected.size} selected</span>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete {selected.size}
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileImage className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">{content.length === 0 ? "No content yet. Upload your first media file." : "No content matches your filters."}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((item) => {
              const isSelected = selected.has(item.id);
              return (
                <Card key={item.id} className={`overflow-hidden group cursor-pointer transition-all ${isSelected ? "ring-2 ring-primary" : ""}`} onClick={() => setPreviewItem(item)}>
                  <div className="aspect-video bg-muted relative flex items-center justify-center">
                    {item.file_url && item.type === "image" ? (
                      <img src={item.file_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : item.file_url && item.type === "video" ? (
                      <video src={item.file_url} className="w-full h-full object-cover" muted preload="metadata"
                        onMouseEnter={(e) => (e.target as HTMLVideoElement).play()}
                        onMouseLeave={(e) => { const v = e.target as HTMLVideoElement; v.pause(); v.currentTime = 0; }}
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      className={`absolute top-2 left-2 h-6 w-6 rounded flex items-center justify-center transition-opacity ${isSelected ? "bg-primary text-primary-foreground opacity-100" : "bg-black/60 text-white opacity-0 group-hover:opacity-100"}`}
                    >
                      {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                    </button>
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="destructive" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setDeleteItem(item); setDeleteOpen(true); }}>
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
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Upload Content</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">Select images or videos to upload</p>
              <Input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={handleUpload} disabled={uploading} className="max-w-xs mx-auto" />
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

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Content</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteItem?.name}</strong>?</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {selected.size} items</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{selected.size}</strong> content items? This cannot be undone.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>{deleting ? "Deleting..." : `Delete ${selected.size}`}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewItem(null)}>
          <Button variant="ghost" size="icon" className="absolute top-4 right-4 text-white hover:bg-white/20 z-10" onClick={() => setPreviewItem(null)}>
            <X className="h-6 w-6" />
          </Button>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/60 px-4 py-2 rounded-lg">{previewItem.name}</div>
          <div className="max-w-[90vw] max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {previewItem.type === "video" && previewItem.file_url ? (
              <video src={previewItem.file_url} className="max-w-[90vw] max-h-[85vh] rounded-lg" controls autoPlay playsInline />
            ) : previewItem.file_url ? (
              <img src={previewItem.file_url} alt={previewItem.name} className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" />
            ) : null}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
