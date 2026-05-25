import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, CalendarClock, Trash2, Monitor, List, Calendar as CalendarIcon } from "lucide-react";
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
  layout_id: string | null;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  is_active: boolean;
  created_at: string;
  device_name?: string;
  layout_name?: string;
}

interface Device { id: string; name: string; }
interface LayoutOption { id: string; name: string; }

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Distinct color tints (using HSL design tokens)
const DEVICE_COLORS = [
  "hsl(var(--primary))",
  "hsl(200 80% 55%)",
  "hsl(280 65% 60%)",
  "hsl(35 85% 55%)",
  "hsl(150 60% 45%)",
  "hsl(340 75% 55%)",
];

const timeToMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  const [addOpen, setAddOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [selectedLayout, setSelectedLayout] = useState("");
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [submitting, setSubmitting] = useState(false);

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
    const [schedulesRes, devicesRes, layoutsRes] = await Promise.all([
      supabase.from("schedules").select("*").eq("company_id", cId).order("created_at", { ascending: false }),
      supabase.from("devices").select("id, name").eq("company_id", cId),
      supabase.from("layouts").select("id, name").eq("company_id", cId).order("name"),
    ]);
    const devMap = new Map((devicesRes.data ?? []).map((d: any) => [d.id, d.name]));
    const layoutMap = new Map((layoutsRes.data ?? []).map((l: any) => [l.id, l.name]));
    setDevices(devicesRes.data ?? []);
    setLayouts(layoutsRes.data ?? []);
    setSchedules((schedulesRes.data ?? []).map((s: any) => ({
      ...s,
      device_name: devMap.get(s.device_id) ?? "Unknown",
      layout_name: s.layout_id ? layoutMap.get(s.layout_id) ?? "Unknown layout" : "Device default layout",
    })));
    setLoading(false);
  };

  const deviceColorMap = useMemo(() => {
    const m = new Map<string, string>();
    devices.forEach((d, i) => m.set(d.id, DEVICE_COLORS[i % DEVICE_COLORS.length]));
    return m;
  }, [devices]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setSubmitting(true);
    const { error } = await supabase.from("schedules").insert({
      company_id: companyId,
      device_id: selectedDevice,
      layout_id: selectedLayout || null,
      start_time: startTime,
      end_time: endTime,
      days_of_week: days,
    });
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Schedule created!");
      setAddOpen(false);
      setSelectedDevice(""); setSelectedLayout("");
      setStartTime("00:00"); setEndTime("23:59");
      setDays([0, 1, 2, 3, 4, 5, 6]);
      fetchAll(companyId);
    }
  };

  const toggleActive = async (schedule: Schedule) => {
    const { error } = await supabase.from("schedules").update({ is_active: !schedule.is_active }).eq("id", schedule.id);
    if (error) toast.error(error.message);
    else setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, is_active: !s.is_active } : s));
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

  const HOUR_HEIGHT = 32; // px per hour
  const TOTAL_MINUTES = 24 * 60;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">Assign content to devices on a schedule</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-card">
              <Button variant={view === "calendar" ? "default" : "ghost"} size="sm" onClick={() => setView("calendar")} className="rounded-r-none">
                <CalendarIcon className="h-4 w-4 mr-1.5" /> Calendar
              </Button>
              <Button variant={view === "list" ? "default" : "ghost"} size="sm" onClick={() => setView("list")} className="rounded-l-none">
                <List className="h-4 w-4 mr-1.5" /> List
              </Button>
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
                    <Label>Layout</Label>
                    <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={selectedLayout} onChange={(e) => setSelectedLayout(e.target.value)}>
                      <option value="">Use device default layout</option>
                      {layouts.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
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
                  <Button type="submit" className="w-full" disabled={submitting || !selectedDevice}>
                    {submitting ? "Creating..." : "Create Schedule"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <Card><CardContent className="py-12 flex justify-center"><div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" /></CardContent></Card>
        ) : schedules.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <CalendarClock className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No schedules yet. Create your first schedule.</p>
            </CardContent>
          </Card>
        ) : view === "calendar" ? (
          <Card>
            <CardContent className="p-4">
              {/* Device legend */}
              <div className="flex flex-wrap gap-3 mb-4 pb-3 border-b">
                {devices.filter((d) => schedules.some((s) => s.device_id === d.id)).map((d) => (
                  <div key={d.id} className="flex items-center gap-2 text-xs">
                    <span className="h-3 w-3 rounded" style={{ backgroundColor: deviceColorMap.get(d.id) }} />
                    <span className="font-medium">{d.name}</span>
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="overflow-x-auto">
                <div className="min-w-[800px] flex">
                  {/* Time gutter */}
                  <div className="w-12 shrink-0 pt-8">
                    {Array.from({ length: 25 }, (_, h) => (
                      <div key={h} className="text-[10px] text-muted-foreground text-right pr-2" style={{ height: HOUR_HEIGHT }}>
                        {h.toString().padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  <div className="flex-1 grid grid-cols-7 gap-1">
                    {DAY_LABELS.map((dayLabel, dayIndex) => {
                      const daySchedules = schedules.filter((s) => s.is_active && s.days_of_week.includes(dayIndex));
                      return (
                        <div key={dayIndex} className="flex flex-col">
                          <div className="text-xs font-semibold text-center pb-2 h-8 flex items-center justify-center">
                            {dayLabel}
                          </div>
                          <div className="relative bg-muted/30 rounded border" style={{ height: 24 * HOUR_HEIGHT }}>
                            {/* Hour grid lines */}
                            {Array.from({ length: 24 }, (_, h) => (
                              <div key={h} className="absolute w-full border-t border-border/40" style={{ top: h * HOUR_HEIGHT }} />
                            ))}
                            {/* Schedule blocks */}
                            {daySchedules.map((s) => {
                              const startMin = timeToMinutes(s.start_time);
                              const endMin = timeToMinutes(s.end_time);
                              const top = (startMin / TOTAL_MINUTES) * (24 * HOUR_HEIGHT);
                              const height = Math.max(20, ((endMin - startMin) / TOTAL_MINUTES) * (24 * HOUR_HEIGHT));
                              const color = deviceColorMap.get(s.device_id) ?? "hsl(var(--primary))";
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => { setDeleteSchedule(s); setDeleteOpen(true); }}
                                  className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 text-[10px] cursor-pointer hover:opacity-80 transition-opacity overflow-hidden"
                                  style={{ top, height, backgroundColor: color, color: "white" }}
                                  title={`${s.device_name} - ${s.layout_name} - ${s.start_time}-${s.end_time}`}
                                >
                                  <div className="font-semibold truncate">{s.device_name}</div>
                                  <div className="truncate opacity-90">{s.layout_name}</div>
                                  <div className="opacity-90">{s.start_time}-{s.end_time}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">Click a block to delete · Inactive schedules are hidden from the calendar</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Layout</TableHead>
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
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deviceColorMap.get(s.device_id) }} />
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{s.device_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.layout_name}</TableCell>
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
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete Schedule</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete schedule for <strong>{deleteSchedule?.device_name}</strong> ({deleteSchedule?.start_time} – {deleteSchedule?.end_time})?
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={submitting}>{submitting ? "Deleting..." : "Delete"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
