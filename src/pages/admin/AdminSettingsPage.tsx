import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Upload, X, LogOut, Edit2, Save, Loader2, RefreshCw, SlidersHorizontal, MapPin, Mail, Phone, MessageSquare, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AdminSettingsPage() {
  const { user, signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"general" | "developer">("general");
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");

  // Company settings fields
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [showBrandHeader, setShowBrandHeader] = useState(0);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [brandHeaderPlacement, setBrandHeaderPlacement] = useState<string>("top");
  const [showPlacementSettings, setShowPlacementSettings] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Original load state to track modifications
  const [originalData, setOriginalData] = useState<{
    fullName: string;
    companyName: string;
    logoUrl: string | null;
    showBrandHeader: number;
    brandHeaderPlacement: string;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data: profile } = await supabase.from("profiles").select("full_name, email, company_id").eq("id", user.id).single();
        if (profile) {
          setFullName(profile.full_name ?? "");
          setEmail(profile.email ?? "");
          if (profile.company_id) {
            setCompanyId(profile.company_id);
            const { data: company } = await supabase.from("companies").select("name, logo_url, show_brand_header, brand_header_placement").eq("id", profile.company_id).single();
            if (company) {
              setCompanyName(company.name ?? "");
              setLogoUrl((company as any).logo_url ?? null);
              setShowBrandHeader((company as any).show_brand_header ?? 0);
              setBrandHeaderPlacement((company as any).brand_header_placement ?? "top");

              setOriginalData({
                fullName: profile.full_name ?? "",
                companyName: company.name ?? "",
                logoUrl: (company as any).logo_url ?? null,
                showBrandHeader: (company as any).show_brand_header ?? 0,
                brandHeaderPlacement: (company as any).brand_header_placement ?? "top",
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const hasChanges = useMemo(() => {
    if (!originalData) return false;
    return (
      fullName !== originalData.fullName ||
      companyName !== originalData.companyName ||
      logoUrl !== originalData.logoUrl ||
      showBrandHeader !== originalData.showBrandHeader ||
      brandHeaderPlacement !== originalData.brandHeaderPlacement
    );
  }, [fullName, companyName, logoUrl, showBrandHeader, brandHeaderPlacement, originalData]);

  const handleSaveSettings = async () => {
    if (!user || !companyId) return;
    setSavingSettings(true);

    try {
      // 1. Save profile full_name
      if (fullName !== originalData?.fullName) {
        const { error: profileError } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
        if (profileError) throw profileError;
      }

      // 2. Save company configurations (timezone defaults to Asia/Kolkata for India)
      if (
        companyName !== originalData?.companyName ||
        logoUrl !== originalData?.logoUrl ||
        showBrandHeader !== originalData?.showBrandHeader ||
        brandHeaderPlacement !== originalData?.brandHeaderPlacement
      ) {
        const { error: companyError } = await supabase.from("companies").update({
          name: companyName,
          timezone: "Asia/Kolkata",
          logo_url: logoUrl,
          show_brand_header: showBrandHeader,
          brand_header_placement: brandHeaderPlacement,
        } as any).eq("id", companyId);
        if (companyError) throw companyError;
      }

      toast.success("Settings saved successfully");
      setIsEditing(false);
      setOriginalData({
        fullName,
        companyName,
        logoUrl,
        showBrandHeader,
        brandHeaderPlacement,
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (originalData) {
      setFullName(originalData.fullName);
      setCompanyName(originalData.companyName);
      setLogoUrl(originalData.logoUrl);
      setShowBrandHeader(originalData.showBrandHeader);
      setBrandHeaderPlacement(originalData.brandHeaderPlacement);
      setShowPlacementSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("content").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("content").getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      toast.success("Logo uploaded! Remember to click Save Changes.");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Password updated!");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  const handleLogout = async () => {
    setLogoutOpen(false);
    await signOut();
  };

  const handleDownloadBackup = async () => {
    try {
      const token = localStorage.getItem("sh_token");
      const res = await fetch("/api/backup", {
        headers: token ? { "Authorization": `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to download backup");
      }
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `signagehub_backup_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Backup downloaded successfully");
    } catch (err: any) {
      toast.error("Failed to generate backup: " + err.message);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ok = window.confirm(
      "WARNING: Restoring backup will import all layouts, content, devices, and schedules from the file. Do you want to proceed?"
    );
    if (!ok) return;

    setRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const token = localStorage.getItem("sh_token");
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to restore backup");
      }
      toast.success("Data restored successfully! Refreshing page...");
      window.location.reload();
    } catch (err: any) {
      toast.error("Failed to restore backup: " + err.message);
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <PageHeader title="Settings" />
        <div className="flex h-96 items-center justify-center">
          <RefreshCw className="size-8 text-primary animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <PageHeader
        title="Settings"
        description="Profile, branding preferences, and security options."
      />

      <div className="flex items-center gap-2 mb-6">
        <Button
          variant={activeTab === "general" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("general")}
          className="rounded-full text-xs h-8 px-4"
        >
          General Settings
        </Button>
        <Button
          variant={activeTab === "developer" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("developer")}
          className="rounded-full text-xs h-8 px-4"
        >
          Developer Info
        </Button>
      </div>

      {activeTab === "general" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile and Branding Settings Card */}
          <GlassCard className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div>
                <h3 className="font-semibold text-lg">Profile & Branding</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage organization info and logo asset settings.</p>
              </div>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="h-8 border-white/10 text-xs">
                  <Edit2 className="size-3.5 mr-1.5" /> Edit Info
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="h-8 text-xs text-muted-foreground">
                    <X className="size-3.5 mr-1.5" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSaveSettings}
                    disabled={!hasChanges || savingSettings}
                    className="h-8 text-xs font-semibold bg-primary hover:bg-primary/90"
                  >
                    <Save className="size-3.5 mr-1.5" /> Save Changes
                  </Button>
                </div>
              )}
            </div>

            {/* Profile Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Organization / Company Name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={!isEditing}
                placeholder="e.g. Acme Corp"
              />
              <Field
                label="Full Name (Account Admin)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={!isEditing}
                placeholder="e.g. Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Field
                label="Email Address (Login Identifier)"
                value={email}
                disabled
                className="opacity-70 cursor-not-allowed"
              />
              <p className="text-[10px] text-muted-foreground">Email cannot be modified directly. Contact your system admin if changes are required.</p>
            </div>

            {/* Logo Settings Section */}
            <div className="border-t border-white/5 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Branding Logo Asset</h4>
                  <p className="text-xs text-muted-foreground">Upload your organization logo to appear on screen headers and top navigation.</p>
                </div>
                {logoUrl && isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl(null)}
                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Remove Logo
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="size-20 rounded-2xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center overflow-hidden shrink-0 relative group">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Building2 className="size-8 text-muted-foreground/40" />
                  )}
                </div>

                {isEditing && (
                  <div className="space-y-2">
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      disabled={uploadingLogo}
                    />
                    <Label
                      htmlFor="logo-upload"
                      className={cn(
                        "inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer transition-all",
                        uploadingLogo && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" /> Uploading Logo…
                        </>
                      ) : (
                        <>
                          <Upload className="size-3.5" /> Select Image File
                        </>
                      )}
                    </Label>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG, SVG, WebP up to 5MB. Transparent PNG recommended.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Toggle Brand Header Switch */}
            <div className="border-t border-white/5 pt-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Display Brand Header on TV Screens</Label>
                  <p className="text-xs text-muted-foreground">
                    When enabled, your organization logo or company name is permanently rendered across paired signage displays.
                  </p>
                </div>
                <Switch
                  checked={showBrandHeader === 1}
                  onCheckedChange={(checked) => {
                    setShowBrandHeader(checked ? 1 : 0);
                    if (!checked) setShowPlacementSettings(false);
                  }}
                  disabled={!isEditing}
                />
              </div>

              {/* Placement Settings Accordion / Toggle */}
              {showBrandHeader === 1 && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPlacementSettings(!showPlacementSettings)}
                    className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline focus:outline-none cursor-pointer"
                  >
                    <SlidersHorizontal className="size-3.5" />
                    <span>{showPlacementSettings ? "Hide Header Layout Options" : "Customize Header Layout & Position"}</span>
                  </button>

                  {showPlacementSettings && (
                    <div className="mt-3 p-4 rounded-xl bg-white/[0.03] border border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <Label className="text-xs font-semibold text-muted-foreground">Header Placement on TV Displays</Label>
                        <p className="text-[11px] text-muted-foreground/80 mb-3">
                          Select which area of the TV screen should reserve space for your brand banner.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { id: "top", label: "Top Bar", desc: "Classic horizontal banner at the top" },
                          { id: "bottom", label: "Bottom Bar", desc: "Footer banner with ticker support" },
                          { id: "left", label: "Left Sidebar", desc: "Vertical branding strip on the left" },
                          { id: "right", label: "Right Sidebar", desc: "Vertical branding strip on the right" },
                        ].map((pos) => {
                          const isSelected = brandHeaderPlacement === pos.id;
                          return (
                            <button
                              key={pos.id}
                              type="button"
                              disabled={!isEditing}
                              onClick={() => setBrandHeaderPlacement(pos.id)}
                              className={cn(
                                "flex flex-col items-start p-3 rounded-xl border text-left transition-all relative",
                                isSelected
                                  ? "bg-primary/10 border-primary/40 text-primary shadow-sm"
                                  : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05] text-foreground/70",
                                !isEditing && "opacity-60 cursor-not-allowed"
                              )}
                            >
                              <div className="flex items-center justify-between w-full mb-1">
                                <span className="text-xs font-bold">{pos.label}</span>
                                {isSelected && <span className="size-2 rounded-full bg-primary animate-pulse-glow" />}
                              </div>
                              <span className="text-[10px] text-muted-foreground leading-tight">{pos.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </GlassCard>

          {/* Security Password Card */}
          <div className="space-y-6">
            <GlassCard>
              <h3 className="font-semibold text-lg mb-1">Security</h3>
              <p className="text-xs text-muted-foreground mb-4">Update your account password.</p>
              <div className="space-y-4">
                <Field
                  label="New Password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <Field
                  label="Confirm New Password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
                <Button
                  className="w-full mt-2 h-9 text-xs"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !newPassword}
                >
                  {changingPassword ? "Updating…" : "Update Password"}
                </Button>
              </div>
            </GlassCard>

            {/* Backup & Restore Card */}
            <GlassCard>
              <h3 className="font-semibold text-lg mb-1">Backup & Restore</h3>
              <p className="text-xs text-muted-foreground mb-4">Export or import your complete account data (layouts, content, devices, and schedules).</p>
              <div className="space-y-3">
                <Button variant="outline" className="w-full h-9 text-xs border-border" onClick={handleDownloadBackup}>
                  Download Backup
                </Button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestoreBackup}
                    disabled={restoring}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    id="backup-file-input"
                  />
                  <Button variant="outline" className="w-full h-9 text-xs border-border" disabled={restoring}>
                    {restoring ? "Restoring Data…" : "Upload Backup File"}
                  </Button>
                </div>
              </div>
            </GlassCard>

            {/* Session Management / Log Out Card */}
            <GlassCard className="border-red-500/20 bg-red-500/[0.01]">
              <h3 className="font-semibold text-red-400 text-lg mb-1">Session</h3>
              <p className="text-xs text-muted-foreground mb-4">Log out of your current session on this device.</p>
              <Button variant="destructive" className="w-full h-9 text-xs" onClick={() => setLogoutOpen(true)}>
                <LogOut className="size-4 mr-2" /> Log Out
              </Button>
            </GlassCard>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-4xl">
          <GlassCard className="p-8 border border-border relative overflow-hidden bg-card/60 backdrop-blur-xl">
            {/* Background gradient elements */}
            <div className="absolute -top-24 -right-24 size-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 size-48 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

            {/* Advaitha Profile Banner Image */}
            <div className="w-full rounded-2xl border border-border/40 overflow-hidden bg-muted/40 mb-6 shadow-xl">
              <img
                src="/advaitha.png"
                alt="Advaitha Automations Showcase"
                className="w-full h-auto object-contain"
              />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-6 border-b border-border/50">
              <div className="space-y-2">
                <div className="inline-flex px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary tracking-wider uppercase">
                  System Developer Profile
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-teal-400 via-emerald-400 to-indigo-400 bg-clip-text text-transparent">
                  ADVAITHA Automations
                </h2>
                <p className="text-sm font-semibold text-foreground/80">
                  ADVAITHA Designers N Networks
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                  <MapPin className="size-4 text-primary shrink-0" />
                  <span>Road No.12, Banjara Hills, Mithali Nagar, Hyderabad - 500034</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 shrink-0">
                <a
                  href="mailto:sree@advaitha.co.in"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Mail className="size-3.5" />
                  <span>sree@advaitha.co.in</span>
                </a>
                <a
                  href="tel:9490468368"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Phone className="size-3.5" />
                  <span>+91 9490468368</span>
                </a>
              </div>
            </div>

            {/* WhatsApp Integration CTA */}
            <div className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="text-sm font-bold text-emerald-400 flex items-center justify-center sm:justify-start gap-1.5">
                  <MessageSquare className="size-4 shrink-0" /> Instant Technical Support
                </h4>
                <p className="text-xs text-emerald-300/80 leading-normal max-w-md">
                  Have questions, feature requests, or need technical assistance? Chat directly with our engineering team on WhatsApp.
                </p>
              </div>
              <a
                href="https://wa.me/9490468368"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 text-zinc-950 text-xs font-extrabold hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 active:scale-95 transition-all shrink-0 cursor-pointer"
              >
                Chat on WhatsApp
                <ExternalLink className="size-3.5" />
              </a>
            </div>

            {/* Services Showcase Grid */}
            <div className="mt-8 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                Our Solutions & Services
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
                  <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider">Enterprise & Operations</h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>High-Performance Servers</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>IT Infrastructure & Managed Services</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>Custom Software & Apps Development</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      <span>Evolis ID Card Printers & Consumables</span>
                    </li>
                  </ul>
                </div>
                <div className="space-y-2.5 p-4 rounded-2xl bg-muted/20 border border-border/50">
                  <h4 className="text-xs font-extrabold text-indigo-400 uppercase tracking-wider">Security & Digital Signage</h4>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>SDWAN / Enterprise Firewalls</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>CCTV Surveillance Systems</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>Queue Management & Digital Kiosks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-indigo-400" />
                      <span>Digital Signage & Biometric Attendance</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Strategic Partnerships Section */}
            <div className="mt-8 pt-6 border-t border-border/50 space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest text-center">
                Strategic Technology Partnerships
              </h3>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <span className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-semibold text-muted-foreground">
                  Google Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-semibold text-muted-foreground">
                  Cisco Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-semibold text-muted-foreground">
                  Honeywell Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-semibold text-muted-foreground">
                  Microsoft Silver Partner
                </span>
                <span className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-[10px] font-semibold text-muted-foreground">
                  Evolis Partner
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-foreground">
          <DialogHeader>
            <DialogTitle>Confirm Log Out</DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs pt-1">
              Are you sure you want to log out? You will need to enter your credentials to access the dashboard again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-3 border-t border-white/5 mt-4">
            <Button variant="outline" size="sm" onClick={() => setLogoutOpen(false)} className="h-8 text-xs border-white/10">
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleLogout} className="h-8 text-xs font-semibold">
              Log Out
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

function GlassCard({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card/40 backdrop-blur-md border rounded-2xl shadow-sm p-4", className)} {...props}>
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

function Field({ label, className, ...props }: { label: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input {...props} className={cn("bg-white/5 border-white/10 text-xs h-9", className)} />
    </div>
  );
}
