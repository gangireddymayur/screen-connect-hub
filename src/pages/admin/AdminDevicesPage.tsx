import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Monitor, Pencil, Trash2, MapPin, Wifi, WifiOff, Copy, Check, Link2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { toast } from "sonner";

interface Device {
  id: string;
  name: string;
  status: string;
  location: string | null;
  resolution: string | null;
  orientation: string | null;
  pairing_code: string | null;
  is_paired: boolean;
  last_seen_at: string | null;
  created_at: string;
  company_id: string;
}

const generatePairingCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

export default function AdminDevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [resolution, setResolution] = useState("1920x1080");
  const [orientation, setOrientation] = useState("landscape");
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editResolution, setEditResolution] = useState("");
  const [editOrientation, setEditOrientation] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchDevices(data.company_id);
        } else {
          setLoading(false);
        }
      });
  }, [user]);

  const fetchDevices = async (cId: string) => {
    const { data, error } = await supabase.from("devices").select("*").eq("company_id", cId).order("created_at", { ascending: false });
    if (error) toast.error("Failed to load devices");
    else setDevices(data ?? []);
    setLoading(false);
  };

  // Pairing code result
  const [newPairingCode, setNewPairingCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    const pairingCode = generatePairingCode();
    const { error } = await supabase.from("devices").insert({
      company_id: companyId, name, location: location || null,
      resolution, orientation, pairing_code: pairingCode,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      setAddOpen(false);
      setName(""); setLocation(""); setResolution("1920x1080"); setOrientation("landscape");
      setNewPairingCode(pairingCode);
      fetchDevices(companyId);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success("Pairing code copied!");
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const openEdit = (device: Device) => {
    setEditDevice(device);
    setEditName(device.name);
    setEditLocation(device.location ?? "");
    setEditResolution(device.resolution ?? "1920x1080");
    setEditOrientation(device.orientation ?? "landscape");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDevice || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("devices").update({
      name: editName, location: editLocation || null,
      resolution: editResolution, orientation: editOrientation,
    }).eq("id", editDevice.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Device updated!");
      setEditOpen(false);
      fetchDevices(companyId);
    }
  };

  const handleDelete = async () => {
    if (!deleteDevice || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("devices").delete().eq("id", deleteDevice.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Device deleted!");
      setDeleteOpen(false);
      setDeleteDevice(null);
      fetchDevices(companyId);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Devices</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage your digital signage screens</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Device</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Device</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2"><Label>Device Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Lobby Screen" /></div>
                <div className="space-y-2"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Lobby" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Resolution</Label><Input value={resolution} onChange={(e) => setResolution(e.target.value)} /></div>
                  <div className="space-y-2">
                    <Label>Orientation</Label>
                    <div className="flex gap-2">
                      {["landscape", "portrait"].map((o) => (
                        <Button key={o} type="button" variant={orientation === o ? "default" : "outline"} size="sm" onClick={() => setOrientation(o)} className="capitalize flex-1">{o}</Button>
                      ))}
                    </div>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Adding..." : "Add Device"}</Button>
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
            ) : devices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Monitor className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No devices yet. Add your first screen.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Pairing Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Monitor className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{d.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{d.orientation} · {d.resolution}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {d.pairing_code ? (
                          <div className="flex items-center gap-1.5">
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded tracking-widest">{d.pairing_code}</code>
                            {d.is_paired ? (
                              <Link2 className="h-3.5 w-3.5 text-primary" />
                            ) : (
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(d.pairing_code!)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {d.is_paired ? (
                            <StatusBadge status="active" />
                          ) : (
                            <span className="text-xs text-muted-foreground">Unpaired</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {d.location ? (
                          <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{d.location}</span></div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteDevice(d); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
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
          <DialogHeader><DialogTitle>Edit Device</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2"><Label>Device Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required /></div>
            <div className="space-y-2"><Label>Location</Label><Input value={editLocation} onChange={(e) => setEditLocation(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Resolution</Label><Input value={editResolution} onChange={(e) => setEditResolution(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Orientation</Label>
                <div className="flex gap-2">
                  {["landscape", "portrait"].map((o) => (
                    <Button key={o} type="button" variant={editOrientation === o ? "default" : "outline"} size="sm" onClick={() => setEditOrientation(o)} className="capitalize flex-1">{o}</Button>
                  ))}
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving..." : "Save Changes"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Device</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete <strong>{deleteDevice?.name}</strong>? This will also remove all schedules for this device.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete Device"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pairing Code Result */}
      <Dialog open={!!newPairingCode} onOpenChange={(open) => !open && setNewPairingCode(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Device Created!</DialogTitle></DialogHeader>
          <div className="text-center space-y-4 py-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Monitor className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Use this pairing code on your TV to connect:</p>
              <div className="flex items-center justify-center gap-3">
                <code className="text-3xl font-mono font-bold tracking-[0.3em] bg-muted px-6 py-3 rounded-lg">{newPairingCode}</code>
              </div>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => copyCode(newPairingCode!)}>
              {codeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {codeCopied ? "Copied!" : "Copy Code"}
            </Button>
            <p className="text-xs text-muted-foreground">Enter this code on your TV app to pair it with your account.</p>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
