// Screen scheduling page with double-click selection and range actions
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Calendar,
  Search,
  RefreshCw,
  Clock,
  Layout,
  Repeat,
  Move,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HOURS = 24;
const PX_PER_HOUR = 60; // 1 hour = 60px
const PX_PER_MIN = PX_PER_HOUR / 60; // 1 min = 1px

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PALETTE = [
  "oklch(0.76 0.17 210)", // Soft Teal
  "oklch(0.72 0.21 330)", // Soft Violet
  "oklch(0.80 0.15 150)", // Soft Emerald
  "oklch(0.82 0.16 70)",  // Soft Orange
  "oklch(0.74 0.19 15)",  // Soft Rose
  "oklch(0.78 0.16 270)", // Soft Lavender
];

// Helper: Format Date to YYYY-MM-DD
function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper: Parse YYYY-MM-DD safely into a local Date object
function parseISODate(s: string) {
  if (!s) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Helper: Convert time string "HH:MM:SS" or "HH:MM" to minutes of day
function parseHHMM(s: string) {
  if (!s) return 0;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

// Helper: Convert minutes of day to time string "HH:MM"
function toHHMM(mins: number) {
  const m = Math.max(0, Math.min(24 * 60, mins));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${String(h).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

// Helper: Get Monday of the week for a given date
function getMonday(d: Date) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
  return new Date(d.setDate(diff));
}

// Helper: Format minutes to AM/PM string
function formatMinsAMPM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = String(m).padStart(2, "0");
  return `${displayH}:${displayM} ${ampm}`;
}

type DragState = {
  action: "idle" | "move" | "resize-top" | "resize-bottom";
  blockId: number | null;
  originalDate: string;
  originalStartMins: number;
  originalEndMins: number;
  startY: number;
  startX: number;
  currentDate: string;
  currentStartMins: number;
  currentEndMins: number;
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

export type RepeatMode = "none" | "daily" | "custom";

export type ApiScheduleInstance = {
  id: number;
  schedule_id: number;
  device_id: string;
  layout_id: string;
  layout_name: string | null;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  start_datetime: string;
  end_datetime: string;
};

export type ApiSchedule = {
  id: number;
  device_id: string;
  layout_id: string;
  layout_name: string | null;
  start_time: string; // HH:MM
  end_time: string;   // HH:MM
  start_date: string; // YYYY-MM-DD
  repeat_mode: RepeatMode;
  repeat_interval: number;
  days_count: number;
};

// Express Custom Schedules API client
const shApi = async (method: string, endpoint: string, body?: any) => {
  const token = localStorage.getItem("sh_token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || `${res.status} ${res.statusText}`);
  }
  return json;
};

const SchedulesApi = {
  list: (deviceId: string) => shApi("GET", `/schedules/device/${deviceId}`),
  create: (body: any) => shApi("POST", "/schedules", body),
  update: (id: number, body: any) => shApi("PUT", `/schedules/${id}`, body),
  remove: (id: number, date?: string) => shApi("DELETE", date ? `/schedules/${id}?date=${date}` : `/schedules/${id}`),
  repeat: (body: any) => shApi("POST", "/schedules/repeat", body),
  exception: (body: any) => shApi("POST", "/schedules/exception", body),
  copyDay: (body: any) => shApi("POST", "/schedules/copy-day", body),
  clearDay: (body: any) => shApi("POST", "/schedules/clear-day", body),
  copyDevice: (body: any) => shApi("POST", "/schedules/copy-device", body),
};

export default function AdminSchedulePage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [companyId, setCompanyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("company_id").eq("id", user.id).single()
      .then(({ data }) => {
        if (data?.company_id) {
          setCompanyId(data.company_id);
        }
      });
  }, [user]);

  const devicesQ = useQuery({
    queryKey: ["devices", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("devices").select("*").eq("company_id", companyId!);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const layoutsQ = useQuery({
    queryKey: ["layouts", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("layouts").select("id, name").eq("company_id", companyId!).order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const devices = devicesQ.data ?? [];
  const layouts = layoutsQ.data ?? [];

  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);
  const [deviceSearch, setDeviceSearch] = React.useState("");
  const [layoutSearch, setLayoutSearch] = React.useState("");
  const [selectedDate, setSelectedDate] = React.useState<string>(toISO(new Date()));
  const [currentWeekDate, setCurrentWeekDate] = React.useState<string>(toISO(new Date()));

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId);
  const schedulesEnabled = selectedDevice ? (selectedDevice.schedules_enabled !== 0) : true;

  // Active schedule editing state
  const [selectedSchedule, setSelectedSchedule] = React.useState<ApiSchedule | null>(null);
  const [editPopupOpen, setEditPopupOpen] = React.useState(false);
  const [editRepeatMode, setEditRepeatMode] = React.useState<RepeatMode>("none");
  const [editRepeatInterval, setEditRepeatInterval] = React.useState(1);
  const [editDaysCount, setEditDaysCount] = React.useState(6);
  const [editStartTime, setEditStartTime] = React.useState("09:00");
  const [editEndTime, setEditEndTime] = React.useState("17:00");

  // Edit occurrence vs series confirmation state
  const [pendingUpdate, setPendingUpdate] = React.useState<{
    id: number;
    date: string;
    start_time: string;
    end_time: string;
    layout_id: string;
  } | null>(null);

  // Bulk repeat day schedules state
  const [bulkRepeatOpen, setBulkRepeatOpen] = React.useState(false);
  const [bulkRepeatDate, setBulkRepeatDate] = React.useState<string | null>(null);
  const [bulkRepeatMode, setBulkRepeatMode] = React.useState<RepeatMode>("none");
  const [bulkRepeatInterval, setBulkRepeatInterval] = React.useState(1);
  const [bulkRepeatDaysCount, setBulkRepeatDaysCount] = React.useState(6);

  // Overwrite state variables
  const [bulkOverwriteDates, setBulkOverwriteDates] = React.useState<string[] | null>(null);
  const [repeatOverwritePayload, setRepeatOverwritePayload] = React.useState<any | null>(null);

  // Copy device schedule states
  const [copySourceDeviceId, setCopySourceDeviceId] = React.useState<string>("");
  const [copyConfirmOpen, setCopyConfirmOpen] = React.useState(false);
  const [copyOverlapOpen, setCopyOverlapOpen] = React.useState(false);

  // Day selection and bulk deletion states
  const [selectedDates, setSelectedDates] = React.useState<string[]>([]);
  const [selectionAnchorDate, setSelectionAnchorDate] = React.useState<string | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = React.useState(false);

  const getBulkRecurrenceRangeText = () => {
    if (!bulkRepeatDate) return "";
    const start = parseISODate(bulkRepeatDate);
    const totalDays = bulkRepeatMode === "none" ? 1 : bulkRepeatDaysCount;
    const interval = bulkRepeatMode === "custom" ? bulkRepeatInterval : 1;

    const end = new Date(start.getTime());
    end.setDate(start.getDate() + (totalDays - 1) * interval);

    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (bulkRepeatMode === "none") {
      return `Occurs only on ${startStr}`;
    }
    return `Repeats from ${startStr} to ${endStr} (${totalDays} occurrences)`;
  };

  const getRecurrenceRangeText = () => {
    if (!selectedSchedule) return "";
    const start = parseISODate(selectedSchedule.start_date);
    const totalDays = editRepeatMode === "none" ? 1 : editDaysCount;
    const interval = editRepeatMode === "custom" ? editRepeatInterval : 1;

    const end = new Date(start.getTime());
    end.setDate(start.getDate() + (totalDays - 1) * interval);

    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    if (editRepeatMode === "none") {
      return `Occurs only on ${startStr}`;
    }
    return `Repeats from ${startStr} to ${endStr} (${totalDays} occurrences)`;
  };

  // Drag and drop / resize state
  const [dragState, setDragState] = React.useState<DragState>(initialDragState);
  const weekGridRef = React.useRef<HTMLDivElement | null>(null);
  const [colWidth, setColWidth] = React.useState(120);

  // Set default selected device on load
  React.useEffect(() => {
    if (selectedDeviceId === null && devices.length > 0) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Keyboard event listener for column selection (Shift + Arrows, Escape, Delete)
  React.useEffect(() => {
    if (selectedDates.length === 0 || !selectionAnchorDate) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedDates([]);
        setSelectionAnchorDate(null);
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        setBulkDeleteConfirmOpen(true);
        return;
      }

      if (e.shiftKey && (e.key === "ArrowRight" || e.key === "ArrowLeft")) {
        e.preventDefault();
        const anchorIdx = weekDates.findIndex(d => toISO(d) === selectionAnchorDate);
        if (anchorIdx === -1) return;

        const indices = selectedDates
          .map(d => weekDates.findIndex(w => toISO(w) === d))
          .filter(idx => idx !== -1);
        
        if (indices.length === 0) return;

        const minIdx = Math.min(...indices);
        const maxIdx = Math.max(...indices);

        let newMin = minIdx;
        let newMax = maxIdx;

        if (e.key === "ArrowRight") {
          if (selectionAnchorDate === toISO(weekDates[minIdx])) {
            newMax = Math.min(6, maxIdx + 1);
          } else {
            newMin = Math.min(maxIdx, minIdx + 1);
          }
        } else if (e.key === "ArrowLeft") {
          if (selectionAnchorDate === toISO(weekDates[maxIdx])) {
            newMin = Math.max(0, minIdx - 1);
          } else {
            newMax = Math.max(minIdx, maxIdx - 1);
          }
        }

        const newSelection: string[] = [];
        for (let i = newMin; i <= newMax; i++) {
          newSelection.push(toISO(weekDates[i]));
        }
        setSelectedDates(newSelection);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedDates, selectionAnchorDate, weekDates]);

  // Load schedules and instances for the selected device
  const schedulesQ = useQuery({
    queryKey: ["schedules", selectedDeviceId],
    queryFn: () => SchedulesApi.list(selectedDeviceId!),
    enabled: selectedDeviceId !== null,
  });

  const schedules: ApiSchedule[] = schedulesQ.data?.schedules ?? [];
  const instances: ApiScheduleInstance[] = schedulesQ.data?.instances ?? [];

  // Track layout colors
  const layoutColor = React.useMemo(() => {
    const m = new Map<string, string>();
    layouts.forEach((t, i) => m.set(t.id, PALETTE[i % PALETTE.length]));
    return m;
  }, [layouts]);

  // Calculations for dates of the current week view
  const weekDates = React.useMemo(() => {
    const base = getMonday(parseISODate(currentWeekDate));
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(base.getTime());
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [currentWeekDate]);

  // Live clock for time indicator
  const [nowTime, setNowTime] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Update column width on resize
  React.useEffect(() => {
    if (!weekGridRef.current) return;
    const updateWidth = () => {
      const colEl = weekGridRef.current?.querySelector(".day-column");
      if (colEl) setColWidth(colEl.getBoundingClientRect().width);
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, [currentWeekDate, selectedDeviceId]);

  // Mutations
  const createMut = useMutation({
    mutationFn: (body: any) => SchedulesApi.create(body),
    onSuccess: () => {
      toast.success("Schedule created successfully");
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) =>
      SchedulesApi.update(id, body),
    onSuccess: () => {
      toast.success("Schedule updated");
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: ({ id, date }: { id: number; date?: string }) => SchedulesApi.remove(id, date),
    onSuccess: () => {
      toast.success("Schedule deleted");
      setSelectedSchedule(null);
      setEditPopupOpen(false);
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const repeatMut = useMutation({
    mutationFn: (body: any) => SchedulesApi.repeat(body),
    onSuccess: () => {
      toast.success("Recurrence updated");
      setEditPopupOpen(false);
      setRepeatOverwritePayload(null);
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e: any) => {
      if (e.body && e.body.has_overlap) {
        setRepeatOverwritePayload({
          schedule_id: selectedSchedule!.id,
          repeat_mode: editRepeatMode,
          repeat_interval: editRepeatMode === "custom" ? editRepeatInterval : 1,
          days_count: editRepeatMode === "none" ? 1 : editDaysCount,
          start_time: editStartTime,
          end_time: editEndTime,
        });
      } else {
        toast.error(e.message || "An error occurred");
      }
    },
  });

  const bulkRepeatMut = useMutation({
    mutationFn: async (payload: {
      source_date: string;
      target_dates: string[];
      overwrite?: boolean;
    }) =>
      SchedulesApi.copyDay({
        device_id: selectedDeviceId!,
        source_date: payload.source_date,
        target_dates: payload.target_dates,
        overwrite: payload.overwrite,
      }),
    onSuccess: (data) => {
      if (data && data.has_existing) {
        setBulkOverwriteDates(data.existing_dates || []);
      } else {
        toast.success("Day schedules replicated successfully");
        setBulkRepeatOpen(false);
        setBulkOverwriteDates(null);
        qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
      }
    },
    onError: (e) => toast.error(e.message),
  });

  const clearDayMut = useMutation({
    mutationFn: () => SchedulesApi.clearDay({ device_id: selectedDeviceId!, date: bulkRepeatDate! }),
    onSuccess: () => {
      toast.success("Day schedules cleared");
      setBulkRepeatOpen(false);
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateOccurrenceMut = useMutation({
    mutationFn: async (payload: {
      id: number;
      date: string;
      start_time: string;
      end_time: string;
      layout_id: string;
    }) => {
      await SchedulesApi.exception({
        schedule_id: payload.id,
        date: payload.date,
        start_time: payload.start_time,
        end_time: payload.end_time,
        layout_id: payload.layout_id,
      });
    },
    onSuccess: () => {
      toast.success("Updated schedule for this day only");
      setPendingUpdate(null);
      setEditPopupOpen(false);
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const copyDeviceMut = useMutation({
    mutationFn: async ({ sourceDeviceId, overwrite }: { sourceDeviceId: string; overwrite: boolean }) => {
      return SchedulesApi.copyDevice({
        target_device_id: selectedDeviceId!,
        source_device_id: sourceDeviceId,
        overwrite,
      });
    },
    onSuccess: (data) => {
      if (data && data.has_existing) {
        setCopyOverlapOpen(true);
      } else {
        toast.success("Schedule duplicated successfully");
        setCopyConfirmOpen(false);
        setCopyOverlapOpen(false);
        setCopySourceDeviceId("");
        qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSelectedDays = useMutation({
    mutationFn: async () => {
      for (const date of selectedDates) {
        await SchedulesApi.clearDay({ device_id: selectedDeviceId!, date });
      }
    },
    onSuccess: () => {
      toast.success("Schedules cleared for selected days");
      setSelectedDates([]);
      setSelectionAnchorDate(null);
      setBulkDeleteConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["schedules", selectedDeviceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateDeviceSchedulesMode = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!selectedDeviceId) return;
      const { error } = await supabase.from("devices").update({ schedules_enabled: enabled ? 1 : 0 }).eq("id", selectedDeviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Device schedule mode updated");
      qc.invalidateQueries({ queryKey: ["devices", companyId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const updateDeviceDefaultLayout = useMutation({
    mutationFn: async (layoutId: string | null) => {
      if (!selectedDeviceId) return;
      const { error } = await supabase.from("devices").update({ layout_id: layoutId }).eq("id", selectedDeviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Device default layout updated");
      qc.invalidateQueries({ queryKey: ["devices", companyId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  // Handle global mouse move & mouse up for Drag-Move / Drag-Resize gestures
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

        // Constraint boundaries
        if (newStart < 0) {
          newEnd -= newStart;
          newStart = 0;
        }
        if (newEnd > 24 * 60) {
          newStart -= (newEnd - 24 * 60);
          newEnd = 24 * 60;
        }

        const d = parseISODate(dragState.originalDate);
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

    const handleMouseUp = () => {
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
          updateMut.mutate({
            id: blockId,
            body: {
              start_date: currentDate,
              start_time: startTimeStr,
              end_time: endTimeStr,
            },
          });
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, colWidth, schedules]);

  // Sidebar Filtered Lists
  const filteredDevices = devices.filter(
    (d: any) =>
      d.name.toLowerCase().includes(deviceSearch.toLowerCase()) ||
      (d.location && d.location.toLowerCase().includes(deviceSearch.toLowerCase()))
  );

  const filteredLayouts = layouts.filter((t: any) =>
    t.name.toLowerCase().includes(layoutSearch.toLowerCase())
  );

  // Month Switcher for Mini Calendar
  const [calendarMonth, setCalendarMonth] = React.useState(new Date());

  const calendarCells = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    // Adjust first weekday: Mon=0, Sun=6
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
  }, [calendarMonth]);

  const handleBlockClick = (scheduleId: number) => {
    const parent = schedules.find((s) => s.id === scheduleId);
    if (parent) {
      setSelectedSchedule(parent);
      setEditRepeatMode(parent.repeat_mode);
      setEditRepeatInterval(parent.repeat_interval || 1);
      setEditDaysCount(parent.days_count || 6);
      setEditStartTime(parent.start_time.slice(0, 5));
      setEditEndTime(parent.end_time.slice(0, 5));
      setEditPopupOpen(true);
    }
  };

  const handleBlockMouseDown = (
    e: React.MouseEvent,
    inst: ApiScheduleInstance,
    actionType: DragState["action"]
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setDragState({
      action: actionType,
      blockId: inst.schedule_id,
      originalDate: inst.date,
      originalStartMins: parseHHMM(inst.start_time),
      originalEndMins: parseHHMM(inst.end_time),
      startY: e.clientY,
      startX: e.clientX,
      currentDate: inst.date,
      currentStartMins: parseHHMM(inst.start_time),
      currentEndMins: parseHHMM(inst.end_time),
    });
  };

  const handleGridDrop = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();

    const todayStr = toISO(new Date());
    if (dateStr < todayStr) {
      toast.error("You cannot schedule on past dates");
      return;
    }

    const layoutIdStr = e.dataTransfer.getData("text/plain");
    if (!layoutIdStr) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const droppedMins = Math.max(0, Math.min(24 * 60 - 60, Math.floor(y / PX_PER_MIN)));
    const startMins = Math.round(droppedMins / 15) * 15;
    const endMins = Math.min(24 * 60, startMins + 8 * 60); // 8 Hours default

    createMut.mutate({
      device_id: selectedDeviceId!,
      layout_id: layoutIdStr,
      start_time: toHHMM(startMins),
      end_time: toHHMM(endMins),
      start_date: dateStr,
      repeat_mode: "none",
    });
  };

  const handlePrevWeek = () => {
    const d = parseISODate(currentWeekDate);
    d.setDate(d.getDate() - 7);
    setCurrentWeekDate(toISO(d));
  };

  const handleNextWeek = () => {
    const d = parseISODate(currentWeekDate);
    d.setDate(d.getDate() + 7);
    setCurrentWeekDate(toISO(d));
  };

  const handleToday = () => {
    const today = toISO(new Date());
    setCurrentWeekDate(today);
    setSelectedDate(today);
    setCalendarMonth(new Date());
  };

  if (devicesQ.isLoading || layoutsQ.isLoading) {
    return (
      <AdminLayout>
        <PageHeader title="Schedule Planner" />
        <div className="flex h-96 items-center justify-center">
          <RefreshCw className="size-8 text-primary animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Schedule Planner"
        description="Schedule layouts to show up at specific days and hours on your signage terminals. Support drag-and-drop, resize, and custom repeat rules."
      />

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
                className="pl-8 bg-background border-border text-xs h-8 focus:ring-1 focus:ring-primary/45"
              />
            </div>
            <div className="space-y-1 max-h-[195px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredDevices.map((d: any) => {
                const isSelected = d.id === selectedDeviceId;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDeviceId(d.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all duration-200",
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-foreground font-medium"
                        : "bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className="truncate">
                      <div>{d.name}</div>
                      {d.location && <div className="text-[10px] opacity-75">{d.location}</div>}
                    </div>
                    <span
                      className={cn(
                        "size-1.5 rounded-full shrink-0 ml-1.5",
                        !!d.is_paused
                          ? "bg-amber-400"
                          : d.status === "online"
                            ? "bg-emerald-400 animate-pulse"
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

          {/* Mini Calendar */}
          <GlassCard className="p-4 flex flex-col gap-3 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {MONTHS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </span>
              <div className="flex gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-6 rounded-md hover:bg-muted"
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
                  className="size-6 rounded-md hover:bg-muted"
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
              {calendarCells.map((cell, idx) => {
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
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
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
              className="w-full text-xs h-7 border-border/60 bg-background hover:bg-muted"
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
                  <span className="text-[10px] text-muted-foreground">Use default layout 24/7</span>
                </div>
                <button
                  onClick={() => {
                    const nextVal = selectedDevice.schedules_enabled === 0;
                    updateDeviceSchedulesMode.mutate(nextVal);
                  }}
                  disabled={updateDeviceSchedulesMode.isPending}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-primary/40 focus:ring-offset-1 focus:ring-offset-background",
                    selectedDevice.schedules_enabled === 0 ? "bg-amber-600/70 border-amber-500/50" : "bg-muted border-border/40"
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
                <div className="space-y-1.5 pt-2 border-t border-border/40 animate-in fade-in slide-in-from-top-1 duration-150">
                  <Label className="text-[10px] text-muted-foreground font-semibold">Default 24/7 Layout</Label>
                  <select
                    value={selectedDevice.layout_id || ""}
                    onChange={(e) => {
                      const val = e.target.value ? e.target.value : null;
                      updateDeviceDefaultLayout.mutate(val);
                    }}
                    disabled={updateDeviceDefaultLayout.isPending}
                    className="w-full bg-background border border-border rounded-xl h-8 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                  >
                    <option value="" disabled className="bg-background text-muted-foreground">Select default layout...</option>
                    {layouts.map((t) => (
                      <option key={t.id} value={t.id} className="bg-background text-foreground">
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </GlassCard>
          )}

          {selectedDevice && (
            <GlassCard className="p-4 flex flex-col gap-3 mt-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground select-none">
                Duplicate Schedule
              </h2>
              <p className="text-[10px] text-muted-foreground leading-normal">
                Copy all schedule configurations from another screen. Past historical logs will not be affected.
              </p>
              
              <div className="space-y-1.5 pt-1">
                <Label className="text-[10px] text-muted-foreground font-semibold">Copy From Screen</Label>
                <select
                  value={copySourceDeviceId}
                  onChange={(e) => setCopySourceDeviceId(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl h-8 px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary/40"
                >
                  <option value="" className="bg-background text-muted-foreground">Select screen...</option>
                  {devices
                    .filter((d) => d.id !== selectedDeviceId)
                    .map((d) => (
                      <option key={d.id} value={d.id} className="bg-background text-foreground">
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 rounded-xl"
                disabled={!copySourceDeviceId || copyDeviceMut.isPending}
                onClick={() => {
                  copyDeviceMut.mutate({ sourceDeviceId: copySourceDeviceId, overwrite: false });
                }}
              >
                {copyDeviceMut.isPending ? "Copying..." : "Copy Schedule"}
              </Button>
            </GlassCard>
          )}
        </div>

        {/* ======================================================== */}
        {/* MAIN AREA: Google Calendar Week View Scheduler            */}
        {/* ======================================================== */}
        <div className="flex flex-col gap-4" ref={weekGridRef}>
          {/* Week Selector bar */}
          <div className="flex items-center justify-between bg-card/40 border border-border/50 rounded-2xl px-4 py-2.5 shadow-sm">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full border border-border/80 hover:bg-muted"
                onClick={handlePrevWeek}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 rounded-full border border-border/80 hover:bg-muted"
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
            {selectedDates.length > 0 ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
                <span className="text-xs font-semibold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                  {selectedDates.length} Day{selectedDates.length > 1 ? "s" : ""} Selected
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-[10px] px-2.5 rounded-full font-semibold shadow-md flex items-center gap-1 animate-pulse"
                  onClick={() => setBulkDeleteConfirmOpen(true)}
                  disabled={deleteSelectedDays.isPending}
                >
                  <Trash2 className="size-3" /> Clear Days
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2.5 rounded-full border border-border/40 hover:bg-muted"
                  onClick={() => {
                    setSelectedDates([]);
                    setSelectionAnchorDate(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info className="size-3.5" /> Drag layouts here
              </span>
            )}
          </div>

          {/* Week Calendar Board */}
          <GlassCard className="p-0 overflow-hidden flex flex-col select-none border-border">
            {/* Headers row */}
            <div className="grid grid-cols-[60px_1fr] border-b border-border/60 bg-muted/20 pr-[5px]">
              <div className="h-14 border-r border-border/60" />
              <div className="grid grid-cols-7 h-14 divide-x divide-border/60">
                {weekDates.map((date, idx) => {
                  const dateIso = toISO(date);
                  const isSelected = selectedDate === dateIso;
                  const isCurrent = dateIso === toISO(new Date());
                  const isPast = parseISODate(dateIso).getTime() < parseISODate(toISO(new Date())).getTime();
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
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        if (!schedulesEnabled) return;
                        if (selectedDates.includes(dateIso)) {
                          setSelectedDates(prev => prev.filter(d => d !== dateIso));
                          if (selectionAnchorDate === dateIso) setSelectionAnchorDate(null);
                        } else {
                          setSelectedDates([dateIso]);
                          setSelectionAnchorDate(dateIso);
                          toast.info("Column selected. Hold Shift + Left/Right arrow keys to expand selection.", { duration: 4000 });
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center text-center py-1 transition-colors",
                        !schedulesEnabled
                          ? "opacity-40 cursor-not-allowed pointer-events-none"
                          : "cursor-pointer hover:bg-muted",
                        isSelected && "bg-emerald-500/5",
                        isCurrent && "bg-primary/5",
                        selectedDates.includes(dateIso) && "bg-rose-500/15 border-x border-rose-500/40"
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          isSelected
                            ? "text-emerald-400"
                            : isPast
                              ? "text-rose-400/90"
                              : "text-muted-foreground"
                        )}
                      >
                        {WEEKDAYS[idx]}
                      </span>
                      <span
                        className={cn(
                          "text-xs font-bold leading-none mt-0.5 flex items-center justify-center size-6 rounded-full transition-all",
                          isSelected
                            ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                            : isCurrent
                              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                              : isPast
                                ? "bg-rose-500/10 border border-rose-500/20 text-rose-400"
                                : "text-foreground"
                        )}
                      >
                        {formattedDay}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scrollable Timeline */}
            <div
              className="grid grid-cols-[60px_1fr] relative overflow-y-scroll max-h-[620px] custom-scrollbar"
            >
              {/* Hour scale vertical labels */}
              <div className="flex flex-col text-[10px] text-muted-foreground bg-muted/10">
                {Array.from({ length: HOURS }).map((_, h) => (
                  <div
                    key={h}
                    style={{ height: PX_PER_HOUR }}
                    className="border-r border-b border-border/40 pr-2 pt-1 text-right select-none"
                  >
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>

              {/* Day Columns containing blocks */}
              <div className="grid grid-cols-7 relative divide-x divide-border/60 min-h-[1440px] bg-background">
                {!schedulesEnabled && (
                  <div
                    onClick={() => {
                      toast.info(`Device is running default layout: ${selectedDevice?.layout_id ? layouts.find(t => t.id === selectedDevice.layout_id)?.name || 'Layout' : 'None'}. Turn on "Enable Scheduling" in the sidebar to configure.`);
                    }}
                    className="absolute inset-0 bg-background/85 backdrop-blur-[1px] z-[60] flex flex-col items-center justify-center text-center p-4 select-none cursor-pointer"
                  >
                    <SlidersHorizontal className="size-8 text-amber-500/80 mb-2 animate-pulse" />
                    <h4 className="text-sm font-semibold text-foreground">Schedules Disabled</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                      This device is configured to display its default layout 24/7. Turn on "Enable Scheduling" in the sidebar to configure the timeline.
                    </p>
                  </div>
                )}
                {/* Horizontal row line guide overlays */}
                {Array.from({ length: HOURS }).map((_, h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-b border-border/30 pointer-events-none"
                    style={{ top: (h + 1) * PX_PER_HOUR - 1, height: 1 }}
                  />
                ))}

                {/* Day Columns */}
                {weekDates.map((date, idx) => {
                  const dateIso = toISO(date);
                  const isCurrent = dateIso === toISO(new Date());

                  // Get active schedule instances running on this date
                  const dayInstances = instances.filter((i) => i.date === dateIso);

                  // Calculate Time Indicator Line
                  const timeMins = nowTime.getHours() * 60 + nowTime.getMinutes();
                  const indicatorTop = timeMins * PX_PER_MIN;

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "day-column relative h-full select-none cursor-copy transition-colors duration-200 hover:bg-muted/30",
                        isCurrent && "bg-primary/[0.01]",
                        selectedDates.includes(dateIso) && "bg-rose-500/[0.02] border-x border-rose-500/[0.08]"
                      )}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => handleGridDrop(e, dateIso)}
                    >
                      {/* Day Column Area */}

                      {/* Render dropped/saved instances */}
                      {dayInstances.map((inst) => {
                        const isDraggingThis = dragState.blockId === inst.schedule_id;

                        // Calculate visual parameters
                        const startMins = isDraggingThis ? dragState.currentStartMins : parseHHMM(inst.start_time);
                        const endMins = isDraggingThis ? dragState.currentEndMins : parseHHMM(inst.end_time);

                        // Position mapping (1px = 1 min)
                        const top = startMins * PX_PER_MIN;
                        const height = (endMins - startMins) * PX_PER_MIN;
                        const color = layoutColor.get(inst.layout_id) || "oklch(0.76 0.17 210)";

                        const todayStr = toISO(new Date());
                        const isPastDay = dateIso < todayStr;

                        const isTargetDate = isDraggingThis && dragState.currentDate === dateIso;
                        const shouldDisplay = !isDraggingThis || isTargetDate;

                        if (!shouldDisplay) return null;

                        return (
                          <div
                            key={inst.id}
                            draggable="false"
                            onDoubleClick={() => !isPastDay && handleBlockClick(inst.schedule_id)}
                            className={cn(
                              "absolute left-1 right-1 rounded-xl p-2 text-[10px] overflow-hidden group shadow-md transition-shadow hover:shadow-lg border-l-4",
                              isPastDay 
                                ? "opacity-50 blur-[0.5px] cursor-not-allowed pointer-events-none" 
                                : "cursor-pointer",
                              isDraggingThis && "opacity-90 shadow-2xl scale-[0.98] ring-1 ring-primary/40"
                            )}
                            style={{
                              top,
                              height,
                              background: `color-mix(in oklch, ${color} 12%, hsl(var(--card)))`,
                              color: `color-mix(in oklch, ${color} 80%, hsl(var(--foreground)))`,
                              borderColor: color,
                            }}
                          >
                            {/* Resize Handle Top */}
                            {!isPastDay && (
                              <div
                                className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                onMouseDown={(e) => handleBlockMouseDown(e, inst, "resize-top")}
                              />
                            )}

                            {/* Block Content */}
                            <div className="flex flex-col h-full pointer-events-none select-none relative">
                              <div className="font-semibold text-current truncate flex items-center gap-1">
                                <span className="size-1.5 rounded-full shrink-0" style={{ background: color }} />
                                {inst.layout_name}
                              </div>
                              <div className="opacity-80 text-[9px] mt-0.5 font-medium">
                                {formatMinsAMPM(startMins)} - {formatMinsAMPM(endMins)}
                              </div>
                              {isPastDay ? (
                                <div className="mt-auto mr-auto text-[8px] bg-foreground/10 text-current px-1 py-0.5 rounded border border-border/20 font-semibold tracking-wide uppercase">
                                  Completed
                                </div>
                              ) : (
                                /* Drag handle decorator icon */
                                <div className="mt-auto ml-auto opacity-0 group-hover:opacity-60 transition-opacity">
                                  <Move className="size-3 text-current opacity-70" />
                                </div>
                              )}
                            </div>

                            {/* Resize Handle Bottom */}
                            {!isPastDay && (
                              <div
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize z-10"
                                onMouseDown={(e) => handleBlockMouseDown(e, inst, "resize-bottom")}
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
        </div>

        {/* ======================================================== */}
        {/* RIGHT SIDEBAR: Draggable layouts list                  */}
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
                className="pl-8 bg-background border-border text-xs h-8 focus:ring-1 focus:ring-primary/45"
              />
            </div>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredLayouts.map((t: any) => {
                const color = layoutColor.get(t.id) || "oklch(0.76 0.17 210)";
                return (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="p-3 rounded-xl border border-border/60 bg-muted/20 hover:bg-muted/60 active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing flex flex-col gap-1.5 shadow-sm group select-none"
                    style={{ borderLeftWidth: 3, borderLeftColor: color }}
                  >
                    <div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                      {t.name}
                    </div>
                  </div>
                );
              })}
              {filteredLayouts.length === 0 && (
                <div className="text-xs text-muted-foreground italic text-center py-2">
                  No active layouts
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ======================================================== */}
      {/* DIALOG: Edit repeat configuration / delete schedule       */}
      {/* ======================================================== */}
      <Dialog open={editPopupOpen} onOpenChange={setEditPopupOpen}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Configure Recurrence</DialogTitle>
            <DialogDescription>
              Modify the start time, end time, layout, or repeat rules for this schedule window.
            </DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4 pt-2">
              {/* Selected Window Summary */}
              <div className="bg-muted/40 border border-border/50 rounded-xl p-3 flex flex-col gap-1">
                <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: layoutColor.get(selectedSchedule.layout_id) }}
                  />
                  {selectedSchedule.layout_name}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Clock className="size-3.5" />
                    {selectedSchedule.start_time} - {selectedSchedule.end_time}
                  </span>
                  <span>·</span>
                  <span>Starts {selectedSchedule.start_date}</span>
                </div>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold">Start Time</Label>
                  <Input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="bg-background border-border text-xs h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-semibold">End Time</Label>
                  <Input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="bg-background border-border text-xs h-9"
                  />
                </div>
              </div>

              {/* Recurrence Mode Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat Pattern</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["none", "No Repeat"],
                      ["daily", "Daily"],
                      ["custom", "Every X Days"],
                    ] as Array<[RepeatMode, string]>
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setEditRepeatMode(k)}
                      className={cn(
                        "py-2 rounded-xl text-xs border font-medium transition-all",
                        editRepeatMode === k
                          ? "bg-primary/20 border-primary/40 text-foreground"
                          : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
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
                      className="w-20 bg-background border-border h-8 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
              )}

              {/* Occurrences / Days count limit */}
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
                            ? "bg-muted border-border text-foreground"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        className="w-16 bg-background border-border h-8 text-center text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Range Summary */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2 mt-2">
                <Info className="size-4 text-primary shrink-0" />
                <span>{getRecurrenceRangeText()}</span>
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-border/40 space-y-4">
            {/* Save Actions Row */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                className="border-border text-xs h-9 px-4"
                onClick={() => setEditPopupOpen(false)}
              >
                Cancel
              </Button>

              {selectedSchedule && selectedSchedule.repeat_mode !== "none" ? (
                <>
                  <Button
                    className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white px-4"
                    onClick={() => {
                      updateOccurrenceMut.mutate({
                        id: selectedSchedule.id,
                        date: selectedDate,
                        start_time: editStartTime,
                        end_time: editEndTime,
                        layout_id: selectedSchedule.layout_id,
                      });
                    }}
                    disabled={updateOccurrenceMut.isPending}
                  >
                    Save This Day
                  </Button>
                  <Button
                    className="text-xs h-9 bg-primary hover:bg-primary/95 px-4"
                    onClick={() => {
                      repeatMut.mutate({
                        schedule_id: selectedSchedule.id,
                        repeat_mode: editRepeatMode,
                        repeat_interval: editRepeatMode === "custom" ? editRepeatInterval : 1,
                        days_count: editRepeatMode === "none" ? 1 : editDaysCount,
                        start_time: editStartTime,
                        end_time: editEndTime,
                      });
                    }}
                    disabled={repeatMut.isPending}
                  >
                    Save Entire Series
                  </Button>
                </>
              ) : (
                <Button
                  className="text-xs h-9 bg-primary hover:bg-primary/95 px-4"
                  onClick={() => {
                    repeatMut.mutate({
                      schedule_id: selectedSchedule!.id,
                      repeat_mode: editRepeatMode,
                      repeat_interval: editRepeatMode === "custom" ? editRepeatInterval : 1,
                      days_count: editRepeatMode === "none" ? 1 : editDaysCount,
                      start_time: editStartTime,
                      end_time: editEndTime,
                    });
                  }}
                  disabled={repeatMut.isPending}
                >
                  Save Changes
                </Button>
              )}
            </div>

            {/* Danger Zone Separator & Delete Row */}
            {selectedSchedule && (
              <div className="pt-3.5 border-t border-dashed border-border/60 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold select-none">
                  Danger Zone
                </span>
                <div className="flex gap-2">
                  {selectedSchedule.repeat_mode !== "none" ? (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 hover:bg-rose-500/20 h-8 px-3"
                        onClick={() => deleteMut.mutate({ id: selectedSchedule.id, date: selectedDate })}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="size-3.5 mr-1" /> Delete Day
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="text-[10px] bg-rose-500/20 border border-rose-500/30 text-rose-600 hover:bg-rose-500/30 font-semibold h-8 px-3"
                        onClick={() => deleteMut.mutate({ id: selectedSchedule.id })}
                        disabled={deleteMut.isPending}
                      >
                        <Trash2 className="size-3.5 mr-1" /> Delete Series
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="text-[10px] bg-rose-500/10 border border-rose-500/20 text-rose-600 hover:bg-rose-500/20 h-8 px-3.5"
                      onClick={() => deleteMut.mutate({ id: selectedSchedule.id })}
                      disabled={deleteMut.isPending}
                    >
                      <Trash2 className="size-3.5 mr-1" /> Delete Schedule
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Bulk Repeat Day Schedules                         */}
      {/* ======================================================== */}
      <Dialog open={bulkRepeatOpen} onOpenChange={setBulkRepeatOpen}>
        <DialogContent className="max-w-xl bg-card border-border">
          <DialogHeader>
            <DialogTitle>Repeat Day Schedule</DialogTitle>
            <DialogDescription>
              Configure the recurrence rule to copy all layouts scheduled on this date to other days.
            </DialogDescription>
          </DialogHeader>

          {bulkRepeatDate && (
            <div className="space-y-4 pt-2">
              {/* Day Schedules List */}
              <div className="bg-muted/40 border border-border/50 rounded-xl p-3 space-y-2">
                <div className="text-xs text-muted-foreground font-semibold">
                  Scheduled Layouts on {parseISODate(bulkRepeatDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}:
                </div>
                
                {(() => {
                  const dayInstanceSchedules = instances.filter(i => i.date === bulkRepeatDate);
                  const dayScheduleIds = Array.from(new Set(dayInstanceSchedules.map(i => i.schedule_id)));
                  const targetSchedules = schedules.filter(s => dayScheduleIds.includes(s.id));

                  if (targetSchedules.length === 0) {
                    return (
                      <div className="text-xs text-muted-foreground italic">
                        No layouts scheduled on this day. Add layouts to the calendar grid first.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                      {targetSchedules.map((s) => {
                        const color = layoutColor.get(s.layout_id) || "oklch(0.76 0.17 210)";
                        return (
                          <div key={s.id} className="flex items-center justify-between text-xs">
                            <div className="font-medium text-foreground flex items-center gap-1.5">
                              <span className="size-1.5 rounded-full" style={{ background: color }} />
                              {s.layout_name}
                            </div>
                            <div className="text-muted-foreground font-mono">
                              {s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Recurrence Mode Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Repeat Pattern</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["none", "No Repeat"],
                      ["daily", "Daily"],
                      ["custom", "Every X Days"],
                    ] as Array<[RepeatMode, string]>
                  ).map(([k, l]) => (
                    <button
                      key={k}
                      onClick={() => setBulkRepeatMode(k)}
                      className={cn(
                        "py-2 rounded-xl text-xs border font-medium transition-all",
                        bulkRepeatMode === k
                          ? "bg-primary/20 border-primary/40 text-foreground"
                          : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
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
                      className="w-20 bg-background border-border h-8 text-center text-xs"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
              )}

              {/* Occurrences / Days count limit */}
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
                            ? "bg-muted border-border text-foreground"
                            : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-muted"
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
                        className="w-16 bg-background border-border h-8 text-center text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Range Summary */}
              <div className="bg-primary/5 border border-primary/10 rounded-xl p-3 text-xs text-muted-foreground flex items-center gap-2 mt-2">
                <Info className="size-4 text-primary shrink-0" />
                <span>{getBulkRecurrenceRangeText()}</span>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2 justify-between">
            {bulkRepeatDate && instances.some((i) => i.date === bulkRepeatDate) && (
              <Button
                variant="destructive"
                className="bg-rose-500/10 border border-rose-500/20 text-rose-600 hover:bg-rose-500/20 w-full sm:w-auto sm:mr-auto text-xs h-9"
                onClick={() => {
                  if (confirm("Are you sure you want to clear all layouts scheduled on this day?")) {
                    clearDayMut.mutate();
                  }
                }}
                disabled={clearDayMut.isPending}
              >
                <Trash2 className="size-3.5 mr-1" /> Delete for This Day
              </Button>
            )}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
              <Button
                variant="outline"
                className="border-border w-full sm:w-auto text-xs h-9"
                onClick={() => setBulkRepeatOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="w-full sm:w-auto text-xs h-9"
                onClick={() => {
                  if (!bulkRepeatDate) return;
                  const dayInstanceSchedules = instances.filter((i) => i.date === bulkRepeatDate);
                  if (dayInstanceSchedules.length === 0) {
                    toast.error("No schedules to repeat on this day");
                    return;
                  }

                  // Generate target dates list
                  const targetDates: string[] = [];
                  const baseDate = parseISODate(bulkRepeatDate);
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

                  bulkRepeatMut.mutate({
                    source_date: bulkRepeatDate,
                    target_dates: targetDates,
                    overwrite: false,
                  });
                }}
                disabled={bulkRepeatMut.isPending}
              >
                <Repeat className="size-3.5 mr-1.5" /> Save Day Recurrence
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Save Recurring Change Options                     */}
      {/* ======================================================== */}
      <Dialog open={pendingUpdate !== null} onOpenChange={(open) => !open && setPendingUpdate(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Save Recurring Change</DialogTitle>
            <DialogDescription>
              This is a recurring schedule window. How would you like to apply this edit?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => {
                if (pendingUpdate) {
                  updateOccurrenceMut.mutate(pendingUpdate);
                }
              }}
              disabled={updateOccurrenceMut.isPending}
              className="w-full text-xs font-semibold"
            >
              Update Only This Day
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (pendingUpdate) {
                  if (selectedSchedule && selectedSchedule.id === pendingUpdate.id) {
                    repeatMut.mutate({
                      schedule_id: pendingUpdate.id,
                      repeat_mode: editRepeatMode,
                      repeat_interval: editRepeatMode === "custom" ? editRepeatInterval : 1,
                      days_count: editRepeatMode === "none" ? 1 : editDaysCount,
                      start_time: pendingUpdate.start_time,
                      end_time: pendingUpdate.end_time,
                    });
                  } else {
                    updateMut.mutate({
                      id: pendingUpdate.id,
                      body: {
                        start_date: pendingUpdate.date,
                        start_time: pendingUpdate.start_time,
                        end_time: pendingUpdate.end_time,
                      },
                    });
                    setPendingUpdate(null);
                  }
                }
              }}
              disabled={updateMut.isPending || repeatMut.isPending}
              className="w-full text-xs border-border"
            >
              Update Entire Series
            </Button>
            <Button
              variant="ghost"
              onClick={() => setPendingUpdate(null)}
              className="w-full text-xs text-muted-foreground"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Confirm Overwrite for Bulk Replication            */}
      {/* ======================================================== */}
      <Dialog open={bulkOverwriteDates !== null} onOpenChange={(open) => !open && setBulkOverwriteDates(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Overwrite Existing Schedules?</DialogTitle>
            <DialogDescription>
              Schedules already exist on some of the target dates. Do you want to overwrite them?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (bulkRepeatDate) {
                  const targetDates: string[] = [];
                  const baseDate = parseISODate(bulkRepeatDate);
                  const occurrences = bulkRepeatMode === "none" ? 1 : bulkRepeatDaysCount;
                  const interval = bulkRepeatMode === "custom" ? bulkRepeatInterval : 1;

                  for (let i = 1; i < occurrences; i++) {
                    const nextD = new Date(baseDate.getTime());
                    nextD.setDate(baseDate.getDate() + i * interval);
                    targetDates.push(toISO(nextD));
                  }

                  bulkRepeatMut.mutate({
                    source_date: bulkRepeatDate,
                    target_dates: targetDates,
                    overwrite: true,
                  });
                }
              }}
              disabled={bulkRepeatMut.isPending}
              className="w-full text-xs font-semibold"
            >
              Yes, Overwrite Them
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkOverwriteDates(null)}
              className="w-full text-xs border-border"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Confirm Overwrite for Recurrence Edit             */}
      {/* ======================================================== */}
      <Dialog open={repeatOverwritePayload !== null} onOpenChange={(open) => !open && setRepeatOverwritePayload(null)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Overwrite Existing Schedules?</DialogTitle>
            <DialogDescription>
              This recurrence pattern overlaps with existing schedules on future dates. Do you want to overwrite those overlapping windows?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (repeatOverwritePayload) {
                  repeatMut.mutate({
                    ...repeatOverwritePayload,
                    overwrite: true,
                  });
                }
              }}
              disabled={repeatMut.isPending}
              className="w-full text-xs font-semibold"
            >
              Yes, Overwrite Conflicts
            </Button>
            <Button
              variant="outline"
              onClick={() => setRepeatOverwritePayload(null)}
              className="w-full text-xs border-border"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Overwrite Alert for Device Copy                 */}
      {/* ======================================================== */}
      <Dialog open={copyOverlapOpen} onOpenChange={(open) => !open && setCopyOverlapOpen(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Overwrite Existing Schedules?</DialogTitle>
            <DialogDescription>
              This screen already has active schedules assigned to it in the future. Copying schedule configurations will permanently delete and overwrite them. Past historical records will remain untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                copyDeviceMut.mutate({ sourceDeviceId: copySourceDeviceId, overwrite: true });
              }}
              disabled={copyDeviceMut.isPending}
              className="w-full text-xs font-semibold"
            >
              {copyDeviceMut.isPending ? "Overwriting..." : "Yes, Overwrite & Copy"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCopyOverlapOpen(false)}
              className="w-full text-xs border-border"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* DIALOG: Bulk Delete Selected Days Confirm Dialog        */}
      {/* ======================================================== */}
      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !open && setBulkDeleteConfirmOpen(false)}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Clear Schedules for Selected Days?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete and clear all schedule windows for the selected **{selectedDates.length} days**? 
              This action only clears future schedules; past historical logs remain untouched.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="destructive"
              onClick={() => {
                deleteSelectedDays.mutate();
              }}
              disabled={deleteSelectedDays.isPending}
              className="w-full text-xs font-semibold"
            >
              {deleteSelectedDays.isPending ? "Clearing..." : "Yes, Clear Schedules"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteConfirmOpen(false)}
              className="w-full text-xs border-border"
            >
              No, Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function GlassCard({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card/45 backdrop-blur-md border rounded-2xl shadow-sm p-4", className)} {...props}>
      {children}
    </div>
  );
}

function PageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-1 mb-6">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
