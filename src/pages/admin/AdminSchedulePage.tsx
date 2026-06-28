import * as React from "react";
import { useEffect, useState, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Plus,
  CalendarClock,
  Trash2,
  Monitor,
  List,
  Calendar as CalendarIcon,
  Search,
  Move,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

interface Device {
  id: string;
  name: string;
  location: string | null;
  status: "online" | "offline" | "pending";
  layout_id: string | null;
  schedules_enabled?: number;
}

interface LayoutOption {
  id: string;
  name: string;
}

interface DragState {
  action: "idle" | "move" | "resize-top" | "resize-bottom" | "drag-new";
  blockId: string | null;
  originalDayIndex: number;
  originalStartMins: number;
  originalEndMins: number;
  startY: number;
  startX: number;
  currentDayIndex: number;
  currentStartMins: number;
  currentEndMins: number;
  draggedLayoutId?: string;
}

const WEEK_DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLUMN_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const HOUR_HEIGHT = 48; // px per hour (fits beautifully)
const PX_PER_MIN = HOUR_HEIGHT / 60;
const TOTAL_MINUTES = 24 * 60;

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

const toHHMM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatMinsAMPM = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
};

const initialDragState: DragState = {
  action: "idle",
  blockId: null,
  originalDayIndex: 0,
  originalStartMins: 0,
  originalEndMins: 0,
  startY: 0,
  startX: 0,
  currentDayIndex: 0,
  currentStartMins: 0,
};

const GlassCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("glass-card rounded-2xl", className)} {...props}>
    {children}
  </div>
);

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [view, setView] = useState<"calendar" | "list">("calendar");

  // Selection & control states
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [layoutSearch, setLayoutSearch] = useState("");

  // Edit / Details Popup
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [editLayout, setEditLayout] = useState("");
  const [editDays, setEditDays] = useState<number[]>([]);
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("17:00");
  const [editActive, setEditActive] = useState(true);

  // Drag-and-drop state
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const weekGridRef = useRef<HTMLDivElement | null>(null);
  const [colWidth, setColWidth] = useState(120);

  // Time Indicator state
  const [nowTime, setNowTime] = useState(new Date());

  // Overwrite Dialogs states
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);
  const [overwritePayload, setOverwritePayload] = useState<{
    id?: string;
    device_id: string;
    layout_id: string | null;
    start_time: string;
    end_time: string;
    days_of_week: number[];
    is_active: boolean;
  } | null>(null);

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const schedulesEnabled = selectedDevice ? (selectedDevice.schedules_enabled !== 0) : true;

  // Auto-refresh Time Indicator
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Measure Column width on mount / resize
  useEffect(() => {
    const handleResize = () => {
      if (weekGridRef.current) {
        const gridCols = weekGridRef.current.querySelector(".grid-cols-7");
        if (gridCols) {
          setColWidth(gridCols.clientWidth / 7);
        }
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [view, loading]);

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

  // Set default selected device on load
  useEffect(() => {
    if (selectedDeviceId === null && devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  const fetchAll = async (cId: string) => {
    const [schedulesRes, devicesRes, layoutsRes] = await Promise.all([
      supabase.from("schedules").select("*").eq("company_id", cId),
      supabase.from("devices").select("*").eq("company_id", cId),
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

  // Overlap Verification helper
  const checkOverlaps = (
    deviceId: string,
    startTime: string,
    endTime: string,
    daysOfWeek: number[],
    excludeScheduleId?: string
  ) => {
    const startMins = timeToMinutes(startTime);
    const endMins = timeToMinutes(endTime);

    return schedules.filter((s) => {
      if (!s.is_active) return false;
      if (s.device_id !== deviceId) return false;
      if (excludeScheduleId && s.id === excludeScheduleId) return false;

      const hasDayOverlap = s.days_of_week.some((d) => daysOfWeek.includes(d));
      if (!hasDayOverlap) return false;

      const sStart = timeToMinutes(s.start_time);
      const sEnd = timeToMinutes(s.end_time);

      return startMins < sEnd && endMins > sStart;
    });
  };

  // Perform overwriting operation by deleting conflicting schedules
  const executeOverwrite = async (payload: NonNullable<typeof overwritePayload>) => {
    if (!companyId) return;
    setOverwriteConfirmOpen(false);

    const conflicts = checkOverlaps(
      payload.device_id,
      payload.start_time,
      payload.end_time,
      payload.days_of_week,
      payload.id
    );

    try {
      // Purge overlaps
      for (const conf of conflicts) {
        await supabase.from("schedules").delete().eq("id", conf.id);
      }

      if (payload.id) {
        // Update existing schedule
        const { error } = await supabase.from("schedules").update({
          layout_id: payload.layout_id,
          start_time: payload.start_time,
          end_time: payload.end_time,
          days_of_week: payload.days_of_week,
          is_active: payload.is_active,
        }).eq("id", payload.id);

        if (error) throw error;
        toast.success("Schedule updated successfully!");
      } else {
        // Insert new schedule
        const { error } = await supabase.from("schedules").insert({
          company_id: companyId,
          device_id: payload.device_id,
          layout_id: payload.layout_id,
          start_time: payload.start_time,
          end_time: payload.end_time,
          days_of_week: payload.days_of_week,
          is_active: payload.is_active,
        });

        if (error) throw error;
        toast.success("New schedule created!");
      }

      setEditPopupOpen(false);
      fetchAll(companyId);
    } catch (e: any) {
      toast.error(e.message || "Failed to save schedule");
    }
  };

  // Save changes handler
  const handleSaveSchedule = async () => {
    if (!selectedDeviceId || !companyId) return;

    const payload = {
      id: selectedSchedule?.id,
      device_id: selectedDeviceId,
      layout_id: editLayout || null,
      start_time: editStartTime,
      end_time: editEndTime,
      days_of_week: editDays,
      is_active: editActive,
    };

    const conflicts = checkOverlaps(
      payload.device_id,
      payload.start_time,
      payload.end_time,
      payload.days_of_week,
      payload.id
    );

    if (conflicts.length > 0) {
      setOverwritePayload(payload);
      setOverwriteConfirmOpen(true);
      return;
    }

    try {
      if (payload.id) {
        const { error } = await supabase.from("schedules").update({
          layout_id: payload.layout_id,
          start_time: payload.start_time,
          end_time: payload.end_time,
          days_of_week: payload.days_of_week,
          is_active: payload.is_active,
        }).eq("id", payload.id);

        if (error) throw error;
        toast.success("Schedule saved successfully!");
      } else {
        const { error } = await supabase.from("schedules").insert({
          company_id: companyId,
          device_id: payload.device_id,
          layout_id: payload.layout_id,
          start_time: payload.start_time,
          end_time: payload.end_time,
          days_of_week: payload.days_of_week,
          is_active: payload.is_active,
        });

        if (error) throw error;
        toast.success("Schedule created successfully!");
      }

      setEditPopupOpen(false);
      fetchAll(companyId);
    } catch (e: any) {
      toast.error(e.message || "Failed to save schedule");
    }
  };

  // Delete handler
  const handleDeleteSchedule = async (id: string) => {
    if (!companyId) return;
    try {
      const { error } = await supabase.from("schedules").delete().eq("id", id);
      if (error) throw error;

      toast.success("Schedule deleted successfully!");
      setEditPopupOpen(false);
      fetchAll(companyId);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete schedule");
    }
  };

  // Toggle single schedule active status
  const toggleActive = async (schedule: Schedule) => {
    const { error } = await supabase.from("schedules").update({ is_active: !schedule.is_active }).eq("id", schedule.id);
    if (error) toast.error(error.message);
    else setSchedules((prev) => prev.map((s) => s.id === schedule.id ? { ...s, is_active: !s.is_active } : s));
  };

  // Toggle Schedules mode on device
  const updateDeviceSchedulesMode = async (enabled: boolean) => {
    if (!selectedDeviceId || !companyId) return;
    try {
      const { error } = await supabase.from("devices").update({ schedules_enabled: enabled ? 1 : 0 }).eq("id", selectedDeviceId);
      if (error) throw error;
      toast.success("Device schedule mode updated");
      fetchAll(companyId);
    } catch (e: any) {
      toast.error(e.message || "Failed to update schedule mode");
    }
  };

  // Update default layout fallback
  const updateDeviceDefaultLayout = async (layoutId: string | null) => {
    if (!selectedDeviceId || !companyId) return;
    try {
      const { error } = await supabase.from("devices").update({ layout_id: layoutId }).eq("id", selectedDeviceId);
      if (error) throw error;
      toast.success("Device default layout updated");
      fetchAll(companyId);
    } catch (e: any) {
      toast.error(e.message || "Failed to update default layout");
    }
  };

  // Global mouse move & mouse up gesture handlers
  React.useEffect(() => {
    if (dragState.action === "idle") return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragState.startY;
      const deltaMins = Math.round((deltaY / PX_PER_MIN) / 15) * 15;

      if (dragState.action === "move") {
        const deltaX = e.clientX - dragState.startX;
        const dayDelta = Math.round(deltaX / colWidth);

        let newStart = dragState.originalStartMins + deltaMins;
        let newEnd = dragState.originalEndMins + deltaMins;

        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > 24 * 60) {
          newStart -= (newEnd - 24 * 60);
          newEnd = 24 * 60;
        }

        // Adjust day columns
        const originalIndex = WEEK_DAYS.indexOf(dragState.originalDayIndex);
        const nextIndex = Math.max(0, Math.min(6, originalIndex + dayDelta));
        const nextDay = WEEK_DAYS[nextIndex];

        setDragState((prev) => ({
          ...prev,
          currentDayIndex: nextDay,
          currentStartMins: newStart,
          currentEndMins: newEnd,
        }));
      } else if (dragState.action === "resize-top") {
        let newStart = dragState.originalStartMins + deltaMins;
        newStart = Math.min(dragState.originalEndMins - 15, Math.max(0, newStart));
        setDragState((prev) => ({
          ...prev,
          currentStartMins: newStart,
        }));
      } else if (dragState.action === "resize-bottom") {
        let newEnd = dragState.originalEndMins + deltaMins;
        newEnd = Math.max(dragState.originalStartMins + 15, Math.min(24 * 60, newEnd));
        setDragState((prev) => ({
          ...prev,
          currentEndMins: newEnd,
        }));
      }
    };

    const handleMouseUp = async () => {
      const { blockId, currentDayIndex, currentStartMins, currentEndMins, originalDayIndex, originalStartMins, originalEndMins } = dragState;
      setDragState(initialDragState);

      if (
        blockId !== null &&
        (currentDayIndex !== originalDayIndex ||
        currentStartMins !== originalStartMins ||
        currentEndMins !== originalEndMins)
      ) {
        const parent = schedules.find((s) => s.id === blockId);
        if (!parent || !companyId) return;

        const startTimeStr = toHHMM(currentStartMins);
        const endTimeStr = toHHMM(currentEndMins);

        // Adjust day index list
        let nextDays = [...parent.days_of_week];
        if (currentDayIndex !== originalDayIndex) {
          nextDays = nextDays.map((d) => d === originalDayIndex ? currentDayIndex : d);
        }

        const payload = {
          id: blockId,
          device_id: parent.device_id,
          layout_id: parent.layout_id,
          start_time: startTimeStr,
          end_time: endTimeStr,
          days_of_week: nextDays,
          is_active: parent.is_active,
        };

        const conflicts = checkOverlaps(
          payload.device_id,
          payload.start_time,
          payload.end_time,
          payload.days_of_week,
          payload.id
        );

        if (conflicts.length > 0) {
          setOverwritePayload(payload);
          setOverwriteConfirmOpen(true);
          return;
        }

        try {
          const { error } = await supabase.from("schedules").update({
            start_time: payload.start_time,
            end_time: payload.end_time,
            days_of_week: payload.days_of_week,
          }).eq("id", blockId);

          if (error) throw error;
          toast.success("Schedule adjusted!");
          fetchAll(companyId);
        } catch (err: any) {
          toast.error(err.message || "Failed to update layout block");
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, colWidth]);

  // Click on active block to open edit popup
  const handleBlockClick = (schedule: Schedule) => {
    setSelectedSchedule(schedule);
    setEditLayout(schedule.layout_id || "");
    setEditDays(schedule.days_of_week);
    setEditStartTime(schedule.start_time.slice(0, 5));
    setEditEndTime(schedule.end_time.slice(0, 5));
    setEditActive(schedule.is_active);
    setEditPopupOpen(true);
  };

  // Mouse gestures trigger helpers
  const handleBlockMouseDown = (
    e: React.MouseEvent,
    s: Schedule,
    dayIndex: number,
    action: DragState["action"]
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!schedulesEnabled) return;

    const startMins = timeToMinutes(s.start_time);
    const endMins = timeToMinutes(s.end_time);

    setDragState({
      action,
      blockId: s.id,
      originalDayIndex: dayIndex,
      originalStartMins: startMins,
      originalEndMins: endMins,
      startY: e.clientY,
      startX: e.clientX,
      currentDayIndex: dayIndex,
      currentStartMins: startMins,
      currentEndMins: endMins,
    });
  };

  // Drag layouts over the calendar container handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDropNew = async (e: React.DragEvent, dayIndex: number) => {
    e.preventDefault();
    if (!schedulesEnabled || !selectedDeviceId || !companyId) return;

    const layoutId = e.dataTransfer.getData("text/plain");
    if (!layoutId) return;

    // Calculate start time relative to target board position
    const rect = e.currentTarget.getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    const dropMins = Math.round((dropY / PX_PER_MIN) / 15) * 15;

    const startMins = Math.min(23 * 60, Math.max(0, dropMins));
    const endMins = Math.min(24 * 60, startMins + 60);

    const startTimeStr = toHHMM(startMins);
    const endTimeStr = toHHMM(endMins);

    const payload = {
      device_id: selectedDeviceId,
      layout_id: layoutId,
      start_time: startTimeStr,
      end_time: endTimeStr,
      days_of_week: [dayIndex],
      is_active: true,
    };

    const conflicts = checkOverlaps(
      payload.device_id,
      payload.start_time,
      payload.end_time,
      payload.days_of_week
    );

    if (conflicts.length > 0) {
      setOverwritePayload(payload);
      setOverwriteConfirmOpen(true);
      return;
    }

    try {
      const { error } = await supabase.from("schedules").insert({
        company_id: companyId,
        device_id: payload.device_id,
        layout_id: payload.layout_id,
        start_time: payload.start_time,
        end_time: payload.end_time,
        days_of_week: payload.days_of_week,
      });

      if (error) throw error;
      toast.success("Schedule block added!");
      fetchAll(companyId);
    } catch (err: any) {
      toast.error(err.message || "Failed to drop layout");
    }
  };

  // Toggle selected edit day index
  const toggleEditDay = (day: number) => {
    setEditDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // Sidebar Filtered lists
  const filteredDevices = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(deviceSearch.toLowerCase()))
  );

  const filteredLayouts = layouts.filter((l) =>
    l.name.toLowerCase().includes(layoutSearch.toLowerCase())
  );

  const activeDeviceSchedules = schedules.filter(
    (s) => s.device_id === selectedDeviceId
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
            <p className="text-sm text-muted-foreground mt-1">Assign layout playlists to devices on a schedule</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border bg-card">
              <Button
                variant={view === "calendar" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("calendar")}
                className="rounded-r-none h-8 text-xs font-semibold"
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5" /> Calendar View
              </Button>
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setView("list")}
                className="rounded-l-none h-8 text-xs font-semibold"
              >
                <List className="h-3.5 w-3.5 mr-1.5" /> List View
              </Button>
            </div>
            <Button
              onClick={() => {
                setSelectedSchedule(null);
                setEditLayout("");
                setEditDays([1, 2, 3, 4, 5]);
                setEditStartTime("09:00");
                setEditEndTime("17:00");
                setEditActive(true);
                setEditPopupOpen(true);
              }}
              disabled={!selectedDeviceId}
              className="h-8 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Create Schedule
            </Button>
          </div>
        </div>

        {loading ? (
          <Card>
            <CardContent className="py-12 flex justify-center">
              <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
            </CardContent>
          </Card>
        ) : view === "list" ? (
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableHead className="text-xs text-muted-foreground">Device</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Layout</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Time</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Days</TableHead>
                    <TableHead className="text-xs text-muted-foreground">Status</TableHead>
                    <TableHead className="w-16 text-xs text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schedules.map((s) => (
                    <TableRow key={s.id} className="hover:bg-white/[0.02] border-white/5">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: deviceColorMap.get(s.device_id) }} />
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm font-semibold text-foreground">{s.device_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{s.layout_name}</TableCell>
                      <TableCell className="text-sm font-medium">{s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          {COLUMN_HEADERS.map((label, index) => {
                            const dIndex = WEEK_DAYS[index];
                            const active = s.days_of_week.includes(dIndex);
                            return (
                              <span
                                key={index}
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-semibold",
                                  active
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground/30 border border-white/5"
                                )}
                              >
                                {label[0]}
                              </span>
                            );
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => toggleActive(s)}
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-semibold border",
                            s.is_active
                              ? "bg-emerald-400/10 text-emerald-400 border-emerald-400/15"
                              : "bg-rose-400/10 text-rose-400 border-rose-400/15"
                          )}
                        >
                          {s.is_active ? "Active" : "Inactive"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteSchedule(s.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          /* ======================================================== */
          /* GRID CALENDAR & SIDEBAR LAYOUT                           */
          /* ======================================================== */
          <div className="grid grid-cols-[240px_1fr_240px] gap-6">
            {/* LEFT SIDEBAR: Device Selector & Mode Control */}
            <div className="space-y-6">
              <GlassCard className="p-4 flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Devices
                </h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search devices..."
                    value={deviceSearch}
                    onChange={(e) => setDeviceSearch(e.target.value)}
                    className="pl-8 bg-white/5 border-white/10 text-xs h-8"
                  />
                </div>
                <div className="space-y-1 max-h-[195px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredDevices.map((d) => {
                    const isSelected = d.id === selectedDeviceId;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDeviceId(d.id)}
                        className={cn(
                          "w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all duration-200",
                          isSelected
                            ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                            : "bg-transparent border-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className="truncate">
                          <div>{d.name}</div>
                          {d.location && <div className="text-[10px] opacity-75">{d.location}</div>}
                        </div>
                        <span
                          className={cn(
                            "size-1.5 rounded-full shrink-0 ml-1.5",
                            d.status === "online"
                              ? "bg-emerald-400 animate-pulse"
                              : d.status === "pending"
                                ? "bg-amber-400"
                                : "bg-muted-foreground/30"
                          )}
                        />
                      </button>
                    );
                  })}
                  {filteredDevices.length === 0 && (
                    <div className="text-xs text-muted-foreground italic text-center py-2">
                      No matching devices
                    </div>
                  )}
                </div>
              </GlassCard>

              {/* Schedule Mode control panel */}
              {selectedDevice && (
                <GlassCard className="p-4 flex flex-col gap-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                    Schedule Mode
                  </h2>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">Disable Schedule</span>
                      <span className="text-[10px] text-muted-foreground">Use default fallback layout</span>
                    </div>
                    <button
                      onClick={() => {
                        const nextVal = selectedDevice.schedules_enabled === 0;
                        updateDeviceSchedulesMode(nextVal);
                      }}
                      className={cn(
                        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary/40 focus:ring-offset-1 focus:ring-offset-background",
                        selectedDevice.schedules_enabled === 0 ? "bg-amber-600/70 border-amber-500/50" : "bg-white/10 border-white/5"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          selectedDevice.schedules_enabled === 0 ? "translate-x-4" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {selectedDevice.schedules_enabled === 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-150">
                      <Label className="text-[10px] text-muted-foreground font-semibold">Default Fallback Layout</Label>
                      <select
                        value={selectedDevice.layout_id || ""}
                        onChange={(e) => updateDeviceDefaultLayout(e.target.value || null)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl h-8 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                      >
                        <option value="" disabled className="bg-[#0d0f12] text-muted-foreground">Select a default layout...</option>
                        {layouts.map((l) => (
                          <option key={l.id} value={l.id} className="bg-[#0d0f12] text-foreground">
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </GlassCard>
              )}
            </div>

            {/* MAIN CALENDAR BOARD */}
            <div className="flex flex-col gap-4" ref={weekGridRef}>
              <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl px-4 py-2.5 shadow-sm">
                <span className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                  <CalendarIcon className="size-4 text-primary" />
                  Weekly Overview Timeline — {selectedDevice ? selectedDevice.name : "Select Device"}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="size-3.5" /> Drag layouts onto the calendar columns
                </span>
              </div>

              <GlassCard className="p-0 overflow-hidden flex flex-col select-none">
                {/* Day column headers row */}
                <div className="grid grid-cols-[60px_1fr] border-b border-white/5 bg-white/[0.02]">
                  <div className="h-10 border-r border-white/5" />
                  <div className="grid grid-cols-7 h-10 divide-x divide-white/5">
                    {COLUMN_HEADERS.map((label, idx) => {
                      const dayVal = WEEK_DAYS[idx];
                      const isCurrent = nowTime.getDay() === dayVal;
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "flex flex-col items-center justify-center text-center py-1 transition-colors relative",
                            !schedulesEnabled
                              ? "opacity-40 cursor-not-allowed pointer-events-none"
                              : "cursor-pointer hover:bg-white/5",
                            isCurrent && "bg-primary/5"
                          )}
                        >
                          <span className={cn("text-[10px] font-bold text-muted-foreground", isCurrent && "text-primary")}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Main timeline hours board container */}
                <div className="grid grid-cols-[60px_1fr] min-h-[1152px] relative overflow-y-auto max-h-[700px] custom-scrollbar">
                  {/* Hours Gutter column */}
                  <div className="bg-white/[0.01] border-r border-white/5 select-none text-[10px] text-muted-foreground pr-2 pt-1.5 text-right font-medium">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-white/5 select-none pr-1">
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Day grid columns containing blocks */}
                  <div className="grid grid-cols-7 relative divide-x divide-white/5 min-h-[1152px] bg-white/[0.005]">
                    {!schedulesEnabled && (
                      <div
                        onClick={() => {
                          toast.info(`Device is running fallback default layout: ${selectedDevice?.layout_id ? layouts.find((l) => l.id === selectedDevice.layout_id)?.name || "Layout" : "None"}. Turn on "Enable Scheduling" in the sidebar to configure the timeline.`);
                        }}
                        className="absolute inset-0 bg-black/75 backdrop-blur-[1px] z-[60] flex flex-col items-center justify-center text-center p-4 select-none cursor-pointer"
                      >
                        <SlidersHorizontal className="size-8 text-amber-500/80 mb-2 animate-pulse" />
                        <h4 className="text-sm font-semibold text-foreground">Schedules Disabled</h4>
                        <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                          This device is configured to display its default fallback layout 24/7. Turn on "Enable Scheduling" in the sidebar to configure the timeline.
                        </p>
                      </div>
                    )}

                    {/* Horizontal row line guide overlays */}
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-white/[0.04] pointer-events-none"
                        style={{ top: (h + 1) * HOUR_HEIGHT - 1, height: 1 }}
                      />
                    ))}

                    {/* Weekly day columns */}
                    {WEEK_DAYS.map((dayIndex, colIdx) => {
                      const isCurrent = nowTime.getDay() === dayIndex;

                      // Filter schedules active on this day index
                      const daySchedules = activeDeviceSchedules.filter((s) =>
                        s.days_of_week.includes(dayIndex)
                      );

                      // Calculate live time indicator line
                      const timeMins = nowTime.getHours() * 60 + nowTime.getMinutes();
                      const indicatorTop = timeMins * PX_PER_MIN;

                      return (
                        <div
                          key={dayIndex}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropNew(e, dayIndex)}
                          className={cn(
                            "relative h-full flex flex-col transition-colors min-h-[1152px]",
                            isCurrent && "bg-primary/[0.01]"
                          )}
                        >
                          {/* Live Time indicator line overlay */}
                          {isCurrent && schedulesEnabled && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none flex items-center" style={{ top: indicatorTop }}>
                              <span className="size-1.5 rounded-full bg-rose-500 shrink-0 -ml-1" />
                              <span className="h-[1.5px] bg-rose-500 w-full" />
                            </div>
                          )}

                          {/* Render schedule blocks inside column */}
                          {daySchedules.map((s) => {
                            const isDraggingThis = dragState.blockId === s.id && dragState.currentDayIndex === dayIndex;
                            const startMins = isDraggingThis ? dragState.currentStartMins : timeToMinutes(s.start_time);
                            const endMins = isDraggingThis ? dragState.currentEndMins : timeToMinutes(s.end_time);

                            const top = startMins * PX_PER_MIN;
                            const height = (endMins - startMins) * PX_PER_MIN;
                            const color = deviceColorMap.get(s.device_id) || "hsl(var(--primary))";

                            const shouldDisplay = !isDraggingThis || (dragState.action !== "move" || dragState.currentDayIndex === dayIndex);
                            if (!shouldDisplay) return null;

                            return (
                              <div
                                key={`${s.id}-${dayIndex}`}
                                draggable="false"
                                onClick={() => handleBlockClick(s)}
                                className={cn(
                                  "absolute left-1 right-1 rounded-xl p-2 text-[10px] overflow-hidden group shadow-md transition-shadow hover:shadow-lg border-l-4 cursor-pointer",
                                  isDraggingThis && "opacity-90 shadow-2xl scale-[0.98] ring-1 ring-primary/40"
                                )}
                                style={{
                                  top,
                                  height,
                                  background: `color-mix(in oklch, ${color} 15%, #0d0f12)`,
                                  borderColor: color,
                                }}
                              >
                                {/* Resize Handle Top */}
                                <div
                                  className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                  onMouseDown={(e) => handleBlockMouseDown(e, s, dayIndex, "resize-top")}
                                />

                                {/* Content area */}
                                <div className="flex flex-col h-full pointer-events-none select-none relative">
                                  <div className="font-semibold text-foreground truncate flex items-center gap-1">
                                    <span className="size-1.5 rounded-full shrink-0" style={{ background: color }} />
                                    {s.layout_name}
                                  </div>
                                  <div className="text-muted-foreground text-[9px] mt-0.5 font-medium">
                                    {formatMinsAMPM(startMins)} - {formatMinsAMPM(endMins)}
                                  </div>
                                  {!s.is_active && (
                                    <span className="absolute top-0 right-0 text-[8px] bg-rose-500/10 text-rose-400 px-1 py-0.5 rounded font-semibold uppercase">Inactive</span>
                                  )}
                                  <div className="mt-auto ml-auto opacity-0 group-hover:opacity-60 transition-opacity">
                                    <Move className="size-3 text-muted-foreground" />
                                  </div>
                                </div>

                                {/* Resize Handle Bottom */}
                                <div
                                  className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                  onMouseDown={(e) => handleBlockMouseDown(e, s, dayIndex, "resize-bottom")}
                                />

                                {/* Drag-move handle center zone */}
                                <div
                                  className="absolute inset-x-2 inset-y-2 cursor-grab active:cursor-grabbing"
                                  onMouseDown={(e) => handleBlockMouseDown(e, s, dayIndex, "move")}
                                />
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>
            </div>

            {/* RIGHT SIDEBAR: Draggable layouts list */}
            <div className="space-y-4">
              <GlassCard className="p-4 flex flex-col gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                  Layouts
                </h2>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search layouts..."
                    value={layoutSearch}
                    onChange={(e) => setLayoutSearch(e.target.value)}
                    className="pl-8 bg-white/5 border-white/10 text-xs h-8"
                  />
                </div>
                <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {filteredLayouts.map((l) => {
                    const color = "hsl(var(--primary))";
                    return (
                      <div
                        key={l.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", l.id);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="p-3 rounded-xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing flex flex-col gap-1.5 shadow-sm group select-none"
                        style={{ borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {l.name}
                        </div>
                      </div>
                    );
                  })}
                  {filteredLayouts.length === 0 && (
                    <div className="text-xs text-muted-foreground italic text-center py-2">
                      No matching layouts
                    </div>
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        )}
      </div>

      {/* ======================================================== */}
      {/* DIALOG: Edit / Configure Schedule Details                 */}
      {/* ======================================================== */}
      <Dialog open={editPopupOpen} onOpenChange={setEditPopupOpen}>
        <DialogContent className="sm:max-w-md glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle>{selectedSchedule ? "Configure Schedule" : "Create Schedule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Layout to display</Label>
              <select
                value={editLayout}
                onChange={(e) => setEditLayout(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              >
                <option value="">Use device default layout</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id} className="bg-[#0d0f12] text-foreground">
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="bg-white/5 border-white/10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Active Days</Label>
              <div className="flex gap-1">
                {COLUMN_HEADERS.map((label, idx) => {
                  const dayVal = WEEK_DAYS[idx];
                  const active = editDays.includes(dayVal);
                  return (
                    <Button
                      key={idx}
                      type="button"
                      variant={active ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleEditDay(dayVal)}
                      className="flex-1 text-[10px] px-0 h-7 border-white/10 font-bold"
                    >
                      {label[0]}
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-y border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground">Active Status</span>
                <span className="text-[10px] text-muted-foreground">Only active schedules run on screens</span>
              </div>
              <button
                onClick={() => setEditActive(!editActive)}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary/40 focus:ring-offset-1 focus:ring-offset-background",
                  editActive ? "bg-emerald-600/70 border-emerald-500/50" : "bg-white/10 border-white/5"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                    editActive ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Divided Actions: Cancel + Save / Delete Series */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditPopupOpen(false)}
                  className="text-xs border-white/10 h-8"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveSchedule}
                  className="text-xs font-semibold h-8"
                  disabled={editDays.length === 0}
                >
                  Save Schedule
                </Button>
              </div>

              {selectedSchedule && (
                <div className="pt-3 border-t border-dashed border-white/10 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Danger Zone</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="text-xs font-semibold h-7"
                    onClick={() => handleDeleteSchedule(selectedSchedule.id)}
                  >
                    Delete Schedule
                  </Button>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Overlap Overwrite Confirmation                    */}
      {/* ======================================================== */}
      <Dialog open={overwriteConfirmOpen} onOpenChange={setOverwriteConfirmOpen}>
        <DialogContent className="max-w-sm glass-strong border-white/10">
          <DialogHeader>
            <DialogTitle>Overwrite Overlapping Schedules?</DialogTitle>
            <DialogDescription>
              This time slot overlaps with other active schedules. Would you like to overwrite those conflicting slots?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => overwritePayload && executeOverwrite(overwritePayload)}
              className="w-full text-xs font-semibold h-8"
            >
              Yes, Overwrite Conflicts
            </Button>
            <Button
              variant="outline"
              onClick={() => setOverwriteConfirmOpen(false)}
              className="w-full text-xs border-white/10 h-8"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
