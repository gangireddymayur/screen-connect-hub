import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Building2,
  Monitor,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Mail,
  Calendar,
  Shield,
  KeyRound,
  Search,
  Download,
  MoreHorizontal,
  Copy,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Power,
  PowerOff,
  CheckCircle2,
  Circle,
  FileText,
  Activity,
  Server,
  Image as ImageIcon,
  Layout,
  Clock,
  ShieldCheck,
  AlertTriangle,
  Key,
  LayoutGrid,
  List,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Company {
  id: string;
  name: string;
  contact_email: string;
  plan: string;
  max_screens: number;
  status: string;
  notes: string | null;
  created_at: string;
  subscription_status?: string;
  trial_ends_at?: string | null;
  local_mode?: string;
  max_devices?: number;
}

interface CompanyStats {
  devices_total: number;
  devices_paired: number;
  content_total: number;
  layouts_total: number;
  schedules_total: number;
  schedules_active: number;
  last_device_activity: string | null;
  admin_last_sign_in: string | null;
  admin_email: string | null;
  admin_id: string | null;
}

type SortKey = "name" | "created_at" | "max_screens";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 12;

export const getTrialInfo = (company: Company) => {
  if (!company) return { isExpired: false, text: "Active", variant: "default", trialEndsAt: null, isTrial: false };

  const parseDate = (dateStr: string) => {
    if (!dateStr || dateStr === "null") return null;
    const formatted = dateStr.includes("T") ? dateStr : dateStr.replace(" ", "T");
    const d = new Date(formatted);
    return isNaN(d.getTime()) ? null : d;
  };

  const trialEnd = parseDate(company.trial_ends_at || "");
  const createdAt = parseDate(company.created_at);

  if (company.subscription_status === "active") {
    if (trialEnd) {
      const isPast = Date.now() > trialEnd.getTime();
      return {
        isExpired: isPast,
        text: isPast ? "Access Expired" : `Full Access until ${trialEnd.toLocaleDateString()}`,
        variant: isPast ? "destructive" : "default",
        trialEndsAt: trialEnd.toISOString(),
        isTrial: false,
      };
    }
    return {
      isExpired: false,
      text: "Active (Lifetime)",
      variant: "default",
      trialEndsAt: null,
      isTrial: false,
    };
  }

  if (company.subscription_status === "expired") {
    return {
      isExpired: true,
      text: "Access Expired",
      variant: "destructive",
      trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
      isTrial: false,
    };
  }

  const calculatedEnd =
    trialEnd ||
    (createdAt
      ? new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
  const diff = calculatedEnd.getTime() - Date.now();
  const days = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  const isExpired = diff <= 0;

  return {
    isExpired,
    text: isExpired ? "Trial Expired" : `Trial expires: ${calculatedEnd.toLocaleDateString()}`,
    variant: isExpired ? "destructive" : "warning",
    trialEndsAt: calculatedEnd.toISOString(),
    daysLeft: days,
    isTrial: true,
  };
};

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Search & filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [maxScreens, setMaxScreens] = useState("10");
  const [localMode, setLocalMode] = useState("none");
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMaxScreens, setEditMaxScreens] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLocalMode, setEditLocalMode] = useState("none");
  const [editSubscriptionStatus, setEditSubscriptionStatus] = useState("trial");
  const [editTrialEndsAt, setEditTrialEndsAt] = useState<string | null>(null);

  // Manage Access Dialog
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessCompany, setAccessCompany] = useState<Company | null>(null);
  const [accessSubmitting, setAccessSubmitting] = useState(false);

  // Generate Code Dialog
  const [codeOpen, setCodeOpen] = useState(false);
  const [generatedCodeData, setGeneratedCodeData] = useState<{
    code: string;
    expiresAt: number;
    companyName: string;
  } | null>(null);

  // Detail sheet
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Bulk delete
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Reset password
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCompany, setPwdCompany] = useState<Company | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  // Countdown timer ticker
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchCompanies = async () => {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Failed to load companies");
    else setCompanies(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Fetch stats when detail sheet opens
  useEffect(() => {
    if (!selectedCompany) {
      setStats(null);
      return;
    }
    setStatsLoading(true);
    supabase.functions
      .invoke("get-company-stats", { body: { company_id: selectedCompany.id } })
      .then(({ data, error }) => {
        if (error || data?.error) toast.error(data?.error || "Failed to load company stats");
        else setStats(data as CompanyStats);
        setStatsLoading(false);
      });
  }, [selectedCompany]);

  // Filtered + sorted view
  const filtered = useMemo(() => {
    let list = companies;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.contact_email.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      if (statusFilter === "trial") {
        list = list.filter((c) => (c.subscription_status || "trial") === "trial");
      } else if (statusFilter === "active_paid") {
        list = list.filter((c) => c.subscription_status === "active");
      } else if (statusFilter === "expired") {
        list = list.filter((c) => getTrialInfo(c).isExpired);
      } else {
        list = list.filter((c) => c.status === statusFilter);
      }
    }
    list = [...list].sort((a, b) => {
      let av: any = a[sortKey];
      let bv: any = b[sortKey];
      if (sortKey === "created_at") {
        av = new Date(av).getTime();
        bv = new Date(bv).getTime();
      }
      if (sortKey === "name") {
        av = (av || "").toLowerCase();
        bv = (bv || "").toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [companies, search, statusFilter, sortKey, sortDir]);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const totalCompanies = companies.length;
  const activeCount = companies.filter((c) => c.status === "active").length;
  const suspendedCount = companies.filter((c) => c.status === "suspended").length;
  const totalScreensAllocated = companies.reduce(
    (sum, c) => sum + (c.max_screens || 0),
    0
  );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };
  const toggleSelectAllPage = () => {
    const allOnPage = paged.every((c) => selected.has(c.id));
    const next = new Set(selected);
    if (allOnPage) paged.forEach((c) => next.delete(c.id));
    else paged.forEach((c) => next.add(c.id));
    setSelected(next);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-company", {
      body: {
        name,
        contact_email: contactEmail,
        password,
        plan: "starter",
        max_screens: localMode === "single" ? 1 : parseInt(maxScreens),
        local_mode: localMode,
        max_devices: localMode === "single" ? 1 : parseInt(maxScreens),
      },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create company");
    } else {
      toast.success("Sub Admin / Company created!");
      setAddOpen(false);
      setName("");
      setContactEmail("");
      setPassword("");
      setMaxScreens("10");
      setLocalMode("none");
      fetchCompanies();
    }
  };

  const openEdit = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditCompany(company);
    setEditName(company.name);
    setEditEmail(company.contact_email);
    setEditMaxScreens(String(company.max_screens));
    setEditStatus(company.status);
    setEditNotes(company.notes ?? "");
    setEditLocalMode(company.local_mode || "none");
    setEditSubscriptionStatus(company.subscription_status || "trial");
    setEditTrialEndsAt(company.trial_ends_at || null);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany) return;
    setSubmitting(true);
    const { error } = await supabase
      .from("companies")
      .update({
        name: editName,
        contact_email: editEmail,
        max_screens: editLocalMode === "single" ? 1 : parseInt(editMaxScreens),
        status: editStatus,
        notes: editNotes.trim() || null,
        local_mode: editLocalMode,
        max_devices: editLocalMode === "single" ? 1 : parseInt(editMaxScreens),
        subscription_status: editSubscriptionStatus,
        trial_ends_at: editTrialEndsAt ? new Date(editTrialEndsAt).toISOString() : null,
      })
      .eq("id", editCompany.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Company updated!");
      setEditOpen(false);
      fetchCompanies();
    }
  };

  const openAccessModal = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setAccessCompany(company);
    setEditSubscriptionStatus(company.subscription_status || "trial");
    setEditTrialEndsAt(company.trial_ends_at || null);
    setAccessOpen(true);
  };

  const handleAccessSubmit = async (
    status: "active" | "trial" | "expired",
    durationDays?: number | "lifetime"
  ) => {
    if (!accessCompany) return;
    setAccessSubmitting(true);

    let calculatedEndsAt: string | null = null;
    if (durationDays === "lifetime") {
      calculatedEndsAt = null;
    } else if (typeof durationDays === "number") {
      const d = new Date();
      d.setDate(d.getDate() + durationDays);
      calculatedEndsAt = d.toISOString();
    } else if (editTrialEndsAt) {
      calculatedEndsAt = new Date(editTrialEndsAt).toISOString();
    }

    const { error } = await supabase
      .from("companies")
      .update({
        subscription_status: status,
        trial_ends_at: calculatedEndsAt,
      })
      .eq("id", accessCompany.id);

    setAccessSubmitting(false);
    if (error) {
      toast.error(error.message || "Failed to update access status");
    } else {
      toast.success(
        status === "expired"
          ? "Access expired / revoked"
          : "License & Access updated successfully!"
      );
      setAccessOpen(false);
      fetchCompanies();
    }
  };

  const handleGenerateCode = async (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const toastId = toast.loading("Generating login verification code...");
    try {
      const targetId = (company as any).admin_id || company.id;
      const token = localStorage.getItem("sh_token") || localStorage.getItem("auth_token");
      const res = await fetch(`/api/auth/users/${targetId}/generate-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ companyId: company.id, email: company.contact_email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate code");
      }
      setGeneratedCodeData({
        code: data.code,
        expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 10 * 60 * 1000,
        companyName: company.name,
      });
      setCodeOpen(true);
      toast.success("Verification code generated!", { id: toastId });
    } catch (err: any) {
      toast.error(err.message || "Failed to generate code", { id: toastId });
    }
  };

  const openDelete = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteCompany(company);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCompany) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-company", {
      body: { company_id: deleteCompany.id },
    });
    setDeleting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to delete company");
    } else {
      toast.success("Company deleted");
      setDeleteOpen(false);
      if (selectedCompany?.id === deleteCompany.id) setSelectedCompany(null);
      fetchCompanies();
    }
  };

  const handleBulkAction = async (action: "activate" | "suspend") => {
    const ids = Array.from(selected);
    const newStatus = action === "activate" ? "active" : "suspended";
    const { error } = await supabase
      .from("companies")
      .update({ status: newStatus })
      .in("id", ids);
    if (error) toast.error("Bulk update failed");
    else {
      toast.success(`Updated ${ids.length} companies`);
      setSelected(new Set());
      fetchCompanies();
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    setBulkDeleting(true);
    for (const id of ids) {
      await supabase.functions.invoke("delete-company", { body: { company_id: id } });
    }
    setBulkDeleting(false);
    setBulkDeleteOpen(false);
    setSelected(new Set());
    toast.success(`Deleted ${ids.length} companies`);
    fetchCompanies();
  };

  const openResetPwd = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPwdCompany(company);
    setPwdValue("");
    setPwdOpen(true);
  };

  const handleResetPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCompany || pwdValue.length < 6) return;
    setPwdSubmitting(true);
    const { data, error } = await supabase.functions.invoke("reset-company-password", {
      body: { company_id: pwdCompany.id, new_password: pwdValue },
    });
    setPwdSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to reset password");
    } else {
      toast.success("Password updated successfully!");
      setPwdOpen(false);
    }
  };

  const handleQuickToggle = async (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newStatus = company.status === "active" ? "suspended" : "active";
    const { error } = await supabase
      .from("companies")
      .update({ status: newStatus })
      .eq("id", company.id);
    if (error) toast.error("Update failed");
    else {
      toast.success(`Company ${newStatus === "active" ? "activated" : "suspended"}`);
      fetchCompanies();
    }
  };

  const handleCopyEmail = (email: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Sub Admins & Companies</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage client companies, licenses, screen quotas, and local servers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Switcher */}
            <div className="flex items-center rounded-xl bg-muted/40 p-1 border border-border">
              <Button
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
              >
                <LayoutGrid className="size-4 mr-1.5" /> Grid
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-8 px-2.5 rounded-lg text-xs font-semibold cursor-pointer"
                onClick={() => setViewMode("table")}
                title="Table View"
              >
                <List className="size-4 mr-1.5" /> Table
              </Button>
            </div>

            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-lg shadow-primary/20 cursor-pointer">
                  <Plus className="h-4 w-4" /> Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Company / Sub Admin</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      placeholder="Acme Corp"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Email</Label>
                    <Input
                      type="email"
                      placeholder="admin@acme.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Initial Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Max Screens</Label>
                    <Input
                      type="number"
                      value={localMode === "single" ? "1" : maxScreens}
                      onChange={(e) => setMaxScreens(e.target.value)}
                      min="1"
                      disabled={localMode === "single"}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deployment Mode</Label>
                    <Select value={localMode} onValueChange={setLocalMode}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Cloud Mode (Standard)</SelectItem>
                        <SelectItem value="single">Local Single-Device (Solo)</SelectItem>
                        <SelectItem value="multi">Local Multi-Screen (Cluster)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full" disabled={submitting}>
                    {submitting ? "Creating..." : "Create Company & Admin"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Companies" value={totalCompanies} icon={Building2} />
          <StatCard title="Active Accounts" value={activeCount} icon={CheckCircle2} />
          <StatCard title="Suspended" value={suspendedCount} icon={PowerOff} />
          <StatCard title="Total Screens Quota" value={totalScreensAllocated} icon={Monitor} />
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active Status</SelectItem>
              <SelectItem value="trial">Free Trial</SelectItem>
              <SelectItem value="active_paid">Full Access (Paid)</SelectItem>
              <SelectItem value="expired">Expired / Locked</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/40 animate-in fade-in">
            <p className="text-sm font-medium">{selected.size} selected</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("activate")}
              >
                <Power className="h-3.5 w-3.5 mr-1.5" /> Activate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("suspend")}
              >
                <PowerOff className="h-3.5 w-3.5 mr-1.5" /> Suspend
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Content View */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed p-12 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">
              {companies.length === 0
                ? "No companies yet. Add your first sub-admin company."
                : "No companies match your search and filter criteria."}
            </p>
          </Card>
        ) : viewMode === "grid" ? (
          /* Grid Cards View - Matching ReviewOS admins.tsx */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((company) => {
              const trial = getTrialInfo(company);
              return (
                <Card
                  key={company.id}
                  className="p-5 border border-border/70 hover:border-primary/40 bg-card/60 backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between group shadow-sm hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="size-12 rounded-2xl bg-gradient-to-br from-teal-400/30 via-emerald-400/30 to-indigo-500/30 border border-white/10 grid place-items-center font-bold text-foreground text-sm uppercase shrink-0 shadow-inner">
                        {company.name
                          .split(" ")
                          .map((p) => p[0])
                          .slice(0, 2)
                          .join("") || "CO"}
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-base truncate text-foreground">
                          {company.name}
                        </div>
                        <div className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate mt-0.5">
                          <Mail className="size-3" /> {company.contact_email}
                        </div>

                        {/* Live Expiration Header */}
                        <div className="text-[11px] mt-1.5 font-medium">
                          {company.subscription_status === "active" && !trial.isExpired ? (
                            <span className="text-emerald-400 font-semibold">
                              {trial.text}
                            </span>
                          ) : trial.isExpired ? (
                            <span className="text-rose-400 font-semibold">
                              Access Expired
                            </span>
                          ) : (
                            <span className="text-amber-400 font-semibold">
                              {trial.text}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => handleCopyEmail(company.contact_email)}>
                            <Copy className="size-3.5 mr-2" /> Copy Email
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="size-3.5 mr-2" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openResetPwd(company)}>
                            <KeyRound className="size-3.5 mr-2" /> Reset Password
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleQuickToggle(company)}>
                            {company.status === "active" ? (
                              <>
                                <PowerOff className="size-3.5 mr-2" /> Suspend
                              </>
                            ) : (
                              <>
                                <Power className="size-3.5 mr-2" /> Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => openDelete(company)}
                          >
                            <Trash2 className="size-3.5 mr-2" /> Delete Company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-border/50 text-center">
                      <div className="p-2 rounded-xl bg-muted/30">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Screens
                        </div>
                        <div className="font-bold mt-0.5 text-xs text-foreground">
                          {company.max_screens} max
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-muted/30">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Mode
                        </div>
                        <div className="font-bold mt-0.5 text-xs uppercase text-foreground truncate">
                          {company.local_mode === "single"
                            ? "Solo"
                            : company.local_mode === "multi"
                            ? "Multi"
                            : "Cloud"}
                        </div>
                      </div>
                      <div className="p-2 rounded-xl bg-muted/30">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                          Status
                        </div>
                        <div className="font-bold mt-0.5 text-xs capitalize">
                          <span
                            className={cn(
                              company.status === "active"
                                ? "text-emerald-400"
                                : "text-rose-400"
                            )}
                          >
                            {company.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Joined Date */}
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                      <span className="text-[11px] flex items-center gap-1">
                        <Clock className="size-3" /> Joined {formatDate(company.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Action Footer */}
                  <div className="mt-4 pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">
                        Access Level
                      </div>
                      {company.subscription_status === "active" && !trial.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 mt-1">
                          <ShieldCheck className="size-3" /> Full Access
                        </span>
                      ) : trial.isExpired ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 mt-1">
                          <AlertTriangle className="size-3" /> Expired
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 mt-1">
                          <Clock className="size-3" /> {trial.daysLeft ?? 7}d Trial Left
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {company.local_mode && company.local_mode !== "none" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => handleGenerateCode(company, e)}
                          className="h-7 text-[10px] font-bold border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 cursor-pointer px-2"
                        >
                          <Key className="size-3 mr-1" /> Generate Code
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={(e) => openAccessModal(company, e)}
                        className={cn(
                          "h-7 text-[10px] font-bold cursor-pointer px-3",
                          company.subscription_status === "active" && !trial.isExpired
                            ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white"
                        )}
                      >
                        <ShieldCheck className="size-3 mr-1" /> Manage Access
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={
                          paged.length > 0 && paged.every((c) => selected.has(c.id))
                        }
                        onCheckedChange={toggleSelectAllPage}
                      />
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("name")}
                      >
                        Company <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("max_screens")}
                      >
                        Max Screens <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Status & License</TableHead>
                    <TableHead>
                      <button
                        className="flex items-center gap-1 hover:text-foreground"
                        onClick={() => toggleSort("created_at")}
                      >
                        Created <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-32 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((company) => {
                    const trial = getTrialInfo(company);
                    return (
                      <TableRow
                        key={company.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => setSelectedCompany(company)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(company.id)}
                            onCheckedChange={() => toggleSelect(company.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary text-xs">
                              {company.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm">{company.name}</p>
                                {company.notes && (
                                  <FileText className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {company.contact_email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs font-semibold uppercase">
                            {company.local_mode === "single"
                              ? "Solo"
                              : company.local_mode === "multi"
                              ? "Multi"
                              : "Cloud"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">
                            {company.max_screens} screens
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={company.status as any} />
                            <span className="text-[10px] font-semibold text-muted-foreground">
                              {trial.text}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(company.created_at)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => openAccessModal(company, e)}
                              className="h-8 px-2 text-xs"
                            >
                              Access
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCopyEmail(company.contact_email)}>
                                  <Copy className="h-4 w-4 mr-2" /> Copy Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(company)}>
                                  <Pencil className="h-4 w-4 mr-2" /> Edit Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openResetPwd(company)}>
                                  <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleQuickToggle(company)}>
                                  {company.status === "active" ? (
                                    <>
                                      <PowerOff className="h-4 w-4 mr-2" /> Suspend
                                    </>
                                  ) : (
                                    <>
                                      <Power className="h-4 w-4 mr-2" /> Activate
                                    </>
                                  )}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => openDelete(company)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Manage Access Modal - Matching ReviewOS */}
      <Dialog open={accessOpen} onOpenChange={setAccessOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-400" />
              Manage Account Access
            </DialogTitle>
          </DialogHeader>
          {accessCompany && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-muted/40 border border-border/60">
                <div className="font-semibold text-sm">{accessCompany.name}</div>
                <div className="text-xs text-muted-foreground">{accessCompany.contact_email}</div>
                <div className="text-xs font-semibold text-primary mt-1.5">
                  Current: {getTrialInfo(accessCompany).text}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Grant Full Access Duration</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", 30)}
                  >
                    30 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", 90)}
                  >
                    90 Days
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", 180)}
                  >
                    6 Months
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", 365)}
                  >
                    1 Year
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", 1095)}
                  >
                    3 Years
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={accessSubmitting}
                    onClick={() => handleAccessSubmit("active", "lifetime")}
                  >
                    Lifetime
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Custom Expiration Date</Label>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={editTrialEndsAt ? editTrialEndsAt.slice(0, 16) : ""}
                    onChange={(e) =>
                      setEditTrialEndsAt(
                        e.target.value ? new Date(e.target.value).toISOString() : null
                      )
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={accessSubmitting || !editTrialEndsAt}
                    onClick={() => handleAccessSubmit("active")}
                    className="shrink-0 text-xs font-bold"
                  >
                    Apply Date
                  </Button>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/50">
                <Label className="text-xs font-semibold">Reset Free Trial</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold"
                  disabled={accessSubmitting}
                  onClick={() => handleAccessSubmit("trial", 7)}
                >
                  <Clock className="size-3.5 mr-1.5" /> Reset 7-Day Free Trial
                </Button>
              </div>

              <div className="pt-2 border-t border-border/50">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="w-full text-xs font-bold shadow-lg shadow-destructive/20"
                  disabled={accessSubmitting}
                  onClick={() => handleAccessSubmit("expired")}
                >
                  <AlertTriangle className="size-3.5 mr-1.5" /> Stop Access / Expire Now
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Generate Code Modal */}
      <Dialog open={codeOpen} onOpenChange={setCodeOpen}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-center">Local Login Verification Code</DialogTitle>
          </DialogHeader>
          {generatedCodeData && (
            <div className="space-y-4 pt-2">
              <p className="text-xs text-muted-foreground">
                Enter this 4-digit code on the local TV / kiosk server to authenticate{" "}
                <strong>{generatedCodeData.companyName}</strong>.
              </p>

              <div className="p-4 rounded-2xl bg-muted/40 border border-cyan-500/30">
                <div className="text-4xl font-mono font-extrabold tracking-widest text-cyan-400 select-all">
                  {generatedCodeData.code}
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 flex items-center justify-center gap-1 font-medium">
                  <Clock className="size-3" /> Valid for:{" "}
                  <span className="text-foreground font-semibold">
                    {Math.max(
                      0,
                      Math.floor((generatedCodeData.expiresAt - Date.now()) / 1000)
                    )}{" "}
                    seconds
                  </span>
                </div>
              </div>

              <Button
                type="button"
                className="w-full font-bold text-xs"
                onClick={() => {
                  navigator.clipboard.writeText(generatedCodeData.code);
                  toast.success("Code copied to clipboard!");
                }}
              >
                <Copy className="size-3.5 mr-1.5" /> Copy Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company Details</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Max Screens</Label>
              <Input
                type="number"
                value={editLocalMode === "single" ? "1" : editMaxScreens}
                onChange={(e) => setEditMaxScreens(e.target.value)}
                min="1"
                disabled={editLocalMode === "single"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Deployment Mode</Label>
              <Select value={editLocalMode} onValueChange={setEditLocalMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Cloud Mode (Standard)</SelectItem>
                  <SelectItem value="single">Local Single-Device (Solo)</SelectItem>
                  <SelectItem value="multi">Local Multi-Screen (Cluster)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                {["active", "suspended"].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={editStatus === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEditStatus(s)}
                    className="capitalize"
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal Notes</Label>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="VIP client, renewal notes..."
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Company</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteCompany?.name}</strong>? This will
            also delete the company's admin account. This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selected.size} Companies</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{selected.size}</strong> companies and
            their admin accounts? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? "Deleting..." : `Delete ${selected.size}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Admin Password</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleResetPwd} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for <strong>{pwdCompany?.name}</strong> (
              {pwdCompany?.contact_email}).
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={pwdShow ? "text" : "password"}
                  value={pwdValue}
                  onChange={(e) => setPwdValue(e.target.value)}
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setPwdShow(!pwdShow)}
                >
                  {pwdShow ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pwdSubmitting || pwdValue.length < 6}
              >
                {pwdSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Company Detail Sheet */}
      <Sheet
        open={!!selectedCompany}
        onOpenChange={(open) => !open && setSelectedCompany(null)}
      >
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Company Details</SheetTitle>
          </SheetHeader>
          {selectedCompany && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center font-bold text-primary text-base">
                  {selectedCompany.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedCompany.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedCompany.status as any} />
                    <span className="text-xs text-muted-foreground uppercase font-medium">
                      {selectedCompany.local_mode || "Cloud"} Mode
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Contact Email</p>
                    <p className="text-sm font-medium">
                      {selectedCompany.contact_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Created Date</p>
                    <p className="text-sm font-medium">
                      {formatDate(selectedCompany.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">License Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-semibold">
                        {getTrialInfo(selectedCompany).text}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Screen Quota</span>
                  <span className="text-muted-foreground">
                    {stats?.devices_total ?? 0} / {selectedCompany.max_screens}
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    100,
                    ((stats?.devices_total ?? 0) /
                      Math.max(1, selectedCompany.max_screens)) *
                      100
                  )}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1"
                  onClick={() => {
                    openAccessModal(selectedCompany);
                  }}
                >
                  <ShieldCheck className="size-4 mr-2" /> Manage License Access
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    openEdit(selectedCompany);
                  }}
                >
                  <Pencil className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
