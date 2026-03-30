import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, CalendarClock, Trash2, Monitor, ListVideo } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

interface Schedule {
  id: string;
  device_id: string;
  playlist_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  is_active: boolean;
  created_at: string;
  device_name?: string;
  playlist_name?: string;
}

interface Device { id: string; name: string; }
interface Playlist { id: string; name: string; }

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Add
  const [addOpen, setAddOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedPlaylist, setSelectedPlaylist] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [submitting, setSubmitting] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchAll(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchAll = async (cId: string) => {
    const [schedulesRes, devicesRes, playlistsRes] = await Promise.all([
      supabase.from("schedules").select("*").eq("company_id", cId).order("created_at", { ascending: false }),
      supabase.from("devices").select("id, name").eq("company_id", cId),
      supabase.from("playlists").select("id, name").eq("company_id", cId),
    ]);

    const devMap = new Map((devicesRes.data ?? []).map((d: any) => [d.id, d.name]));
    const plMap = new Map((playlistsRes.data ?? []).map((p: any) => [p.id, p.name]));

    setDevices(devicesRes.data ?? []);
    setPlaylists(playlistsRes.data ?? []);
    setSchedules((schedulesRes.data ?? []).map((s: any) => ({
      ...s,
      device_name: devMap.get(s.device_id) ?? "Unknown",
      playlist_name: plMap.get(s.playlist_id) ?? "Unknown",
    })));
    setLoading(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("schedules").insert({
      company_id: companyId,
      device_id: selectedDevice,
      playlist_id: selectedPlaylist,
      start_time: startTime,
      end_time: endTime,
      days_of_week: days,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule created!");
      setAddOpen(false);
      setSelectedDevice(""); setSelectedPlaylist("");
      setStartTime("00:00"); setEndTime("23:59");
      setDays([0, 1, 2, 3, 4, 5, 6]);
      fetchAll(companyId);
    }
  };

  const toggleActive = async (schedule: Schedule) => {
    const { error } = await supabase.from("schedules").update({ is_active: !schedule.is_active }).eq("id", schedule.id);
    if (error) toast.error(error.message);
    else {
      setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, is_active: !s.is_active } : s));
    }
  };

  const handleDelete = async () => {
    if (!deleteSchedule || !companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("schedules").delete().eq("id", deleteSchedule.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule deleted!");
      setDeleteOpen(false); setDeleteSchedule(null);
      fetchAll(companyId);
    }
  };

  const toggleDay = (day: number) => {
    setDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">Assign playlists to devices on a schedule</p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Create Schedule</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Schedule</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>Device</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedDevice} onChange={(e) => setSelectedDevice(e.target.value)} required>
                    <option value="">Select a device...</option>
                    {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Playlist</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedPlaylist} onChange={(e) => setSelectedPlaylist(e.target.value)} required>
                    <option value="">Select a playlist...</option>
                    {playlists.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Start Time</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
                  <div className="space-y-2"><Label>End Time</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Days</Label>
                  <div className="flex gap-1">
                    {DAY_LABELS.map((label, i) => (
                      <Button key={i} type="button" variant={days.includes(i) ? "default" : "outline"} size="sm" className="flex-1 px-0 text-xs" onClick={() => toggleDay(i)}>{label}</Button>
                    ))}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !selectedDevice || !selectedPlaylist}>
                  {submitting ? "Creating..." : "Create Schedule"}
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
            ) : schedules.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No schedules yet. Create your first schedule.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Playlist</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{s.device_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ListVideo className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{s.playlist_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.start_time} – {s.end_time}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {DAY_LABELS.map((label, i) => (
                            <span key={i} className={`text-[10px] px-1 py-0.5 rounded ${s.days_of_week.includes(i) ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground/40"}`}>{label[0]}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setDeleteSchedule(s); setDeleteOpen(true); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Schedule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this schedule?</p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
