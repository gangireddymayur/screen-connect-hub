import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Monitor, MapPin, Search, LogOut, Trash2, Settings, Play, Pause } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
const isOnline = (lastSeen: string | null) => !!lastSeen && Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;

type DeviceStatus = "unpaired" | "paused" | "waiting_layout" | "online" | "offline";
const getDeviceStatus = (d: { is_paired: boolean; layout_id: string | null; last_seen_at: string | null; is_paused: number }, hasActiveSchedule: boolean): DeviceStatus => {
  if (!d.is_paired) return "unpaired";
  if (d.is_paused === 1) return "paused";
  if (!d.layout_id && !hasActiveSchedule) return "waiting_layout";
  return isOnline(d.last_seen_at) ? "online" : "offline";
};

interface Device {
  id: string;
  name: string;
  location: string | null;
  status: string;
  orientation: string;
  is_paired: boolean;
  pairing_code: string | null;
  layout_id: string | null;
  schedules_enabled: number;
  is_paused: number;
  last_seen_at: string | null;
  created_at: string;
}

interface Layout {
  id: string;
  name: string;
}

export default function AdminDevicesPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<Device[]>([]);
  const [layouts, setLayouts] = useState<Layout[]>([]);
  const [activeScheduleDeviceIds, setActiveScheduleDeviceIds] = useState<Set<string>>(new Set());

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "unpaired">("all");

  // Pair dialog
  const [addOpen, setAddOpen] = useState(false);
  const [pairCode, setPairCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [orientation, setOrientation] = useState("landscape");
  const [submitting, setSubmitting] = useState(false);

  // Device settings dialog (consolidated)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDevice, setSettingsDevice] = useState<Device | null>(null);
  const [settingsName, setSettingsName] = useState("");
  const [settingsLocation, setSettingsLocation] = useState("");
  const [settingsOrientation, setSettingsOrientation] = useState("");
  const [settingsSchedulesEnabled, setSettingsSchedulesEnabled] = useState(true);
  const [settingsPaused, setSettingsPaused] = useState(false);

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
    const { data } = await supabase.from("schedules").select("device_id").eq("company_id", cId);
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
    setSubmitting(true);
    fetchDevices(companyId);
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

  const openSettings = (device: Device) => {
    setSettingsDevice(device);
    setSettingsName(device.name);
    setSettingsLocation(device.location ?? "");
    setSettingsOrientation(device.orientation ?? "landscape");
    setSettingsSchedulesEnabled(device.schedules_enabled !== 0);
    setSettingsPaused(device.is_paused === 1);
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsDevice || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("devices").update({
      name: settingsName,
      location: settingsLocation || null,
      orientation: settingsOrientation,
      schedules_enabled: settingsSchedulesEnabled ? 1 : 0,
    }).eq("id", settingsDevice.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Device settings updated successfully!");
      setSettingsOpen(false);
      fetchDevices(companyId);
    }
  };

  const handleTogglePause = async () => {
    if (!settingsDevice || !companyId) return;
    const nextPausedState = !settingsPaused;
    setSubmitting(true);
    const { error } = await supabase.from("devices").update({
      is_paused: nextPausedState ? 1 : 0
    }).eq("id", settingsDevice.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(nextPausedState ? "TV playback paused successfully!" : "TV playback resumed successfully!");
      setSettingsPaused(nextPausedState);
      fetchDevices(companyId);
    }
  };

  const handleDelete = async () => {
    const target = settingsDevice;
    if (!target || !companyId) return;
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("logout-tv-device", {
      body: { device_id: target.id },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "Failed to remove device");
      return;
    }
    toast.success("Device deleted successfully. The TV will return to pairing.");
    setSettingsOpen(false);
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
            <p className="text-sm text-muted-foreground mt-1">Pair, configure, and monitor your Android TV screens.</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" /> Pair Device</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Pair Android TV Device</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <p className="text-xs text-muted-foreground leading-normal">
                  Open the SignageHub app on your Android TV and enter the 6-character code displayed on the screen.
                </p>
                <div className="space-y-2"><Label>Pairing Code</Label><Input value={pairCode} onChange={(e) => setPairCode(e.target.value)} placeholder="ABC123" required /></div>
                <div className="space-y-2"><Label>Device Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Reception Screen" required /></div>
                <div className="space-y-2"><Label>Location</Label><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Office Lobby" /></div>
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <div className="flex gap-2">
                    {["landscape", "portrait"].map((o) => (
                      <Button key={o} type="button" variant={orientation === o ? "default" : "outline"} size="sm" onClick={() => setOrientation(o)} className="capitalize flex-1">{o}</Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Pairing..." : "Pair TV Screen"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 p-4 border-b border-white/5">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search devices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-9" />
              </div>
              <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                <SelectTrigger className="w-[150px] h-9">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                  <SelectItem value="unpaired">Unpaired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">Loading screens...</div>
            ) : (() => {
              const filtered = devices.filter((d) => {
                const matchesSearch =
                  d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (d.location && d.location.toLowerCase().includes(searchQuery.toLowerCase()));

                const hasActiveSched = activeScheduleDeviceIds.has(d.id);
                const online = isOnline(d.last_seen_at);

                const matchesStatus =
                  statusFilter === "all" ||
                  (statusFilter === "online" && online) ||
                  (statusFilter === "offline" && d.is_paired && !online) ||
                  (statusFilter === "unpaired" && !d.is_paired);
                return matchesSearch && matchesStatus;
              });

              if (filtered.length === 0) {
                return <div className="text-center p-12 text-sm text-muted-foreground">No devices found.</div>;
              }

              return (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Screen</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Orientation</TableHead>
                      <TableHead>Default Layout (24/7)</TableHead>
                      <TableHead>Created At</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((d) => {
                      const hasActiveSched = activeScheduleDeviceIds.has(d.id);
                      const status = getDeviceStatus(d, hasActiveSched);
                      const schedulesEnabled = d.schedules_enabled !== 0;

                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-start gap-2.5">
                              <Monitor className="h-4 w-4 text-muted-foreground mt-0.5" />
                              <div>
                                <span className="text-sm font-semibold">{d.name}</span>
                                {d.location && (
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <MapPin className="h-3 w-3" /> {d.location}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {status === "unpaired" && <Badge variant="secondary">Unpaired</Badge>}
                            {status === "paused" && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                                Paused
                              </Badge>
                            )}
                            {status === "waiting_layout" && (
                              <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                                Assign Layout
                              </Badge>
                            )}
                            {status === "online" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/5 w-fit">
                                  Online
                                </Badge>
                                {d.last_seen_at && (
                                  <span className="text-[9px] text-muted-foreground">
                                    Seen {formatDistanceToNow(new Date(d.last_seen_at))} ago
                                  </span>
                                )}
                              </div>
                            )}
                            {status === "offline" && (
                              <div className="flex flex-col gap-0.5">
                                <Badge variant="destructive" className="w-fit">Offline</Badge>
                                {d.last_seen_at && (
                                  <span className="text-[9px] text-muted-foreground">
                                    Seen {formatDistanceToNow(new Date(d.last_seen_at))} ago
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-sm capitalize">{d.orientation}</TableCell>
                          <TableCell>
                            {(() => {
                              const needsLayout = !d.layout_id;
                              return (
                                <div className="flex flex-col gap-1">
                                  <Select
                                    value={d.layout_id || "none"}
                                    onValueChange={(val) => handleAssignLayout(d.id, val === "none" ? null : val)}
                                  >
                                    <SelectTrigger className="w-[180px] h-8 text-xs">
                                      <SelectValue placeholder="No default layout assigned" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No Fallback Layout</SelectItem>
                                      {layouts.map((t) => (
                                        <SelectItem key={t.id} value={t.id}>
                                          {t.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>

                                  {!schedulesEnabled && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold leading-tight max-w-[10rem]">
                                      Schedules Disabled (Playing Fallback)
                                    </p>
                                  )}
                                  {schedulesEnabled && needsLayout && !hasActiveSched && (
                                    <p className="text-[10px] text-amber-600 dark:text-amber-400 leading-tight max-w-[10rem]">
                                      Assign a default layout, or create an active schedule for this device.
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-muted"
                              onClick={() => openSettings(d)}
                              title="Device Settings"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              );
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Device Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Device Settings</DialogTitle>
          </DialogHeader>
          {settingsDevice && (
            <form onSubmit={handleSaveSettings} className="space-y-5 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Device Name</Label>
                <Input
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  className="bg-background border-border text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Location</Label>
                <Input
                  value={settingsLocation}
                  onChange={(e) => setSettingsLocation(e.target.value)}
                  className="bg-background border-border text-xs h-9"
                  placeholder="e.g. Reception Lobby"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground">Orientation</Label>
                <div className="flex gap-2">
                  {["landscape", "portrait"].map((o) => (
                    <Button
                      key={o}
                      type="button"
                      variant={settingsOrientation === o ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettingsOrientation(o)}
                      className="capitalize flex-1 text-xs h-8"
                    >
                      {o}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Pause / Schedule Mode Switch */}
              <div className="flex items-center justify-between border-t border-border/40 pt-4">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold text-foreground">Active Weekly Scheduling</Label>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    When paused, the device will display its default layout instead of the schedules timeline.
                  </p>
                </div>
                <Switch
                  checked={settingsSchedulesEnabled}
                  onCheckedChange={setSettingsSchedulesEnabled}
                />
              </div>

              {/* Action Buttons */}
              <div className="border-t border-border/40 pt-4 flex flex-col gap-2">
                <Button
                  type="submit"
                  className="w-full text-xs h-9 font-semibold bg-primary hover:bg-primary/95 text-primary-foreground"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Settings"}
                </Button>
                
                {settingsDevice.is_paired && (
                  <Button
                    type="button"
                    variant={settingsPaused ? "default" : "outline"}
                    className={cn(
                      "w-full text-xs h-9 font-semibold",
                      !settingsPaused && "text-amber-600 hover:text-amber-700 border-amber-600/20 hover:bg-amber-500/10"
                    )}
                    onClick={handleTogglePause}
                    disabled={submitting}
                  >
                    {settingsPaused ? (
                      <>
                        <Play className="size-3.5 mr-1.5" /> Resume Playback
                      </>
                    ) : (
                      <>
                        <Pause className="size-3.5 mr-1.5" /> Pause Playback
                      </>
                    )}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  className="w-full text-xs h-9 font-semibold"
                  onClick={() => {
                    if (confirm(`WARNING: Deleting device ${settingsDevice.name} will unpair it and clear all its schedules. This cannot be undone. Do you want to proceed?`)) {
                      handleDelete();
                    }
                  }}
                  disabled={submitting}
                >
                  <Trash2 className="size-3.5 mr-1.5" /> Delete Screen / Logout
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
