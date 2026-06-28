import * as React from "react";
import { useEffect, useState, useMemo, useRef } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Info,
  SlidersHorizontal,
  Move,
  Trash2,
  CalendarDays,
  Copy,
  Clock,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// --- API client fetch helper ---
const apiFetch = async (method: string, path: string, body?: any) => {
  const token = localStorage.getItem("sh_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
  return json;
};

interface ApiScheduleInstance {
  id: number;
  schedule_id: number;
  device_id: string;
  layout_id: string;
  layout_name: string | null;
  date: string;
  start_time: string;
  end_time: string;
  start_datetime: string;
  end_datetime: string;
}

interface ApiSchedule {
  id: number;
  device_id: string;
  layout_id: string;
  layout_name: string | null;
  start_time: string;
  end_time: string;
  start_date: string;
  repeat_mode: "none" | "daily" | "custom";
  repeat_interval: number;
  days_count: number;
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
  action: "idle" | "move" | "resize-top" | "resize-bottom";
  blockId: number | null; // schedule_id
  originalDate: string;
  originalStartMins: number;
  originalEndMins: number;
  startY: number;
  startX: number;
  currentDate: string;
  currentStartMins: number;
  currentEndMins: number;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const HOUR_HEIGHT = 48; // px per hour
const PX_PER_MIN = HOUR_HEIGHT / 60;

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

const toISO = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const initialDragState: DragState = {
  action: "idle",
  blockId: null,
  originalDate: "",
  originalStartMins: 0,
  originalEndMins: 0,
  startY: 0,
  startX: 0,
  currentDate: "",
  currentStartMins: 0,
  currentEndMins: 0,
};

const GlassCard = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("glass-card rounded-2xl", className)} {...props}>
    {children}
  </div>
);

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<ApiSchedule[]>([]);
  const [instances, setInstances] = useState<ApiScheduleInstance[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [layouts, setLayouts] = useState<LayoutOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [layoutSearch, setLayoutSearch] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>(toISO(new Date()));
  const [currentWeekDate, setCurrentWeekDate] = useState<string>(toISO(new Date()));

  // Drag-and-drop state
  const [dragState, setDragState] = useState<DragState>(initialDragState);
  const weekGridRef = useRef<HTMLDivElement | null>(null);
  const [colWidth, setColWidth] = useState(120);

  // Active configure popup state
  const [selectedSchedule, setSelectedSchedule] = useState<ApiSchedule | null>(null);
  const [editPopupOpen, setEditPopupOpen] = useState(false);
  const [editRepeatMode, setEditRepeatMode] = useState<"none" | "daily" | "custom">("none");
  const [editRepeatInterval, setEditRepeatInterval] = useState(1);
  const [editDaysCount, setEditDaysCount] = useState(6);
  const [editStartTime, setEditStartTime] = useState("09:00");
  const [editEndTime, setEditEndTime] = useState("17:00");
  const [editLayout, setEditLayout] = useState("");

  // Edit occurrence vs series confirmation
  const [pendingUpdate, setPendingUpdate] = useState<{
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    layout_id: string;
  } | null>(null);

  // Bulk copy operations states
  const [bulkRepeatOpen, setBulkRepeatOpen] = useState(false);
  const [bulkRepeatDate, setBulkRepeatDate] = useState<string | null>(null);
  const [bulkRepeatMode, setBulkRepeatMode] = useState<"none" | "daily" | "custom">("none");
  const [bulkRepeatInterval, setBulkRepeatInterval] = useState(1);
  const [bulkRepeatDaysCount, setBulkRepeatDaysCount] = useState(6);


  // Overwrite validation confirmations
  const [bulkOverwriteDates, setBulkOverwriteDates] = useState<string[] | null>(null);
  const [repeatOverwritePayload, setRepeatOverwritePayload] = useState<{
    schedule_id: number;
    start_date: string;
    repeat_mode: "none" | "daily" | "custom";
    repeat_interval?: number;
    days_count?: number;
    start_time?: string;
    end_time?: string;
  } | null>(null);

  // Month Switcher for Mini Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const schedulesEnabled = selectedDevice ? (selectedDevice.schedules_enabled !== 0) : true;

  // Retrieve current week date range starting on Monday
  const weekDates = useMemo(() => {
    const current = new Date(currentWeekDate + "T00:00:00");
    const day = current.getDay();
    // Monday is index 0 in our weekly rendering headers
    const distanceToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(current.getTime());
    monday.setDate(current.getDate() + distanceToMon);

    return Array.from({ length: 7 }).map((_, idx) => {
      const d = new Date(monday.getTime());
      d.setDate(monday.getDate() + idx);
      return d;
    });
  }, [currentWeekDate]);

  // Compute bulk copy date ranges to display helper text
  const getBulkRecurrenceRangeText = () => {
    if (!bulkRepeatDate) return "";
    const start = new Date(bulkRepeatDate + "T00:00:00");
    const totalDays = bulkRepeatMode === "none" ? 1 : bulkRepeatDaysCount;
    const interval = bulkRepeatMode === "custom" ? bulkRepeatInterval : 1;

    const end = new Date(start.getTime());
    end.setDate(start.getDate() + (totalDays - 1) * interval);

    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (bulkRepeatMode === "none") return `Occurs only on ${startStr}`;
    return `Repeats from ${startStr} to ${endStr} (${totalDays} occurrences)`;
  };

  const getRecurrenceRangeText = () => {
    if (!selectedSchedule) return "";
    const start = new Date(selectedSchedule.start_date + "T00:00:00");
    const totalDays = editRepeatMode === "none" ? 1 : editDaysCount;
    const interval = editRepeatMode === "custom" ? editRepeatInterval : 1;

    const end = new Date(start.getTime());
    end.setDate(start.getDate() + (totalDays - 1) * interval);

    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (editRepeatMode === "none") return `Occurs only on ${startStr}`;
    return `Repeats from ${startStr} to ${endStr} (${totalDays} occurrences)`;
  };

  // Measure Columns widths dynamically
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
  }, [loading]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
          fetchDevicesAndLayouts(data.company_id);
        } else setLoading(false);
      });
  }, [user]);

  const fetchDevicesAndLayouts = async (cId: string) => {
    const [devicesRes, layoutsRes] = await Promise.all([
      supabase.from("devices").select("*").eq("company_id", cId),
      supabase.from("layouts").select("id, name").eq("company_id", cId).order("name"),
    ]);

    const devs = devicesRes.data ?? [];
    setDevices(devs);
    setLayouts(layoutsRes.data ?? []);

    if (devs.length > 0) {
      setSelectedDeviceId(devs[0].id);
      fetchSchedules(devs[0].id);
    } else {
      setLoading(false);
    }
  };

  const fetchSchedules = async (deviceId: string) => {
    setLoading(true);
    try {
      const data = await apiFetch("GET", `/schedules/device/${deviceId}`);
      setSchedules(data.schedules || []);
      setInstances(data.instances || []);
    } catch (err: any) {
      toast.error("Failed to load schedules: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const deviceColorMap = useMemo(() => {
    const m = new Map<string, string>();
    devices.forEach((d, i) => m.set(d.id, DEVICE_COLORS[i % DEVICE_COLORS.length]));
    return m;
  }, [devices]);

  // Handle Schedules bypass status updates
  const updateDeviceSchedulesMode = async (enabled: boolean) => {
    if (!selectedDeviceId || !companyId) return;
    try {
      const { error } = await supabase.from("devices").update({ schedules_enabled: enabled ? 1 : 0 }).eq("id", selectedDeviceId);
      if (error) throw error;
      toast.success("Device schedules mode updated");
      fetchDevicesAndLayouts(companyId);
    } catch (e: any) {
      toast.error("Failed to update schedules mode: " + (e as Error).message);
    }
  };

  const updateDeviceDefaultLayout = async (layoutId: string | null) => {
    if (!selectedDeviceId || !companyId) return;
    try {
      const { error } = await supabase.from("devices").update({ layout_id: layoutId }).eq("id", selectedDeviceId);
      if (error) throw error;
      toast.success("Device default layout updated");
      fetchDevicesAndLayouts(companyId);
    } catch (e: any) {
      toast.error("Failed to update default layout: " + (e as Error).message);
    }
  };

  // Drag-move and drag-resize mouse listener hooks
  useEffect(() => {
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

        const d = new Date(dragState.originalDate + "T00:00:00");
        d.setDate(d.getDate() + dayDelta);

        setDragState((prev) => ({
          ...prev,
          currentDate: toISO(d),
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
      const { blockId, currentDate, currentStartMins, currentEndMins } = dragState;
      setDragState(initialDragState);

      if (
        blockId !== null &&
        (currentDate !== dragState.originalDate ||
        currentStartMins !== dragState.originalStartMins ||
        currentEndMins !== dragState.originalEndMins)
      ) {
        const todayStr = toISO(new Date());
        if (currentDate < todayStr) {
          toast.error("You cannot schedule on past dates");
          return;
        }

        const parent = schedules.find((s) => s.id === blockId);
        const startTimeStr = toHHMM(currentStartMins);
        const endTimeStr = toHHMM(currentEndMins);

        if (parent && parent.repeat_mode !== "none") {
          setPendingUpdate({
            id: blockId,
            date: currentDate,
            start_time: startTimeStr,
            end_time: endTimeStr,
            layout_id: parent.layout_id,
          });
        } else {
          try {
            await apiFetch("PUT", `/schedules/${blockId}`, {
              start_date: currentDate,
              start_time: startTimeStr,
              end_time: endTimeStr,
            });
            toast.success("Schedule adjusted successfully!");
            if (selectedDeviceId) fetchSchedules(selectedDeviceId);
          } catch (err: any) {
            toast.error(err.message || "Failed to update schedule block");
          }
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

  // Click on active timeline block
  const handleBlockClick = (scheduleId: number) => {
    const parent = schedules.find((s) => s.id === scheduleId);
    if (parent) {
      setSelectedSchedule(parent);
      setEditLayout(parent.layout_id);
      setEditRepeatMode(parent.repeat_mode);
      setEditRepeatInterval(parent.repeat_interval || 1);
      setEditDaysCount(parent.days_count || 6);
      setEditStartTime(parent.start_time.slice(0, 5));
      setEditEndTime(parent.end_time.slice(0, 5));
      setEditPopupOpen(true);
    }
  };

  // Drag layouts onto columns handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDropNew = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    if (!schedulesEnabled || !selectedDeviceId) return;

    const todayStr = toISO(new Date());
    if (dateStr < todayStr) {
      toast.error("You cannot schedule on past dates");
      return;
    }

    const layoutId = e.dataTransfer.getData("text/plain");
    if (!layoutId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const droppedMins = Math.max(0, Math.min(24 * 60 - 60, Math.floor(y / PX_PER_MIN)));
    const startMins = Math.round(droppedMins / 15) * 15;
    const endMins = Math.min(24 * 60, startMins + 8 * 60); // 8 Hours default

    try {
      await apiFetch("POST", "/schedules", {
        device_id: selectedDeviceId,
        layout_id: layoutId,
        start_time: toHHMM(startMins),
        end_time: toHHMM(endMins),
        start_date: dateStr,
        repeat_mode: "none",
      });
      toast.success("Schedule block added!");
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to drop layout");
    }
  };

  const handleBlockMouseDown = (
    e: React.MouseEvent,
    instance: ApiScheduleInstance,
    action: DragState["action"]
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (!schedulesEnabled) return;

    const todayStr = toISO(new Date());
    if (instance.date < todayStr) {
      toast.error("Completed slots are locked");
      return;
    }

    const startMins = timeToMinutes(instance.start_time);
    const endMins = timeToMinutes(instance.end_time);

    setDragState({
      action,
      blockId: instance.schedule_id,
      originalDate: instance.date,
      originalStartMins: startMins,
      originalEndMins: endMins,
      startY: e.clientY,
      startX: e.clientX,
      currentDate: instance.date,
      currentStartMins: startMins,
      currentEndMins: endMins,
    });
  };

  // Navigations
  const handlePrevWeek = () => {
    const d = new Date(currentWeekDate + "T00:00:00");
    d.setDate(d.getDate() - 7);
    setCurrentWeekDate(toISO(d));
  };

  const handleNextWeek = () => {
    const d = new Date(currentWeekDate + "T00:00:00");
    d.setDate(d.getDate() + 7);
    setCurrentWeekDate(toISO(d));
  };

  const handleToday = () => {
    const today = toISO(new Date());
    setCurrentWeekDate(today);
    setSelectedDate(today);
    setCalendarMonth(new Date());
  };

  // Configure Schedule submissions
  const handleSaveConfigure = async () => {
    if (!selectedSchedule || !selectedDeviceId) return;

    const payload = {
      layout_id: editLayout,
      start_time: editStartTime,
      end_time: editEndTime,
      start_date: selectedSchedule.start_date,
      repeat_mode: editRepeatMode,
      repeat_interval: editRepeatInterval,
      days_count: editDaysCount,
    };

    try {
      await apiFetch("PUT", `/schedules/${selectedSchedule.id}`, payload);
      toast.success("Schedule series updated successfully!");
      setEditPopupOpen(false);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      if (err.message && err.message.includes("Overlap")) {
        setRepeatOverwritePayload({
          schedule_id: selectedSchedule.id,
          start_date: selectedSchedule.start_date,
          repeat_mode: editRepeatMode,
          repeat_interval: editRepeatInterval,
          days_count: editDaysCount,
          start_time: editStartTime,
          end_time: editEndTime,
        });
        setBulkOverwriteDates([]); // trigger overlap flow
      } else {
        toast.error(err.message || "Failed to update series");
      }
    }
  };

  const handleConfigureException = async () => {
    if (!selectedSchedule || !selectedDeviceId) return;
    try {
      await apiFetch("POST", "/schedules/exception", {
        schedule_id: selectedSchedule.id,
        date: selectedDate,
        start_time: editStartTime,
        end_time: editEndTime,
        layout_id: editLayout,
      });
      toast.success("Exceptions saved for this day successfully!");
      setEditPopupOpen(false);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to save exception");
    }
  };

  const handleDeleteScheduleSeries = async () => {
    if (!selectedSchedule || !selectedDeviceId) return;
    try {
      await apiFetch("DELETE", `/schedules/${selectedSchedule.id}`);
      toast.success("Schedule series deleted successfully");
      setEditPopupOpen(false);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete series");
    }
  };

  const handleDeleteScheduleOccurrence = async () => {
    if (!selectedSchedule || !selectedDeviceId) return;
    try {
      await apiFetch("DELETE", `/schedules/${selectedSchedule.id}?date=${selectedDate}`);
      toast.success("Schedule occurrence deleted successfully");
      setEditPopupOpen(false);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete occurrence");
    }
  };

  // Re-save drag exception adjustments
  const handleExecuteOccurrenceUpdate = async () => {
    if (!pendingUpdate || !selectedDeviceId) return;
    try {
      await apiFetch("POST", "/schedules/exception", {
        schedule_id: pendingUpdate.id,
        date: pendingUpdate.date,
        start_time: pendingUpdate.start_time,
        end_time: pendingUpdate.end_time,
        layout_id: pendingUpdate.layout_id,
      });
      toast.success("Occurrence detached successfully!");
      setPendingUpdate(null);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to split occurrence");
    }
  };

  const handleExecuteSeriesUpdate = async () => {
    if (!pendingUpdate || !selectedDeviceId) return;
    try {
      await apiFetch("PUT", `/schedules/${pendingUpdate.id}`, {
        start_date: pendingUpdate.date,
        start_time: pendingUpdate.start_time,
        end_time: pendingUpdate.end_time,
      });
      toast.success("Entire series updated!");
      setPendingUpdate(null);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust series");
    }
  };

  // Overwrite recurrence conflicts handler
  const executeRepeatOverwrite = async () => {
    if (!bulkRepeatDate || !selectedDeviceId) return;

    if (repeatOverwritePayload) {
      try {
        await apiFetch("POST", "/schedules/repeat", {
          ...repeatOverwritePayload,
          overwrite: true,
        });
        toast.success("Conflicts purged. Recurrence set!");
        setRepeatOverwritePayload(null);
        setBulkOverwriteDates(null);
        setBulkRepeatOpen(false);
        setEditPopupOpen(false);
        fetchSchedules(selectedDeviceId);
      } catch (err: any) {
        toast.error(err.message || "Failed to override recurrence");
      }
      return;
    }

    const targetDates: string[] = [];
    const baseDate = new Date(bulkRepeatDate + "T00:00:00");
    const occurrences = bulkRepeatMode === "none" ? 1 : bulkRepeatDaysCount;
    const interval = bulkRepeatMode === "custom" ? bulkRepeatInterval : 1;

    for (let i = 1; i < occurrences; i++) {
      const nextD = new Date(baseDate.getTime());
      nextD.setDate(baseDate.getDate() + i * interval);
      targetDates.push(toISO(nextD));
    }

    try {
      await apiFetch("POST", "/schedules/copy-day", {
        device_id: selectedDeviceId,
        source_date: bulkRepeatDate,
        target_dates: targetDates,
        overwrite: true,
      });
      toast.success("Conflicts overridden. Recurrence set!");
      setBulkOverwriteDates(null);
      setBulkRepeatOpen(false);
      fetchSchedules(selectedDeviceId);
    } catch (err: any) {
      toast.error(err.message || "Failed to override recurrence");
    }
  };

  // Bulk copy target day operations
  const handleOpenCopyDay = () => {
    setCopyTargetDates([]);
    setCopyDayOpen(true);
  };

  const handleExecuteCopyDay = async (overwriteApprove = false) => {
    if (!selectedDeviceId || !bulkRepeatDate) return;
    try {
      const res = await apiFetch("POST", "/schedules/copy-day", {
        device_id: selectedDeviceId,
        source_date: bulkRepeatDate,
        target_dates: copyTargetDates,
        overwrite: overwriteApprove,
      });

      if (res.has_existing) {
        setCopyOverwriteOpen(true);
      } else {
        toast.success(`Copied successfully to target days!`);
        setCopyDayOpen(false);
        setCopyOverwriteOpen(false);
        setBulkRepeatOpen(false);
        fetchSchedules(selectedDeviceId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to copy day schedules");
    }
  };

  // Recurrence configuration checks
  const handleBulkRecurrenceSave = async () => {
    if (!bulkRepeatDate || !selectedDeviceId) return;
    const dayInstanceSchedules = instances.filter(i => i.date === bulkRepeatDate);
    if (dayInstanceSchedules.length === 0) {
      toast.error("No schedules to repeat on this day");
      return;
    }

    const targetDates: string[] = [];
    const baseDate = new Date(bulkRepeatDate + "T00:00:00");
    const occurrences = bulkRepeatMode === "none" ? 1 : bulkRepeatDaysCount;
    const interval = bulkRepeatMode === "custom" ? bulkRepeatInterval : 1;

    for (let i = 1; i < occurrences; i++) {
      const nextD = new Date(baseDate.getTime());
      nextD.setDate(baseDate.getDate() + i * interval);
      targetDates.push(toISO(nextD));
    }

    if (targetDates.length === 0) {
      toast.error("Please select a repeat pattern greater than 1 day");
      return;
    }

    try {
      const res = await apiFetch("POST", "/schedules/copy-day", {
        device_id: selectedDeviceId,
        source_date: bulkRepeatDate,
        target_dates: targetDates,
        overwrite: false,
      });

      if (res.has_existing) {
        setBulkOverwriteDates(res.existing_dates || []);
      } else {
        toast.success("Bulk recurrence configured successfully!");
        setBulkRepeatOpen(false);
        fetchSchedules(selectedDeviceId);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to configure recurrence");
    }
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule Planner</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule layout playlists to show up at specific days and hours on your screens. Drag-and-drop, resize, and custom repeat rules.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_260px] gap-6 items-start">
          {/* ======================================================== */}
          {/* LEFT SIDEBAR: Device list & Mini calendar                 */}
          {/* ======================================================== */}
          <div className="space-y-6">
            {/* Device Selector */}
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
                  className="pl-8 bg-white/5 border-white/10 text-xs h-8 animate-in"
                />
              </div>
              <div className="space-y-1 max-h-[195px] overflow-y-auto pr-1 custom-scrollbar">
                {filteredDevices.map((d) => {
                  const isSelected = d.id === selectedDeviceId;
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setSelectedDeviceId(d.id);
                        fetchSchedules(d.id);
                      }}
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

            {/* Mini Calendar Picker */}
            <GlassCard className="p-4 flex flex-col gap-3 select-none">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </span>
                <div className="flex gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 rounded-md hover:bg-white/5"
                    onClick={() => {
                      const m = new Date(calendarMonth);
                      m.setMonth(m.getMonth() - 1);
                      setCalendarMonth(m);
                    }}
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-6 rounded-md hover:bg-white/5"
                    onClick={() => {
                      const m = new Date(calendarMonth);
                      m.setMonth(m.getMonth() + 1);
                      setCalendarMonth(m);
                    }}
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-muted-foreground/70">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, idx) => (
                  <div key={idx}>{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-0.5">
                {React.useMemo(() => {
                  const year = calendarMonth.getFullYear();
                  const month = calendarMonth.getMonth();
                  const first = new Date(year, month, 1);
                  let firstDayIndex = first.getDay() - 1;
                  if (firstDayIndex === -1) firstDayIndex = 6;

                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const cells: Array<{ date: Date; isCurrent: boolean } | null> = [];

                  for (let i = 0; i < firstDayIndex; i++) cells.push(null);
                  for (let d = 1; d <= daysInMonth; d++) {
                    cells.push({ date: new Date(year, month, d), isCurrent: true });
                  }

                  while (cells.length % 7 !== 0) cells.push(null);
                  return cells;
                }, [calendarMonth]).map((cell, idx) => {
                  if (cell === null) return <div key={idx} className="aspect-square" />;

                  const cellIso = toISO(cell.date);
                  const isSelected = selectedDate === cellIso;
                  const isToday = toISO(new Date()) === cellIso;
                  const hasSchedules = instances.some((i) => i.date === cellIso);

                  return (
                    <button
                      key={idx}
                    onClick={() => {
                      setSelectedDate(cellIso);
                      setCurrentWeekDate(cellIso);
                    }}
                      className={cn(
                        "aspect-square text-[10px] rounded-md transition-colors relative flex flex-col items-center justify-center font-medium",
                        isSelected
                          ? "bg-primary text-primary-foreground font-semibold"
                          : isToday
                            ? "bg-white/10 text-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                      )}
                    >
                      <span>{cell.date.getDate()}</span>
                      {hasSchedules && (
                        <span className="absolute bottom-1 size-1 rounded-full bg-rose-500" />
                      )}
                    </button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 border-border bg-muted/30 hover:bg-muted"
                onClick={handleToday}
              >
                Today
              </Button>
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
                    <span className="text-[10px] text-muted-foreground">Use a default layout for everything</span>
                  </div>
                  <button
                    onClick={() => {
                      const nextVal = selectedDevice.schedules_enabled === 0;
                      updateDeviceSchedulesMode(nextVal);
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary/40 focus:ring-offset-1 focus:ring-offset-background",
                      selectedDevice.schedules_enabled === 0 ? "bg-amber-600 border-amber-500/50" : "bg-muted border-border"
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
                  <div className="space-y-1.5 pt-2 border-t border-border animate-in fade-in slide-in-from-top-1 duration-150">
                    <Label className="text-[10px] text-muted-foreground font-semibold">Default Fallback Layout</Label>
                    <select
                      value={selectedDevice.layout_id || ""}
                      onChange={(e) => updateDeviceDefaultLayout(e.target.value || null)}
                      className="w-full bg-background border border-input rounded-xl h-8 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                    >
                      <option value="" disabled className="bg-popover text-muted-foreground">Select a default layout...</option>
                      {layouts.map((l) => (
                        <option key={l.id} value={l.id} className="bg-popover text-foreground">
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </GlassCard>
            )}
          </div>

          {/* ======================================================== */}
          {/* MAIN AREA: Interactive calendar week view grid            */}
          {/* ======================================================== */}
          <div className="flex flex-col gap-4" ref={weekGridRef}>
            {/* Week Selector navigation bar */}
            <div className="flex items-center justify-between bg-muted/20 border border-border rounded-2xl px-4 py-2.5 shadow-sm">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full border border-border hover:bg-muted"
                  onClick={handlePrevWeek}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full border border-border hover:bg-muted"
                  onClick={handleNextWeek}
                >
                  <ChevronRight className="size-4" />
                </Button>
                <span className="text-sm font-semibold tracking-tight ml-2">
                  Week of{" "}
                  {weekDates[0].toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3.5" /> Drag layouts onto target date columns
              </span>
            </div>

            {/* Main timeline hours board container */}
            {loading ? (
              <Card>
                <CardContent className="py-12 flex justify-center">
                  <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
                </CardContent>
              </Card>
            ) : (
              <GlassCard className="p-0 overflow-hidden flex flex-col select-none">
                {/* Header days row */}
                <div className="grid grid-cols-[60px_1fr] border-b border-border bg-muted/20 pr-2">
                  <div className="h-10 border-r border-border" />
                  <div className="grid grid-cols-7 h-10 divide-x divide-border">
                    {weekDates.map((date, idx) => {
                      const dateIso = toISO(date);
                      const isSelected = selectedDate === dateIso;
                      const isCurrent = dateIso === toISO(new Date());
                      const isPast = new Date(dateIso + "T00:00:00") < new Date(toISO(new Date()) + "T00:00:00");
                      const formattedDay = date.toLocaleDateString(undefined, { day: "numeric" });
                      
                      return (
                        <div
                          key={idx}
                          onClick={() => {
                            if (!schedulesEnabled) return;
                            setSelectedDate(dateIso);
                            setCurrentWeekDate(dateIso);
                            
                            if (isPast) {
                              toast.error("Past days cannot be repeated or duplicated.");
                              return;
                            }
                            
                            const dayInstances = instances.filter((i) => i.date === dateIso);
                            if (dayInstances.length > 0) {
                              setBulkRepeatDate(dateIso);
                              setBulkRepeatMode("none");
                              setBulkRepeatInterval(1);
                              setBulkRepeatDaysCount(6);
                              setBulkRepeatOpen(true);
                            } else {
                              toast.info("No layouts scheduled on this day to repeat.");
                            }
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center text-center py-1 transition-colors relative",
                            !schedulesEnabled
                              ? "opacity-40 cursor-not-allowed pointer-events-none"
                              : "cursor-pointer hover:bg-muted",
                            isSelected && "bg-primary/5",
                            isCurrent && "bg-primary/5"
                          )}
                        >
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              isSelected
                                ? "text-primary"
                                : isPast
                                  ? "text-rose-400/90"
                                  : "text-muted-foreground"
                            )}
                          >
                            {date.toLocaleDateString(undefined, { weekday: "short" })}
                          </span>
                          <span
                            className={cn(
                              "text-xs font-bold mt-0.5",
                              isCurrent
                                ? "text-primary"
                                : isPast
                                  ? "text-rose-400/80"
                                  : "text-foreground"
                            )}
                          >
                            {formattedDay}
                          </span>
                          {instances.some((i) => i.date === dateIso) && (
                            <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vertical board content area */}
                <div className="grid grid-cols-[60px_1fr] relative overflow-y-scroll max-h-[700px] custom-scrollbar">
                  {/* Hours timeline side gutter */}
                  <div className="bg-muted/10 border-r border-border select-none text-[10px] text-muted-foreground pr-2 pt-1.5 text-right font-medium">
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div key={h} style={{ height: HOUR_HEIGHT }} className="border-b border-border select-none pr-1">
                        {String(h).padStart(2, "0")}:00
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  <div className="grid grid-cols-7 relative divide-x divide-border bg-card/10">
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

                    {/* Horizontal hour lines */}
                    {Array.from({ length: 24 }).map((_, h) => (
                      <div
                        key={h}
                        className="absolute left-0 right-0 border-b border-border/40 pointer-events-none"
                        style={{ top: (h + 1) * HOUR_HEIGHT - 1, height: 1 }}
                      />
                    ))}

                    {/* Date-specific columns grid */}
                    {weekDates.map((date, colIdx) => {
                      const dateIso = toISO(date);
                      const isSelected = selectedDate === dateIso;
                      const isPast = new Date(dateIso + "T00:00:00") < new Date(toISO(new Date()) + "T00:00:00");

                      const dayInstances = instances.filter((i) => i.date === dateIso);

                      return (
                        <div
                          key={dateIso}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropNew(e, dateIso)}
                          className={cn(
                            "relative h-full flex flex-col transition-colors min-h-[1152px]",
                            isSelected && "bg-primary/[0.01]",
                            isPast && "bg-muted/20"
                          )}
                        >
                          {/* Render schedule instances */}
                          {dayInstances.map((inst) => {
                            const isDraggingThis = dragState.blockId === inst.schedule_id && dragState.currentDate === dateIso;
                            const startMins = isDraggingThis ? dragState.currentStartMins : timeToMinutes(inst.start_time);
                            const endMins = isDraggingThis ? dragState.currentEndMins : timeToMinutes(inst.end_time);

                            const top = startMins * PX_PER_MIN;
                            const height = (endMins - startMins) * PX_PER_MIN;
                            const color = deviceColorMap.get(inst.device_id) || "styled";

                            const shouldDisplay = !isDraggingThis || (dragState.action !== "move" || dragState.currentDate === dateIso);
                            if (!shouldDisplay) return null;

                            return (
                              <div
                                key={inst.id}
                                draggable="false"
                                onClick={() => handleBlockClick(inst.schedule_id)}
                                className={cn(
                                  "absolute left-1 right-1 rounded-xl p-2 text-[10px] overflow-hidden group shadow-md transition-shadow hover:shadow-lg border-l-4 cursor-pointer",
                                  isPast && "opacity-60 cursor-not-allowed",
                                  isDraggingThis && "opacity-90 shadow-2xl scale-[0.98] ring-1 ring-primary/40"
                                )}
                                style={{
                                  top,
                                  height,
                                  background: `color-mix(in oklch, ${color} 12%, hsl(var(--card)))`,
                                  borderColor: color,
                                  color: `color-mix(in oklch, ${color} 50%, hsl(var(--foreground)))`
                                }}
                              >
                                {/* Resize Handle Top */}
                                {!isPast && (
                                  <div
                                    className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                    onMouseDown={(e) => handleBlockMouseDown(e, inst, "resize-top")}
                                  />
                                )}

                                {/* Content area */}
                                <div className="flex flex-col h-full pointer-events-none select-none relative">
                                  <div className="font-semibold text-foreground truncate flex items-center gap-1">
                                    <span className="size-1.5 rounded-full shrink-0" style={{ background: color }} />
                                    {inst.layout_name}
                                  </div>
                                  <div className="text-muted-foreground text-[9px] mt-0.5 font-medium">
                                    {formatMinsAMPM(startMins)} - {formatMinsAMPM(endMins)}
                                  </div>
                                  {isPast && (
                                    <span className="absolute top-0 right-0 text-[8px] bg-white/10 text-muted-foreground/60 px-1 py-0.5 rounded font-semibold uppercase">Completed</span>
                                  )}
                                  {!isPast && (
                                    <div className="mt-auto ml-auto opacity-0 group-hover:opacity-60 transition-opacity">
                                      <Move className="size-3 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>

                                {/* Resize Handle Bottom */}
                                {!isPast && (
                                  <div
                                    className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                    onMouseDown={(e) => handleBlockMouseDown(e, inst, "resize-bottom")}
                                  />
                                )}

                                {/* Drag-move handle center zone */}
                                {!isPast && (
                                  <div
                                    className="absolute inset-x-2 inset-y-2 cursor-grab active:cursor-grabbing"
                                    onMouseDown={(e) => handleBlockMouseDown(e, inst, "move")}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>
            )}
          </div>

          {/* ======================================================== */}
          {/* RIGHT SIDEBAR: Draggable layouts list                     */}
          {/* ======================================================== */}
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
                  className="pl-8 bg-background border-input text-xs h-8"
                />
              </div>
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar animate-in">
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
                      className="p-3 rounded-xl border border-border bg-card hover:bg-muted active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing flex flex-col gap-1.5 shadow-sm group select-none"
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
      </div>

      {/* ======================================================== */}
      {/* DIALOG: Edit / Configure Schedule Details                 */}
      {/* ======================================================== */}
      <Dialog open={editPopupOpen} onOpenChange={setEditPopupOpen}>
        <DialogContent className="sm:max-w-md border border-border">
          <DialogHeader>
            <DialogTitle>Configure Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Layout to display</Label>
              <select
                value={editLayout}
                onChange={(e) => setEditLayout(e.target.value)}
                className="w-full bg-background border border-input rounded-xl h-9 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
              >
                <option value="" className="bg-popover text-foreground">Use device default layout</option>
                {layouts.map((l) => (
                  <option key={l.id} value={l.id} className="bg-popover text-foreground">
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
                  className="bg-background border-input text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="bg-background border-input text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat Pattern</Label>
                {selectedSchedule && (
                  <span className="text-[10px] text-muted-foreground font-semibold">
                    Series Start: {selectedSchedule.start_date}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["none", "No Repeat"],
                    ["daily", "Daily"],
                    ["custom", "Every X Days"],
                  ] as Array<["none" | "daily" | "custom", string]>
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setEditRepeatMode(k)}
                    className={cn(
                      "py-2 rounded-xl text-xs border font-medium transition-all",
                      editRepeatMode === k
                        ? "bg-primary/20 border-primary/40 text-foreground"
                        : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Interval settings */}
            {editRepeatMode === "custom" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat Interval</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={editRepeatInterval}
                    onChange={(e) => setEditRepeatInterval(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 bg-background border-input h-8 text-center text-xs"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
            )}

            {/* Occurrences / Days count limit presets */}
            {editRepeatMode !== "none" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat For</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 6, 12, 30].map((num) => (
                    <button
                      key={num}
                      onClick={() => setEditDaysCount(num)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs border transition-colors",
                        editDaysCount === num
                          ? "bg-primary/20 border-primary/40 text-foreground"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {num} day{num > 1 ? "s" : ""}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={editDaysCount}
                      onChange={(e) => setEditDaysCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 bg-background border-input h-8 text-center text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {selectedSchedule && (
              <div className="text-[10px] text-muted-foreground/80 leading-relaxed py-1.5 border-y border-border flex items-center gap-1.5 bg-muted/20 px-2 rounded-lg">
                <Clock className="size-3.5 shrink-0 text-primary" />
                <span>{getRecurrenceRangeText()}</span>
              </div>
            )}

            {/* Separated action dividers */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setEditPopupOpen(false)}
                  className="text-xs border-border h-8"
                >
                  Cancel
                </Button>
                {selectedSchedule && selectedSchedule.repeat_mode !== "none" && (
                  <Button
                    variant="outline"
                    onClick={handleConfigureException}
                    className="text-xs font-semibold h-8 text-primary border-primary/20 hover:bg-primary/5"
                  >
                    Save Only This Day
                  </Button>
                )}
                <Button
                  onClick={handleSaveConfigure}
                  className="text-xs font-semibold h-8"
                >
                  Save Series
                </Button>
              </div>

              {selectedSchedule && (
                <div className="pt-3 border-t border-dashed border-border flex items-center justify-between">
                  <span className="text-[10px] font-bold text-destructive uppercase tracking-wider">Danger Zone</span>
                  <div className="flex gap-2">
                    {selectedSchedule.repeat_mode !== "none" && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-[10px] font-bold h-7 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-rose-400 border border-red-200 dark:border-rose-900/50 hover:bg-red-100 dark:hover:bg-red-900/30"
                        onClick={handleDeleteScheduleOccurrence}
                      >
                        Delete Only This Day
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-xs font-semibold h-7"
                      onClick={handleDeleteScheduleSeries}
                    >
                      Delete Series
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Bulk Repeat Day Schedules / Copy Actions          */}
      {/* ======================================================== */}
      <Dialog open={bulkRepeatOpen} onOpenChange={setBulkRepeatOpen}>
        <DialogContent className="sm:max-w-md border border-border">
          <DialogHeader>
            <DialogTitle>Configure Day Recurrence</DialogTitle>
            <DialogDescription>
              Configure repeat configurations for all layouts scheduled on{" "}
              <strong>{bulkRepeatDate}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Day Schedules List */}
            <div className="border border-border rounded-xl overflow-hidden bg-card">
              <div className="px-3 py-2 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Schedules for this day
              </div>
              <div className="divide-y divide-border max-h-[120px] overflow-y-auto custom-scrollbar">
                {(() => {
                  const dayInstanceSchedules = instances.filter(i => i.date === bulkRepeatDate);
                  const dayScheduleIds = Array.from(new Set(dayInstanceSchedules.map(i => i.schedule_id)));
                  const targetSchedules = schedules.filter(s => dayScheduleIds.includes(s.id));

                  if (targetSchedules.length === 0) {
                    return <div className="p-3 text-xs italic text-center text-muted-foreground">No layouts scheduled on this day</div>;
                  }
                  return targetSchedules.map((s) => {
                    const color = deviceColorMap.get(s.device_id) || "hsl(var(--primary))";
                    return (
                      <div key={s.id} className="p-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: color }} />
                          <span className="font-semibold text-foreground truncate max-w-[140px]">{s.layout_name}</span>
                        </div>
                        <span className="text-muted-foreground font-medium text-[10px]">{s.start_time} - {s.end_time}</span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold">Repeat Pattern</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["none", "No Repeat"],
                    ["daily", "Daily"],
                    ["custom", "Every X Days"],
                  ] as Array<["none" | "daily" | "custom", string]>
                ).map(([k, l]) => (
                  <button
                    key={k}
                    onClick={() => setBulkRepeatMode(k)}
                    className={cn(
                      "py-2 rounded-xl text-xs border font-medium transition-all",
                      bulkRepeatMode === k
                        ? "bg-primary/20 border-primary/40 text-foreground"
                        : "bg-muted/40 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Interval settings */}
            {bulkRepeatMode === "custom" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat Interval</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Every</span>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={bulkRepeatInterval}
                    onChange={(e) => setBulkRepeatInterval(Math.max(1, Number(e.target.value) || 1))}
                    className="w-20 bg-background border-input h-8 text-center text-xs"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                </div>
              </div>
            )}

            {/* Occurrences / Days count limit presets */}
            {bulkRepeatMode !== "none" && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat For</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  {[1, 6, 12, 30].map((num) => (
                    <button
                      key={num}
                      onClick={() => setBulkRepeatDaysCount(num)}
                      className={cn(
                        "px-3 py-1 rounded-md text-xs border transition-colors",
                        bulkRepeatDaysCount === num
                          ? "bg-primary/20 border-primary/40 text-foreground"
                          : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {num} day{num > 1 ? "s" : ""}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Custom:</span>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={bulkRepeatDaysCount}
                      onChange={(e) => setBulkRepeatDaysCount(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 bg-background border-input h-8 text-center text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {bulkRepeatDate && (
              <div className="text-[10px] text-muted-foreground/80 leading-relaxed py-1.5 border-y border-border flex items-center gap-1.5 bg-muted/20 px-2 rounded-lg">
                <Clock className="size-3.5 shrink-0 text-primary" />
                <span>{getBulkRecurrenceRangeText()}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRepeatOpen(false)}
                className="text-xs h-8 border-border"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleBulkRecurrenceSave}
                className="text-xs h-8 font-semibold"
                disabled={bulkRepeatMode === "none"}
              >
                Apply Recurrence
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>



      {/* ======================================================== */}
      {/* DIALOG: Drag Move/Resize Exception Split Confirm          */}
      {/* ======================================================== */}
      <Dialog open={!!pendingUpdate} onOpenChange={() => setPendingUpdate(null)}>
        <DialogContent className="max-w-sm border border-border">
          <DialogHeader>
            <DialogTitle>Adjust Recurring Occurrence</DialogTitle>
            <DialogDescription>
              You are adjusting a layout occurrence that is part of a recurring series. Would you like to save this day as a standalone slot or apply it to the entire series?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={handleExecuteOccurrenceUpdate}
              className="w-full text-xs font-semibold h-8 text-primary border border-primary/20 hover:bg-primary/5 bg-transparent"
            >
              Save Only This Day (Detach)
            </Button>
            <Button
              onClick={handleExecuteSeriesUpdate}
              className="w-full text-xs font-semibold h-8"
            >
              Apply to Entire Series
            </Button>
            <Button
              variant="outline"
              onClick={() => setPendingUpdate(null)}
              className="w-full text-xs border-border h-8"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Overwrite Recurrence Conflicts                    */}
      {/* ======================================================== */}
      <Dialog open={bulkOverwriteDates !== null} onOpenChange={() => setBulkOverwriteDates(null)}>
        <DialogContent className="max-w-sm border border-border">
          <DialogHeader>
            <DialogTitle>Overwrite Existing Schedules?</DialogTitle>
            <DialogDescription>
              Schedules already exist on some of the target dates. Do you want to overwrite them?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={executeRepeatOverwrite}
              className="w-full text-xs font-semibold h-8"
            >
              Yes, Overwrite Conflicts
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkOverwriteDates(null)}
              className="w-full text-xs border-border h-8"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>


    </AdminLayout>
  );
}
