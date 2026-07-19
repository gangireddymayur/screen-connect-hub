import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { StatCard } from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Building2, Monitor, Eye, EyeOff, Pencil, Trash2, Mail, Calendar, Shield, KeyRound,
  Search, Download, MoreHorizontal, Copy, ArrowUpDown, ChevronLeft, ChevronRight,
  Power, PowerOff, CheckCircle2, Circle, FileText, Activity, Server, Image as ImageIcon, Layout, Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Company {
  id: string;
  name: string;
  contact_email: string;
  plan: string;
  max_screens: number;
  status: string;
  notes: string | null;
  created_at: string;
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

const PAGE_SIZE = 10;

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [maxDevices, setMaxDevices] = useState("5");
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
  const [editMaxDevices, setEditMaxDevices] = useState("5");

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

  const fetchCompanies = async () => {
    const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (error) toast.error("Failed to load companies");
    else setCompanies(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  // Fetch stats when detail sheet opens
  useEffect(() => {
    if (!selectedCompany) { setStats(null); return; }
    setStatsLoading(true);
    supabase.functions.invoke("get-company-stats", { body: { company_id: selectedCompany.id } })
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
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.contact_email.toLowerCase().includes(q));
    }
    if (statusFilter !== "all") list = list.filter((c) => c.status === statusFilter);
    list = [...list].sort((a, b) => {
      let av: any = a[sortKey]; let bv: any = b[sortKey];
      if (sortKey === "created_at") { av = new Date(av).getTime(); bv = new Date(bv).getTime(); }
      if (sortKey === "name") { av = (av || "").toLowerCase(); bv = (bv || "").toLowerCase(); }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [companies, search, statusFilter, sortKey, sortDir]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const totalCompanies = companies.length;
  const activeCount = companies.filter((c) => c.status === "active").length;
  const suspendedCount = companies.filter((c) => c.status === "suspended").length;
  const totalScreensAllocated = companies.reduce((sum, c) => sum + (c.max_screens || 0), 0);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
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
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-company-admin", {
      body: {
        name,
        contact_email: contactEmail,
        password,
        max_screens: localMode === "single" ? 1 : parseInt(maxScreens),
        local_mode: localMode,
        max_devices: localMode === "multi" ? parseInt(maxDevices) : 1
      },
    });
    if (error || data?.error) {
      setSubmitting(false);
      toast.error(data?.error || error?.message || "Failed to create company");
      return;
    }
    setSubmitting(false);
    toast.success("Company and admin account created!");
    setAddOpen(false);
    setName(""); setContactEmail(""); setPassword(""); setMaxScreens("10");
    setLocalMode("none"); setMaxDevices("5");
    fetchCompanies();
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
    setEditMaxDevices(String(company.max_devices || 5));
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany) return;
    setSubmitting(true);
    const { error } = await supabase.from("companies").update({
      name: editName,
      contact_email: editEmail,
      max_screens: editLocalMode === "single" ? 1 : parseInt(editMaxScreens),
      status: editStatus,
      notes: editNotes.trim() || null,
      local_mode: editLocalMode,
      max_devices: editLocalMode === "single" ? 1 : (editLocalMode === "multi" ? parseInt(editMaxDevices) : 1)
    }).eq("id", editCompany.id);
    setSubmitting(false);
    if (error) toast.error(error.message);
    else { toast.success("Company updated!"); setEditOpen(false); fetchCompanies(); }
  };

  const openDelete = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteCompany(company);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteCompany) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("delete-company", { body: { company_id: deleteCompany.id } });
    setDeleting(false);
    if (error || data?.error) toast.error(data?.error || error?.message || "Failed to delete company");
    else {
      toast.success("Company deleted!");
      setDeleteOpen(false); setDeleteCompany(null);
      if (selectedCompany?.id === deleteCompany.id) setSelectedCompany(null);
      fetchCompanies();
    }
  };

  const openResetPwd = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPwdCompany(company); setPwdValue(""); setPwdShow(false); setPwdOpen(true);
  };

  const handleResetPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCompany) return;
    setPwdSubmitting(true);
    const { data, error } = await supabase.functions.invoke("reset-company-admin-password", {
      body: { company_id: pwdCompany.id, new_password: pwdValue },
    });
    setPwdSubmitting(false);
    if (error || data?.error) toast.error(data?.error || error?.message || "Failed to reset password");
    else { toast.success(`Password updated for ${pwdCompany.name}`); setPwdOpen(false); setPwdCompany(null); }
  };

  const handleQuickToggle = async (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newStatus = company.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("companies").update({ status: newStatus }).eq("id", company.id);
    if (error) toast.error(error.message);
    else { toast.success(`${company.name} ${newStatus === "active" ? "activated" : "suspended"}`); fetchCompanies(); }
  };

  const handleCopyEmail = (email: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(email);
    toast.success("Email copied to clipboard");
  };

  const handleBulkAction = async (action: "activate" | "suspend") => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const { data, error } = await supabase.functions.invoke("bulk-company-action", { body: { company_ids: ids, action } });
    if (error || data?.error) toast.error(data?.error || error?.message || "Bulk action failed");
    else { toast.success(`${ids.length} compan${ids.length === 1 ? "y" : "ies"} updated`); setSelected(new Set()); fetchCompanies(); }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBulkDeleting(true);
    const { data, error } = await supabase.functions.invoke("bulk-company-action", { body: { company_ids: ids, action: "delete" } });
    setBulkDeleting(false);
    if (error || data?.error) toast.error(data?.error || error?.message || "Bulk delete failed");
    else {
      toast.success(`${ids.length} compan${ids.length === 1 ? "y" : "ies"} deleted`);
      setSelected(new Set()); setBulkDeleteOpen(false); fetchCompanies();
    }
  };

  const exportCSV = () => {
    const rows = filtered;
    if (rows.length === 0) { toast.error("Nothing to export"); return; }
    const header = ["Name", "Email", "Status", "Max Screens", "Notes", "Created"];
    const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      header.join(","),
      ...rows.map((c) => [c.name, c.contact_email, c.status, c.max_screens, c.notes ?? "", c.created_at].map(escape).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} compan${rows.length === 1 ? "y" : "ies"}`);
  };

  const formatDate = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
  const formatDateTime = (dateStr: string | null) =>
    dateStr ? new Date(dateStr).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "Never";

  // Onboarding status calculation
  const onboardingStatus = (s: CompanyStats | null) => {
    if (!s) return null;
    return [
      { label: "Admin signed in", done: !!s.admin_last_sign_in },
      { label: "Device added", done: s.devices_total > 0 },
      { label: "Content uploaded", done: s.content_total > 0 },
      { label: "Layout created", done: s.layouts_total > 0 },
    ];
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage company accounts</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Add Company</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Company</DialogTitle></DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Email</Label>
                    <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Admin Password</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
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
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Deployment Mode</Label>
                      <Select value={localMode} onValueChange={setLocalMode}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Cloud Mode (Standard)</SelectItem>
                          <SelectItem value="single">Local Single-Device (Solo)</SelectItem>
                          <SelectItem value="multi">Local Multi-Screen (Cluster)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {localMode === "multi" && (
                      <div className="space-y-2">
                        <Label>Max Local Screens</Label>
                        <Input type="number" value={maxDevices} onChange={(e) => setMaxDevices(e.target.value)} min="1" required />
                      </div>
                    )}
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
          <StatCard title="Active" value={activeCount} icon={CheckCircle2} />
          <StatCard title="Suspended" value={suspendedCount} icon={PowerOff} />
          <StatCard title="Total Screens" value={totalScreensAllocated} icon={Monitor} />
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by name or email..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>

        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/40">
            <p className="text-sm font-medium">{selected.size} selected</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("activate")}>
                <Power className="h-3.5 w-3.5 mr-1.5" /> Activate
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleBulkAction("suspend")}>
                <PowerOff className="h-3.5 w-3.5 mr-1.5" /> Suspend
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">{companies.length === 0 ? "No companies yet. Add your first company." : "No companies match your filters."}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={paged.length > 0 && paged.every((c) => selected.has(c.id))}
                        onCheckedChange={toggleSelectAllPage}
                      />
                    </TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("name")}>
                        Company <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("max_screens")}>
                        Max Screens <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>
                      <button className="flex items-center gap-1 hover:text-foreground" onClick={() => toggleSort("created_at")}>
                        Created <ArrowUpDown className="h-3 w-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((company) => (
                    <TableRow key={company.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedCompany(company)}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox checked={selected.has(company.id)} onCheckedChange={() => toggleSelect(company.id)} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{company.name}</p>
                              {company.notes && <FileText className="h-3 w-3 text-muted-foreground" aria-label="Has notes" />}
                            </div>
                            <p className="text-xs text-muted-foreground">{company.contact_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium capitalize">
                          {company.local_mode === "single" ? "Solo" : company.local_mode === "multi" ? "Multi" : "Cloud"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{company.max_screens}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={company.status as any} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(company.created_at)}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit" onClick={(e) => openEdit(company, e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" onClick={(e) => openDelete(company, e)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => handleQuickToggle(company, e as any)}>
                                {company.status === "active" ? <><PowerOff className="h-4 w-4 mr-2" /> Suspend</> : <><Power className="h-4 w-4 mr-2" /> Activate</>}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => openResetPwd(company, e as any)}>
                                <KeyRound className="h-4 w-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleCopyEmail(company.contact_email, e as any)}>
                                <Copy className="h-4 w-4 mr-2" /> Copy Email
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => openEdit(company, e as any)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={(e) => openDelete(company, e as any)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Deployment Mode</Label>
                <Select value={editLocalMode} onValueChange={setEditLocalMode}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Cloud Mode (Standard)</SelectItem>
                    <SelectItem value="single">Local Single-Device (Solo)</SelectItem>
                    <SelectItem value="multi">Local Multi-Screen (Cluster)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editLocalMode === "multi" && (
                <div className="space-y-2">
                  <Label>Max Local Screens</Label>
                  <Input type="number" value={editMaxDevices} onChange={(e) => setEditMaxDevices(e.target.value)} min="1" required />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex gap-2">
                {["active", "suspended"].map((s) => (
                  <Button key={s} type="button" variant={editStatus === s ? "default" : "outline"} size="sm" onClick={() => setEditStatus(s)} className="capitalize">
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Internal Notes <span className="text-xs text-muted-foreground">(super admin only)</span></Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="VIP client, billing issue, contract renewal date..." rows={3} maxLength={1000} />
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
          <DialogHeader><DialogTitle>Delete Company</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteCompany?.name}</strong>? This will also delete the company's admin account. This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Company"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete {selected.size} Companies</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{selected.size}</strong> compan{selected.size === 1 ? "y" : "ies"} and their admin accounts? This action cannot be undone.
          </p>
          <div className="flex gap-3 justify-end mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? "Deleting..." : `Delete ${selected.size}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset Admin Password</DialogTitle></DialogHeader>
          <form onSubmit={handleResetPwd} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for <strong>{pwdCompany?.name}</strong>'s admin account ({pwdCompany?.contact_email}).
            </p>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input type={pwdShow ? "text" : "password"} value={pwdValue} onChange={(e) => setPwdValue(e.target.value)} required minLength={6} placeholder="At least 6 characters" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setPwdShow(!pwdShow)}>
                  {pwdShow ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setPwdOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={pwdSubmitting || pwdValue.length < 6}>
                {pwdSubmitting ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader><SheetTitle>Company Details</SheetTitle></SheetHeader>
          {selectedCompany && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg">{selectedCompany.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={selectedCompany.status as any} />
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Contact Email</p>
                    <p className="text-sm font-medium">{selectedCompany.contact_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm font-medium">{formatDate(selectedCompany.created_at)}</p>
                  </div>
                </div>
              </div>

              {/* Screen quota */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Screen Quota</span>
                  <span className="text-muted-foreground">
                    {stats?.devices_total ?? 0} / {selectedCompany.max_screens}
                  </span>
                </div>
                <Progress value={Math.min(100, ((stats?.devices_total ?? 0) / Math.max(1, selectedCompany.max_screens)) * 100)} />
              </div>

              <Separator />

              {/* Usage stats */}
              <div>
                <h4 className="text-sm font-semibold mb-3">Usage</h4>
                {statsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> Loading...
                  </div>
                ) : stats ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Server className="h-3.5 w-3.5" /> Devices</div>
                      <p className="text-lg font-semibold mt-1">{stats.devices_total}</p>
                      <p className="text-[10px] text-muted-foreground">{stats.devices_paired} paired</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><ImageIcon className="h-3.5 w-3.5" /> Content</div>
                      <p className="text-lg font-semibold mt-1">{stats.content_total}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Layout className="h-3.5 w-3.5" /> Layouts</div>
                      <p className="text-lg font-semibold mt-1">{stats.layouts_total}</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Schedules</div>
                      <p className="text-lg font-semibold mt-1">{stats.schedules_total}</p>
                      <p className="text-[10px] text-muted-foreground">{stats.schedules_active} active</p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Onboarding */}
              {stats && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Onboarding Status</h4>
                  <div className="space-y-2">
                    {onboardingStatus(stats)!.map((step) => (
                      <div key={step.label} className="flex items-center gap-2 text-sm">
                        {step.done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                        <span className={step.done ? "" : "text-muted-foreground"}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity */}
              {stats && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity className="h-4 w-4" /> Activity</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Admin last login</span>
                      <span>{formatDateTime(stats.admin_last_sign_in)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Last device activity</span>
                      <span>{formatDateTime(stats.last_device_activity)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedCompany.notes && (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" /> Internal Notes</h4>
                    <div className="p-3 rounded-lg border border-border bg-muted/30">
                      <p className="text-sm whitespace-pre-wrap">{selectedCompany.notes}</p>
                    </div>
                  </div>
                </>
              )}

              {/* Admin */}
              <Separator />
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Company Admin</h4>
                {stats?.admin_email ? (
                  <div className="p-3 rounded-lg border border-border bg-muted/30">
                    <p className="text-sm font-medium">{stats.admin_email}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No admin linked.</p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={(e) => { const c = selectedCompany; setSelectedCompany(null); openResetPwd(c, e as any); }}>
                  <KeyRound className="h-4 w-4 mr-2" /> Reset Admin Password
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={(e) => { const c = selectedCompany; setSelectedCompany(null); openEdit(c, e as any); }}>
                    <Pencil className="h-4 w-4 mr-2" /> Edit
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={(e) => { const c = selectedCompany; setSelectedCompany(null); openDelete(c, e as any); }}>
                    <Trash2 className="h-4 w-4 mr-2" /> Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
