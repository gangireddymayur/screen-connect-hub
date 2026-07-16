import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Users, Shield, Building2, Mail, Calendar, Clock, UserCheck, UserX, X, Plus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AuthUser {
  id: string;
  email: string;
  banned_until: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  email_confirmed_at: string | null;
}

interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
  company_id: string | null;
  role: string | null;
  company_name: string | null;
  is_banned: boolean;
  last_sign_in_at: string | null;
  email_confirmed: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [toggling, setToggling] = useState(false);
  const { user: currentUser } = useAuth();

  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteCompanyId, setInviteCompanyId] = useState("");
  const [inviteRole, setInviteRole] = useState("admin");
  const [inviteLocalMode, setInviteLocalMode] = useState("none");
  const [inviteMaxDevices, setInviteMaxDevices] = useState(5);
  const [inviting, setInviting] = useState(false);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCompanyId) {
      toast.error("Please select a company");
      return;
    }
    if (invitePassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setInviting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: inviteEmail,
          password: invitePassword,
          full_name: inviteName,
          company_id: inviteCompanyId,
          role: inviteRole,
          local_mode: inviteLocalMode,
          max_devices: inviteLocalMode === "multi" ? inviteMaxDevices : 1,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Failed to create user");
      } else {
        toast.success("User created successfully");
        setInviteOpen(false);
        setInviteEmail("");
        setInvitePassword("");
        setInviteName("");
        setInviteCompanyId("");
        setInviteLocalMode("none");
        setInviteMaxDevices(5);
        fetchUsers();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create user");
    } finally {
      setInviting(false);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);

    // Fetch profiles, roles, companies, and auth user data in parallel
    const [profilesRes, rolesRes, companiesRes, authUsersRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("*"),
      supabase.from("companies").select("id, name"),
      supabase.functions.invoke("list-auth-users"),
    ]);

    if (profilesRes.error) {
      toast.error("Failed to load users");
      setLoading(false);
      return;
    }

    const rolesMap = new Map<string, string>();
    (rolesRes.data ?? []).forEach((r: any) => rolesMap.set(r.user_id, r.role));

    const companiesMap = new Map<string, string>();
    (companiesRes.data ?? []).forEach((c: any) => companiesMap.set(c.id, c.name));

    const authUsersMap = new Map<string, AuthUser>();
    const authUsers: AuthUser[] = authUsersRes.data?.users ?? [];
    authUsers.forEach((u) => authUsersMap.set(u.id, u));

    const merged: UserProfile[] = (profilesRes.data ?? []).map((p: any) => {
      const authUser = authUsersMap.get(p.id);
      const isBanned = authUser?.banned_until
        ? new Date(authUser.banned_until) > new Date()
        : false;
      return {
        ...p,
        role: rolesMap.get(p.id) ?? null,
        company_name: p.company_id ? companiesMap.get(p.company_id) ?? null : null,
        is_banned: isBanned,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        email_confirmed: !!authUser?.email_confirmed_at,
      };
    }).filter((u) => u.role !== "super_admin");

    setUsers(merged);
    setCompanies(companiesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: UserProfile) => {
    setToggling(true);
    const action = user.is_banned ? "unban" : "ban";

    const { data, error } = await supabase.functions.invoke("toggle-user-status", {
      body: { user_id: user.id, action },
    });

    setToggling(false);

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to update user status");
      return;
    }

    toast.success(action === "ban" ? "User deactivated" : "User activated");
    
    // Update local state
    const updated = users.map((u) =>
      u.id === user.id ? { ...u, is_banned: action === "ban" } : u
    );
    setUsers(updated);
    if (selectedUser?.id === user.id) {
      setSelectedUser({ ...selectedUser, is_banned: action === "ban" });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getRoleLabel = (role: string | null) => {
    if (role === "super_admin") return "Super Admin";
    if (role === "admin") return "Admin";
    return "No Role";
  };

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => !u.is_banned).length;
  const adminUsers = users.filter((u) => u.role === "admin").length;
  const bannedUsers = users.filter((u) => u.is_banned).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage all users across the platform</p>
          </div>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Invite User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeUsers}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminUsers}</p>
                  <p className="text-xs text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <UserX className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{bannedUsers}</p>
                  <p className="text-xs text-muted-foreground">Deactivated</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin h-6 w-6 border-4 border-primary border-t-transparent rounded-full" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No users found.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Sign In</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow
                      key={u.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setSelectedUser(u)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-sm font-semibold text-primary">
                              {(u.full_name || u.email || "?")[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{u.full_name || "Unnamed"}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm capitalize">{getRoleLabel(u.role)}</span>
                      </TableCell>
                      <TableCell>
                        {u.company_name ? (
                          <div className="flex items-center gap-1.5">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm">{u.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={u.is_banned ? "suspended" : "active"} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.last_sign_in_at)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(u.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* User Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>User Details</SheetTitle>
          </SheetHeader>

          {selectedUser && (
            <div className="mt-6 space-y-6">
              {/* Avatar & name */}
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">
                    {(selectedUser.full_name || selectedUser.email || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.full_name || "Unnamed"}</h3>
                  <p className="text-sm text-muted-foreground">{getRoleLabel(selectedUser.role)}</p>
                </div>
              </div>

              <Separator />

              {/* Info rows */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{selectedUser.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm font-medium">{selectedUser.company_name || "None"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Role</p>
                    <p className="text-sm font-medium">{getRoleLabel(selectedUser.role)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Joined</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedUser.created_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Last Sign In</p>
                    <p className="text-sm font-medium">{formatDateTime(selectedUser.last_sign_in_at)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedUser.email_confirmed ? (
                    <UserCheck className="h-4 w-4 text-success" />
                  ) : (
                    <UserX className="h-4 w-4 text-warning" />
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Email Status</p>
                    <p className="text-sm font-medium">
                      {selectedUser.email_confirmed ? "Confirmed" : "Unconfirmed"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Activate/Deactivate */}
              {selectedUser.id !== currentUser?.id && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">
                      {selectedUser.is_banned ? "Account Deactivated" : "Account Active"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selectedUser.is_banned
                        ? "This user cannot log in"
                        : "This user can log in normally"}
                    </p>
                  </div>
                  <Switch
                    checked={!selectedUser.is_banned}
                    disabled={toggling}
                    onCheckedChange={() => handleToggleStatus(selectedUser)}
                  />
                </div>
              )}

              {selectedUser.id === currentUser?.id && (
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    You cannot deactivate your own account.
                  </p>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Create a new user account and assign it to a company.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInviteSubmit} className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="e.g. John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder="Min 6 characters"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <select
                id="company"
                value={inviteCompanyId}
                onChange={(e) => setInviteCompanyId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                required
              >
                <option value="">Select a company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                required
              >
                <option value="admin">Company Admin</option>
                <option value="sub_user">Sub User</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="local_mode">Deployment Mode</Label>
              <select
                id="local_mode"
                value={inviteLocalMode}
                onChange={(e) => setInviteLocalMode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                required
              >
                <option value="none">Cloud Mode (Standard)</option>
                <option value="single">Local Single-Device (Solo)</option>
                <option value="multi">Local Multi-Tablet (Network Cluster)</option>
              </select>
            </div>
            {inviteLocalMode === "multi" && (
              <div className="space-y-2">
                <Label htmlFor="max_devices">Max Allowed Tablets/Screens</Label>
                <Input
                  id="max_devices"
                  type="number"
                  min={1}
                  value={inviteMaxDevices}
                  onChange={(e) => setInviteMaxDevices(Number(e.target.value))}
                  required
                />
              </div>
            )}
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
