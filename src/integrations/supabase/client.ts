// MOCK CLIENT — Supabase backend is paused. This file fakes the supabase API
// surface with in-memory data so the app stays usable. Restore the real client
// when the backend is re-enabled.

type Row = Record<string, any>;
const LS_KEY = "mock_db_v1";
const SESSION_KEY = "mock_session_v1";

const uid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

// ---------- Seed data ----------
const SUPER_USER = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "super@demo.com",
  user_metadata: { email_verified: true },
  app_metadata: { provider: "email", providers: ["email"] },
  aud: "authenticated",
  role: "authenticated",
  created_at: nowIso(),
};

const ADMIN_USER = {
  id: "00000000-0000-0000-0000-000000000002",
  email: "admin@acme.com",
  user_metadata: { email_verified: true },
  app_metadata: { provider: "email", providers: ["email"] },
  aud: "authenticated",
  role: "authenticated",
  created_at: nowIso(),
};

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const LAYOUT_ID = "22222222-2222-2222-2222-222222222222";

const seed = () => ({
  companies: [
    {
      id: COMPANY_ID, name: "Acme Corp", contact_email: "admin@acme.com",
      plan: "pro", max_screens: 25, status: "active", timezone: "UTC",
      logo_url: null, notes: "Demo tenant", created_at: nowIso(), created_by: SUPER_USER.id,
    },
    {
      id: uid(), name: "Globex Media", contact_email: "ops@globex.com",
      plan: "starter", max_screens: 10, status: "active", timezone: "UTC",
      logo_url: null, notes: null, created_at: nowIso(), created_by: SUPER_USER.id,
    },
  ],
  profiles: [
    { id: SUPER_USER.id, full_name: "Super Admin", email: SUPER_USER.email, company_id: null, created_at: nowIso() },
    { id: ADMIN_USER.id, full_name: "Acme Admin", email: ADMIN_USER.email, company_id: COMPANY_ID, created_at: nowIso() },
  ],
  user_roles: [
    { id: uid(), user_id: SUPER_USER.id, role: "super_admin" },
    { id: uid(), user_id: ADMIN_USER.id, role: "admin" },
  ],
  layouts: [
    {
      id: LAYOUT_ID, company_id: COMPANY_ID, name: "Lobby Default",
      description: "Demo layout", resolution_width: 1920, resolution_height: 1080,
      background_color: "#1a1a2e", layout_data: {}, created_at: nowIso(), updated_at: nowIso(),
    },
  ],
  devices: [
    {
      id: uid(), company_id: COMPANY_ID, name: "Lobby TV", location: "Main Lobby",
      status: "online", layout_id: LAYOUT_ID, is_paired: true, pairing_code: null,
      created_at: nowIso(), last_seen_at: nowIso(), orientation: "landscape", resolution: "1920x1080",
    },
    {
      id: uid(), company_id: COMPANY_ID, name: "Cafeteria TV", location: "Cafe",
      status: "offline", layout_id: null, is_paired: false, pairing_code: "ABC123",
      created_at: nowIso(), last_seen_at: null, orientation: "landscape", resolution: "1920x1080",
    },
  ],
  content: [
    { id: uid(), company_id: COMPANY_ID, name: "Welcome Banner", type: "image",
      file_url: "https://picsum.photos/seed/1/1920/1080", file_size: 245000, duration: 10, created_at: nowIso() },
    { id: uid(), company_id: COMPANY_ID, name: "Promo Video", type: "video",
      file_url: "https://www.w3schools.com/html/mov_bbb.mp4", file_size: 1240000, duration: 30, created_at: nowIso() },
  ],
  schedules: [
    { id: uid(), company_id: COMPANY_ID, device_id: null, start_time: "09:00:00", end_time: "18:00:00",
      days_of_week: [1, 2, 3, 4, 5], is_active: true, created_at: nowIso() },
  ],
});

