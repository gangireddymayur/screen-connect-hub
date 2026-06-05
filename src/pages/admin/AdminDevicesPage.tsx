import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Monitor, Pencil, Trash2, MapPin, Search, LogOut } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const isOnline = (lastSeen: string | null) => !!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;

type DeviceStatus = "unpaired" | "waiting_layout" | "online" | "offline";
const getDeviceStatus = (d: { is_paired: boolean; layout_id: string | null; last_seen_at: string | null }, hasActiveSchedule: boolean): DeviceStatus => {
  if (!d.is_paired) return "unpaired";
  const hasLayout = !!d.layout_id || hasActiveSchedule;
  if (!hasLayout) return "waiting_layout";
  return isOnline(d.last_seen_at) ? "online" : "offline";
};

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
  layout_id: string | null;
}

interface LayoutOption {
  id: string;
  name: string;
}

// Pairing flow: TV generates the code, admin enters it here.

export default function AdminDevicesPage() {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [activeScheduleDeviceIds, setActiveScheduleDeviceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "unpaired">("all");

  // Pair dialog
  const [addOpen, setAddOpen] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [orientation, setOrientation] = useState("landscape");
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editOrientation, setEditOrientation] = useState("");

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null);

  // Logout / unpair TV
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [logoutDevice, setLogoutDevice] = useState<Device | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchDevices(data.company_id);
          fetchLayouts(data.company_id);
          fetchActiveSchedules(data.company_id);
        } else {
          setLoading(false);
        }
      });
  }, [user]);

  const fetchLayouts = async (cId: string) => {
    const { data } = await supabase.from("layouts").select("id, name").eq("company_id", cId).order("name");
    setLayouts(data ?? []);
  };

  const fetchActiveSchedules = async (cId: string) => {
    const { data } = await supabase.from("schedules").select("device_id").eq("company_id", cId).eq("is_active", true);
    setActiveScheduleDeviceIds(new Set((data ?? []).map((s: any) => s.device_id).filter(Boolean)));
  };

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
    const cleanCode = pairCode.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
      toast.error("Code must be 6 letters/numbers");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("claim-tv-code", {
      body: { code: cleanCode, name, location: location || null, orientation },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      const errMsg = (data as any)?.error || error?.message || "Pairing failed";
      if (/not found|expired/i.test(errMsg)) {
        toast.error("Code not found or expired", {
          description: "Refresh or reopen the SignageHub app on your TV to generate a new code.",
        });
      } else {
        toast.error(errMsg);
      }
      return;
    }
    toast.success(`${name} paired successfully!`);
    setAddOpen(false);
    setName(""); setLocation(""); setOrientation("landscape"); setPairCode("");
    fetchDevices(companyId);
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
    setEditOrientation(device.orientation ?? "landscape");
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDevice || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("devices").update({
      name: editName, location: editLocation || null,
      orientation: editOrientation,
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
    const { data, error } = await supabase.functions.invoke("logout-tv-device", {
      body: { device_id: deleteDevice.id },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to remove device");
      return;
    }
    toast.success("Device removed. The TV will return to pairing.");
    setDeleteOpen(false);
    setDeleteDevice(null);
    fetchDevices(companyId);
  };

  const handleLogoutDevice = async () => {
    if (!logoutDevice || !companyId) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("logout-tv-device", {
      body: { device_id: logoutDevice.id },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to logout TV");
      return;
    }
    toast.success(`${logoutDevice.name} logged out. The TV will return to pairing.`);
    setLogoutOpen(false);
    setLogoutDevice(null);
    fetchDevices(companyId);
  };

  const handleAssignLayout = async (deviceId: string, layoutId: string | null) => {
    const { error } = await supabase.from("devices").update({ layout_id: layoutId } as any).eq("id", deviceId);
    if (error) toast.error(error.message);
    else {
      toast.success("Layout assigned!");
      if (companyId) fetchDevices(companyId);
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
              <Button><Plus className="h-4 w-4 mr-2" /> Pair Device</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pair a TV</DialogTitle>
              </DialogHeader>
              <div className="text-sm text-muted-foreground -mt-2 mb-1">
                Open the SignageHub app on your TV — it will display a 6-character code. Enter it below.
              </div>
              <div className="text-xs rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                Pairing codes expire after 15 minutes. If pairing fails, refresh or reopen the TV app to get a fresh code.
              </div>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Pairing code (from TV)</Label>
                  <Input
                    value={pairCode}
                    onChange={(e) => setPairCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                    required
                    placeholder="ABC123"
                    maxLength={6}
                    className="font-mono text-center text-lg tracking-[0.4em] uppercase"
                  />
                </div>
                <div className="space-y-2"><Label>Device Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Lobby Screen" /></div>
                <div className="space-y-2"><Label>Location <span className="text-muted-foreground text-xs">(optional)</span></Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main Lobby" /></div>
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <div className="flex gap-2">
                    {["landscape", "portrait"].map((o) => (
                      <Button key={o} type="button" variant={orientation === o ? "default" : "outline"} size="sm" onClick={() => setOrientation(o)} className="capitalize flex-1">{o}</Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting || pairCode.length !== 6}>
                  {submitting ? "Pairing..." : "Pair Device"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="unpaired">Unpaired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

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
            ) : (() => {
              const filtered = devices.filter((d) => {
                const matchesSearch = !searchQuery ||
                  d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (d.location ?? "").toLowerCase().includes(searchQuery.toLowerCase());
                const online = d.is_paired && isOnline(d.last_seen_at);
                const matchesStatus =
                  statusFilter === "all" ||
                  (statusFilter === "online" && online) ||
                  (statusFilter === "offline" && d.is_paired && !online) ||
                  (statusFilter === "unpaired" && !d.is_paired);
                return matchesSearch && matchesStatus;
              });
              if (filtered.length === 0) {
                return <div className="text-center py-12 text-sm text-muted-foreground">No devices match your filters.</div>;
              }
              return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Layout</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Monitor className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{d.name}</p>
                            <p className="text-xs text-muted-foreground capitalize">{d.orientation}{d.resolution ? ` · ${d.resolution}` : ''}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const hasActiveSched = activeScheduleDeviceIds.has(d.id);
                          const status = getDeviceStatus(d, hasActiveSched);
                          if (status === "unpaired") {
                            return <Badge variant="outline" className="text-xs">Unpaired / Pairing</Badge>;
                          }
                          if (status === "waiting_layout") {
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Waiting for layout</span>
                              </div>
                            );
                          }
                          if (status === "online") {
                            return (
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Online / Playing</span>
                              </div>
                            );
                          }
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                              <span className="text-xs text-muted-foreground">
                                Offline{d.last_seen_at ? ` · ${formatDistanceToNow(new Date(d.last_seen_at), { addSuffix: true })}` : ""}
                              </span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {d.location ? (
                          <div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-sm">{d.location}</span></div>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const hasActiveSched = activeScheduleDeviceIds.has(d.id);
                          const needsLayout = d.is_paired && !d.layout_id && !hasActiveSched;
                          return (
                            <div className="space-y-1">
                              <Select
                                value={d.layout_id || "none"}
                                onValueChange={(v) => handleAssignLayout(d.id, v === "none" ? null : v)}
                              >
                                <SelectTrigger
                                  className={`h-8 text-xs w-40 ${needsLayout ? "border-amber-500 ring-1 ring-amber-500/40" : ""}`}
                                >
                                  <SelectValue placeholder={needsLayout ? "Required — select layout" : "No layout"} />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No layout</SelectItem>
                                  {layouts.map((l) => (
                                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {needsLayout && (
                                <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight max-w-[10rem]">
                                  Assign a default layout, or create an active schedule for this device.
                                </p>
                              )}
                              {!needsLayout && hasActiveSched && !d.layout_id && (
                                <p className="text-[10px] text-muted-foreground leading-tight max-w-[10rem]">
                                  Using active schedule
                                </p>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          {d.is_paired && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-amber-600 hover:text-amber-700"
                              onClick={() => { setLogoutDevice(d); setLogoutOpen(true); }}
                              title="Logout TV"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteDevice(d); setDeleteOpen(true); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              );
            })()}
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
            <div className="space-y-2">
              <Label>Orientation</Label>
              <div className="flex gap-2">
                {["landscape", "portrait"].map((o) => (
                  <Button key={o} type="button" variant={editOrientation === o ? "default" : "outline"} size="sm" onClick={() => setEditOrientation(o)} className="capitalize flex-1">{o}</Button>
                ))}
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
          <p className="text-sm text-muted-foreground">Unpair and remove <strong>{deleteDevice?.name}</strong>? The TV will be logged out and return to the pairing screen. All schedules for this device will also be removed.</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete Device"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Logout TV</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Logout <strong>{logoutDevice?.name}</strong>? The TV app will clear its pairing and show a new pairing code.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setLogoutOpen(false)}>Cancel</Button>
            <Button onClick={handleLogoutDevice} disabled={submitting}>{submitting ? "Logging out..." : "Logout TV"}</Button>
          </div>
        </DialogContent>
      </Dialog>

    </AdminLayout>
  );
}
