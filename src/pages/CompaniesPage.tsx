import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Building2, Monitor, Eye, EyeOff, Pencil, Trash2, Mail, Calendar, Shield, X, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Company {
  id: string;
  name: string;
  contact_email: string;
  plan: string;
  max_screens: number;
  status: string;
  created_at: string;
}

interface CompanyAdmin {
  id: string;
  full_name: string | null;
  email: string | null;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [maxScreens, setMaxScreens] = useState("10");
  const [submitting, setSubmitting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMaxScreens, setEditMaxScreens] = useState("");
  const [editStatus, setEditStatus] = useState("");

  // Detail sheet
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [companyAdmin, setCompanyAdmin] = useState<CompanyAdmin | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCompany, setDeleteCompany] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset password
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdCompany, setPwdCompany] = useState<Company | null>(null);
  const [pwdValue, setPwdValue] = useState("");
  const [pwdShow, setPwdShow] = useState(false);
  const [pwdSubmitting, setPwdSubmitting] = useState(false);

  const openResetPwd = (company: Company, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPwdCompany(company);
    setPwdValue("");
    setPwdShow(false);
    setPwdOpen(true);
  };

  const handleResetPwd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCompany) return;
    setPwdSubmitting(true);
    const { data, error } = await supabase.functions.invoke("reset-company-admin-password", {
      body: { company_id: pwdCompany.id, new_password: pwdValue },
    });
    setPwdSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to reset password");
    } else {
      toast.success(`Password updated for ${pwdCompany.name}`);
      setPwdOpen(false);
      setPwdCompany(null);
    }
  };

  const fetchCompanies = async () => {
    const { data, error } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load companies");
    } else {
      setCompanies(data ?? []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  // Fetch admin when detail sheet opens
  useEffect(() => {
    if (!selectedCompany) { setCompanyAdmin(null); return; }
    setAdminLoading(true);
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", selectedCompany.id)
      .limit(1)
      .then(({ data }) => {
        setCompanyAdmin(data?.[0] ?? null);
        setAdminLoading(false);
      });
  }, [selectedCompany]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-company-admin", {
      body: { name, contact_email: contactEmail, password, max_screens: parseInt(maxScreens) },
    });
    setSubmitting(false);
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create company");
    } else {
      toast.success("Company and admin account created!");
      setAddOpen(false);
      setName(""); setContactEmail(""); setPassword(""); setMaxScreens("10");
      fetchCompanies();
    }
  };

  const openEdit = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditCompany(company);
    setEditName(company.name);
    setEditEmail(company.contact_email);
    setEditMaxScreens(String(company.max_screens));
    setEditStatus(company.status);
    setEditOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCompany) return;
    setSubmitting(true);
    const { error } = await supabase.from("companies").update({
      name: editName,
      contact_email: editEmail,
      max_screens: parseInt(editMaxScreens),
      status: editStatus,
    }).eq("id", editCompany.id);
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Company updated!");
      setEditOpen(false);
      fetchCompanies();
    }
  };

  const openDelete = (company: Company, e: React.MouseEvent) => {
    e.stopPropagation();
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
      toast.success("Company and admin deleted!");
      setDeleteOpen(false);
      setDeleteCompany(null);
      if (selectedCompany?.id === deleteCompany.id) setSelectedCompany(null);
      fetchCompanies();
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage company accounts</p>
          </div>
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
                  <Input type="number" value={maxScreens} onChange={(e) => setMaxScreens(e.target.value)} min="1" required />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating..." : "Create Company & Admin"}
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
            ) : companies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No companies yet. Add your first company.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Max Screens</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedCompany(company)}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{company.name}</p>
                            <p className="text-xs text-muted-foreground">{company.contact_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{company.max_screens}</span>
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={company.status as any} /></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(company.created_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reset password" onClick={(e) => openResetPwd(company, e)}>
                            <KeyRound className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => openEdit(company, e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => openDelete(company, e)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
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
              <Input type="number" value={editMaxScreens} onChange={(e) => setEditMaxScreens(e.target.value)} min="1" required />
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

      {/* Company Detail Sheet */}
      <Sheet open={!!selectedCompany} onOpenChange={(open) => !open && setSelectedCompany(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Company Details</SheetTitle></SheetHeader>
          {selectedCompany && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedCompany.name}</h3>
                  <StatusBadge status={selectedCompany.status as any} />
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Contact Email</p>
                    <p className="text-sm font-medium">{selectedCompany.contact_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Max Screens</p>
                    <p className="text-sm font-medium">{selectedCompany.max_screens}</p>
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

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Shield className="h-4 w-4" /> Company Admin</h4>
                {adminLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" /> Loading...
                  </div>
                ) : companyAdmin ? (
                  <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                    <p className="text-sm font-medium">{companyAdmin.full_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{companyAdmin.email}</p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No admin linked to this company.</p>
                )}
              </div>

              <Separator />

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={(e) => { setSelectedCompany(null); openEdit(selectedCompany, e as any); }}>
                  <Pencil className="h-4 w-4 mr-2" /> Edit
                </Button>
                <Button variant="destructive" className="flex-1" onClick={(e) => { setSelectedCompany(null); openDelete(selectedCompany, e as any); }}>
                  <Trash2 className="h-4 w-4 mr-2" /> Delete
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