// ---------- Storage ----------
const loadDb = (): Record<string, Row[]> => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  const fresh = seed();
  localStorage.setItem(LS_KEY, JSON.stringify(fresh));
  return fresh;
};
const saveDb = (db: Record<string, Row[]>) => localStorage.setItem(LS_KEY, JSON.stringify(db));
const db: Record<string, Row[]> = loadDb();
// Patch device #1 in case schedules.device_id needs a real id
if (db.schedules?.[0] && !db.schedules[0].device_id && db.devices?.[0]) {
  db.schedules[0].device_id = db.devices[0].id;
  saveDb(db);
}

// ---------- Auth ----------
type Listener = (event: string, session: any) => void;
const listeners: Listener[] = [];

const makeSession = (user: any) => ({
  access_token: "mock-token-" + user.id,
  refresh_token: "mock-refresh",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user,
});

const loadSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};
const saveSession = (s: any) => {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
};

// No auto-login — user picks role on the login page.
let currentSession: any = loadSession();

// ---------- Query Builder ----------
type Filter = { type: string; col: string; val: any };

class QueryBuilder {
  private table: string;
  private filters: Filter[] = [];
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: any = null;
  private orderCol: string | null = null;
  private orderAsc = true;
  private limitN: number | null = null;
  private rangeR: [number, number] | null = null;
  private columns = "*";
  private countMode: string | null = null;
  private headOnly = false;
  private singleMode: "single" | "maybeSingle" | null = null;

  constructor(table: string) { this.table = table; }

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = cols;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    if (this.op !== "insert" && this.op !== "update" && this.op !== "upsert" && this.op !== "delete") this.op = "select";
    return this;
  }
  insert(payload: any) { this.op = "insert"; this.payload = payload; return this; }
  update(payload: any) { this.op = "update"; this.payload = payload; return this; }
  upsert(payload: any) { this.op = "upsert"; this.payload = payload; return this; }
  delete() { this.op = "delete"; return this; }
  eq(col: string, val: any) { this.filters.push({ type: "eq", col, val }); return this; }
  neq(col: string, val: any) { this.filters.push({ type: "neq", col, val }); return this; }
  in(col: string, val: any[]) { this.filters.push({ type: "in", col, val }); return this; }
  is(col: string, val: any) { this.filters.push({ type: "is", col, val }); return this; }
  gt(col: string, val: any) { this.filters.push({ type: "gt", col, val }); return this; }
  gte(col: string, val: any) { this.filters.push({ type: "gte", col, val }); return this; }
  lt(col: string, val: any) { this.filters.push({ type: "lt", col, val }); return this; }
  lte(col: string, val: any) { this.filters.push({ type: "lte", col, val }); return this; }
  like(col: string, val: any) { this.filters.push({ type: "like", col, val }); return this; }
  ilike(col: string, val: any) { this.filters.push({ type: "ilike", col, val }); return this; }
  match(obj: Row) { for (const k in obj) this.eq(k, obj[k]); return this; }
  order(col: string, opts?: { ascending?: boolean }) { this.orderCol = col; this.orderAsc = opts?.ascending !== false; return this; }
  limit(n: number) { this.limitN = n; return this; }
  range(a: number, b: number) { this.rangeR = [a, b]; return this; }
  single() { this.singleMode = "single"; return this; }
  maybeSingle() { this.singleMode = "maybeSingle"; return this; }

  private apply(rows: Row[]): Row[] {
    let out = rows;
    for (const f of this.filters) {
      out = out.filter((r) => {
        const v = r[f.col];
        switch (f.type) {
          case "eq": return v === f.val;
          case "neq": return v !== f.val;
          case "in": return f.val.includes(v);
          case "is": return v === f.val;
          case "gt": return v > f.val;
          case "gte": return v >= f.val;
          case "lt": return v < f.val;
          case "lte": return v <= f.val;
          case "like":
          case "ilike": {
            const pat = String(f.val).replace(/%/g, ".*");
            const re = new RegExp("^" + pat + "$", f.type === "ilike" ? "i" : "");
            return re.test(String(v ?? ""));
          }
        }
        return true;
      });
    }
    if (this.orderCol) {
      const c = this.orderCol;
      out = [...out].sort((a, b) => {
        const av = a[c], bv = b[c];
        if (av === bv) return 0;
        const cmp = av > bv ? 1 : -1;
        return this.orderAsc ? cmp : -cmp;
      });
    }
    if (this.rangeR) out = out.slice(this.rangeR[0], this.rangeR[1] + 1);
    if (this.limitN != null) out = out.slice(0, this.limitN);
    return out;
  }

  private exec(): { data: any; error: any; count?: number } {
    if (!db[this.table]) db[this.table] = [];
    const rows = db[this.table];

    if (this.op === "insert" || this.op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = items.map((it) => ({
        id: it.id ?? uid(),
        created_at: nowIso(),
        ...it,
      }));
      db[this.table] = [...rows, ...inserted];
      saveDb(db);
      const data = this.singleMode ? inserted[0] : inserted;
      return { data, error: null };
    }
    if (this.op === "update") {
      const matched = this.apply(rows);
      const ids = new Set(matched.map((m) => m.id));
      const updated: Row[] = [];
      db[this.table] = rows.map((r) => {
        if (ids.has(r.id)) {
          const merged = { ...r, ...this.payload };
          updated.push(merged);
          return merged;
        }
        return r;
      });
      saveDb(db);
      const data = this.singleMode ? updated[0] ?? null : updated;
      return { data, error: null };
    }
    if (this.op === "delete") {
      const matched = this.apply(rows);
      const ids = new Set(matched.map((m) => m.id));
      db[this.table] = rows.filter((r) => !ids.has(r.id));
      saveDb(db);
      return { data: matched, error: null };
    }
    // select
    const matched = this.apply(rows);
    const count = matched.length;
    if (this.headOnly) return { data: null, error: null, count };
    if (this.singleMode === "single") {
      if (matched.length !== 1) {
        if (matched.length === 0) return { data: null, error: { message: "No rows found", code: "PGRST116" } };
        return { data: matched[0], error: null };
      }
      return { data: matched[0], error: null, count };
    }
    if (this.singleMode === "maybeSingle") {
      return { data: matched[0] ?? null, error: null, count };
    }
    return { data: matched, error: null, count };
  }

  then(onF: (v: any) => any, onR?: (e: any) => any) {
    try { return Promise.resolve(this.exec()).then(onF, onR); }
    catch (e) { return Promise.resolve({ data: null, error: e }).then(onF, onR); }
  }
}

// ---------- Auth API ----------
const authApi = {
  async getSession() { return { data: { session: currentSession }, error: null }; },
  async getUser() { return { data: { user: currentSession?.user ?? null }, error: null }; },
  onAuthStateChange(cb: Listener) {
    listeners.push(cb);
    setTimeout(() => cb("INITIAL_SESSION", currentSession), 0);
    return { data: { subscription: { unsubscribe: () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); } } } };
  },
  async signInWithPassword({ email }: { email: string; password: string }) {
    const user = email.toLowerCase().includes("admin@") && !email.toLowerCase().startsWith("super")
      ? ADMIN_USER : SUPER_USER;
    currentSession = makeSession(user);
    saveSession(currentSession);
    listeners.forEach((l) => l("SIGNED_IN", currentSession));
    return { data: { session: currentSession, user }, error: null };
  },
  async signUp({ email }: { email: string; password: string }) {
    const user = { ...SUPER_USER, id: uid(), email };
    currentSession = makeSession(user);
    saveSession(currentSession);
    listeners.forEach((l) => l("SIGNED_IN", currentSession));
    return { data: { session: currentSession, user }, error: null };
  },
  async signOut() {
    currentSession = null;
    saveSession(null);
    listeners.forEach((l) => l("SIGNED_OUT", null));
    return { error: null };
  },
  async updateUser(_attrs: any) {
    return { data: { user: currentSession?.user ?? null }, error: null };
  },
  async resetPasswordForEmail() { return { data: {}, error: null }; },
};

// ---------- Functions ----------
const functionsApi = {
  async invoke(name: string, opts?: { body?: any }) {
    const body = opts?.body ?? {};
    switch (name) {
      case "list-auth-users":
        return { data: { users: db.profiles.map((p) => ({ id: p.id, email: p.email, banned_until: null, created_at: p.created_at })) }, error: null };
      case "toggle-user-status":
        return { data: { success: true }, error: null };
      case "get-company-stats": {
        const cId = body.company_id;
        return {
          data: {
            devices: db.devices.filter((d) => d.company_id === cId).length,
            content: db.content.filter((c) => c.company_id === cId).length,
            layouts: db.layouts.filter((l) => l.company_id === cId).length,
            schedules: db.schedules.filter((s) => s.company_id === cId).length,
            users: db.profiles.filter((p) => p.company_id === cId).length,
          },
          error: null,
        };
      }
      case "create-company-admin": {
        const company = { id: uid(), name: body.company_name ?? "New Co", contact_email: body.email ?? "", plan: body.plan ?? "starter", max_screens: 10, status: "active", timezone: "UTC", logo_url: null, notes: null, created_at: nowIso(), created_by: currentSession?.user?.id ?? null };
        db.companies.push(company);
        const newAdmin = { id: uid(), email: body.email ?? "admin@new.com" };
        db.profiles.push({ id: newAdmin.id, email: newAdmin.email, full_name: body.full_name ?? "", company_id: company.id, created_at: nowIso() });
        db.user_roles.push({ id: uid(), user_id: newAdmin.id, role: "admin" });
        saveDb(db);
        return { data: { company, user: newAdmin }, error: null };
      }
      case "delete-company": {
        db.companies = db.companies.filter((c) => c.id !== body.company_id);
        saveDb(db);
        return { data: { success: true }, error: null };
      }
      case "reset-company-admin-password":
        return { data: { success: true, temp_password: "TempPass123!" }, error: null };
      case "bulk-company-action": {
        if (body.action === "delete") db.companies = db.companies.filter((c) => !body.company_ids.includes(c.id));
        else db.companies = db.companies.map((c) => body.company_ids.includes(c.id) ? { ...c, status: body.action } : c);
        saveDb(db);
        return { data: { success: true }, error: null };
      }
      case "claim-tv-code": {
        const code = String(body.code ?? "").toUpperCase();
        const dev = db.devices.find((d) => d.pairing_code === code);
        if (!dev) return { data: null, error: { message: "Code not found" } };
        dev.is_paired = true; dev.pairing_code = null; dev.status = "online";
        saveDb(db);
        return { data: { device: dev }, error: null };
      }
      case "generate-tv-code":
        return { data: { device_id: uid(), pairing_code: Math.random().toString(36).slice(2, 8).toUpperCase() }, error: null };
      case "tv-poll-status":
        return { data: { device: db.devices[0], layout: db.layouts[0] }, error: null };
      default:
        console.warn("[mock] unhandled function:", name);
        return { data: null, error: null };
    }
  },
};

// ---------- Storage ----------
const storageApi = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: File) {
        // create object URL — survives only this session
        try { (window as any).__mockBlobs ??= {}; (window as any).__mockBlobs[path] = URL.createObjectURL(file); } catch {}
        return { data: { path }, error: null };
      },
      getPublicUrl(path: string) {
        const url = (window as any).__mockBlobs?.[path] ?? `https://picsum.photos/seed/${encodeURIComponent(path)}/1920/1080`;
        return { data: { publicUrl: url } };
      },
      async remove(_paths: string[]) { return { data: [], error: null }; },
      async list() { return { data: [], error: null }; },
    };
  },
};

// ---------- Channels (realtime no-op) ----------
const channelApi = (_name: string) => {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: any) => { cb?.("SUBSCRIBED"); return ch; },
    unsubscribe: () => Promise.resolve("ok"),
  };
  return ch;
};

// ---------- Public client ----------
export const supabase: any = {
  from: (table: string) => new QueryBuilder(table),
  auth: authApi,
  functions: functionsApi,
  storage: storageApi,
  channel: channelApi,
  removeChannel: () => {},
  rpc: async (_fn: string, _args?: any) => ({ data: null, error: null }),
};
