// HTTP client that mimics the supabase API surface, talking to the Plesk
// MariaDB backend at VITE_API_URL (default "/api"). All existing pages
// continue to use `supabase.from(...).select()...` unchanged.

type Row = Record<string, any>;

const API = (import.meta as any).env?.VITE_API_URL || "/api";
const TOKEN_KEY = "sh_token";
const SESSION_KEY = "sh_session";

// --- table aliases (frontend names -> backend table names)
const TABLE_ALIAS: Record<string, string> = {
  profiles: "profiles", // backend maps /api/profiles -> users
};

const uid = () =>
  (typeof crypto !== "undefined" && (crypto as any).randomUUID)
    ? (crypto as any).randomUUID()
    : "id-" + Math.random().toString(36).slice(2);
const nowIso = () => new Date().toISOString();

// ---------------- HTTP helpers ----------------
const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
};
const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
};

async function api(method: string, path: string, body?: any): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) headers.Authorization = `Bearer ${t}`;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 20000);

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") {
      throw new Error("API request timed out. Check the backend connection and database.");
    }
    throw new Error(e?.message || "Failed to fetch");
  } finally {
    window.clearTimeout(timeout);
  }

  let json: any = null;
  try { json = await res.json(); } catch {}
  if (!res.ok) {
    const msg = json?.error || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return json;
}

// ---------------- Per-table cache ----------------
const cache: Record<string, Row[]> = {};
const loaded: Record<string, boolean> = {};
const inflight: Record<string, Promise<void> | undefined> = {};

async function ensureLoaded(table: string) {
  const t = TABLE_ALIAS[table] || table;
  if (loaded[table]) return;
  if (inflight[table]) return inflight[table];
  inflight[table] = (async () => {
    try {
      const rows = await api("GET", `/${t}`);
      cache[table] = Array.isArray(rows) ? rows : [];
      loaded[table] = true;
    } catch (e) {
      console.warn(`[api] failed to load /${t}:`, (e as any).message);
      cache[table] = cache[table] || [];
      loaded[table] = true; // avoid endless retries; pages will just show empty
    } finally {
      inflight[table] = undefined;
    }
  })();
  return inflight[table];
}

// ---------------- Session ----------------
type Listener = (event: string, session: any) => void;
const listeners: Listener[] = [];

const loadSession = (): any => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const saveSession = (s: any) => {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {}
};

let currentSession: any = loadSession();

const makeSession = (token: string, user: any) => ({
  access_token: token,
  refresh_token: "",
  expires_in: 3600 * 24 * 7,
  expires_at: Math.floor(Date.now() / 1000) + 3600 * 24 * 7,
  token_type: "bearer",
  user: {
    id: user.id,
    email: user.email,
    user_metadata: { full_name: user.full_name, company_id: user.company_id, role: user.role },
    app_metadata: { provider: "email", providers: ["email"] },
    aud: "authenticated",
    role: "authenticated",
    created_at: nowIso(),
  },
});

// ---------------- Query Builder ----------------
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
  private returning = false;

  constructor(table: string) { this.table = table; }

  select(cols = "*", opts?: { count?: string; head?: boolean }) {
    this.columns = cols;
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.headOnly = true;
    if (this.op === "insert" || this.op === "update" || this.op === "upsert" || this.op === "delete") {
      this.returning = true;
    } else {
      this.op = "select";
    }
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

  private wrap(data: any, count?: number) {
    if (this.singleMode === "single") {
      const arr = Array.isArray(data) ? data : [data].filter(Boolean);
      if (arr.length === 0) return { data: null, error: { message: "No rows found", code: "PGRST116" } };
      return { data: arr[0], error: null, count };
    }
    if (this.singleMode === "maybeSingle") {
      const arr = Array.isArray(data) ? data : [data].filter(Boolean);
      return { data: arr[0] ?? null, error: null, count };
    }
    return { data, error: null, count };
  }

  private async runAsync(): Promise<{ data: any; error: any; count?: number }> {
    const t = TABLE_ALIAS[this.table] || this.table;
    try {
      await ensureLoaded(this.table);
      if (!cache[this.table]) cache[this.table] = [];
      const rows = cache[this.table];

      if (this.op === "insert" || this.op === "upsert") {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload];
        const inserted: Row[] = [];
        for (const it of items) {
          const payload = { id: it.id ?? uid(), created_at: nowIso(), ...it };
          try {
            const r = await api("POST", `/${t}`, payload);
            if (r?.id) payload.id = r.id;
          } catch (e) {
            return { data: null, error: { message: (e as any).message } };
          }
          inserted.push(payload);
          cache[this.table].push(payload);
        }
        return this.wrap(this.singleMode ? inserted[0] : inserted);
      }

      if (this.op === "update") {
        const matched = this.apply(rows);
        if (matched.length === 0) {
          const filterText = this.filters.length
            ? this.filters.map((f) => `${f.col}=${String(f.val)}`).join(", ")
            : "no filters";
          return { data: null, error: { message: `No ${this.table} row matched update (${filterText})` } };
        }
        const updated: Row[] = [];
        for (const m of matched) {
          try {
            const r = await api("PATCH", `/${t}/${m.id}`, this.payload);
            if (r?.affectedRows === 0) {
              return { data: null, error: { message: `No ${this.table} row was updated` } };
            }
          }
          catch (e) { return { data: null, error: { message: (e as any).message } }; }
          Object.assign(m, this.payload);
          updated.push(m);
        }
        return this.wrap(this.singleMode ? updated[0] ?? null : updated);
      }

      if (this.op === "delete") {
        const matched = this.apply(rows);
        const ids = new Set(matched.map((m) => m.id));
        for (const id of ids) {
          try { await api("DELETE", `/${t}/${id}`); }
          catch (e) { return { data: null, error: { message: (e as any).message } }; }
        }
        cache[this.table] = rows.filter((r) => !ids.has(r.id));
        return this.wrap(matched);
      }

      // select
      const matched = this.apply(rows);
      const count = matched.length;
      if (this.headOnly) return { data: null, error: null, count };
      return this.wrap(matched, count);
    } catch (e: any) {
      return { data: null, error: { message: e?.message || String(e) } };
    }
  }

  then(onF: (v: any) => any, onR?: (e: any) => any) {
    return this.runAsync().then(onF, onR);
  }
}

// ---------------- Auth API ----------------
const authApi = {
  async getSession() { return { data: { session: currentSession }, error: null }; },
  async getUser() { return { data: { user: currentSession?.user ?? null }, error: null }; },
  onAuthStateChange(cb: Listener) {
    listeners.push(cb);
    setTimeout(() => cb("INITIAL_SESSION", currentSession), 0);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const i = listeners.indexOf(cb);
            if (i >= 0) listeners.splice(i, 1);
          },
        },
      },
    };
  },
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const r = await api("POST", "/auth/login", { email, password });
      if (!r || !r.token || !r.user) {
        throw new Error(
          "Backend did not return a login token. Check that " +
          `${API}/auth/login is reachable and returns JSON ({ token, user }).`
        );
      }
      setToken(r.token);
      currentSession = makeSession(r.token, r.user);
      saveSession(currentSession);
      // Pre-populate user_roles cache so useAuth's role lookup is instant.
      cache.user_roles = [{ id: uid(), user_id: r.user.id, role: r.user.role }];
      loaded.user_roles = true;
      listeners.forEach((l) => l("SIGNED_IN", currentSession));
      return { data: { session: currentSession, user: currentSession.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: { message: e?.message || "login failed" } };
    }
  },
  async signUp(_: { email: string; password: string }) {
    return { data: { session: null, user: null }, error: { message: "Self sign-up disabled. Ask an admin to create your account." } };
  },
  async signOut() {
    setToken(null);
    currentSession = null;
    saveSession(null);
    // wipe caches so next login pulls fresh data
    for (const k of Object.keys(cache)) delete cache[k];
    for (const k of Object.keys(loaded)) delete loaded[k];
    listeners.forEach((l) => l("SIGNED_OUT", null));
    return { error: null };
  },
  async updateUser(attrs: any) {
    try {
      if (attrs?.password) await api("PATCH", "/auth/password", { password: attrs.password });
      return { data: { user: currentSession?.user ?? null }, error: null };
    } catch (e: any) {
      return { data: { user: currentSession?.user ?? null }, error: { message: e?.message || "Update failed" } };
    }
  },
  async resetPasswordForEmail() {
    return { data: {}, error: { message: "Password reset is handled by your administrator." } };
  },
};

// ---------------- Edge functions (Express-backed) ----------------
const clearTableCache = (...tables: string[]) => {
  for (const table of tables) {
    delete cache[table];
    delete loaded[table];
  }
};

const functionsApi = {
  async invoke(name: string, opts?: { body?: any }) {
    try {
      const data = await api("POST", `/functions/${name}`, opts?.body ?? {});
      clearTableCache("companies", "profiles", "user_roles", "devices", "content", "layouts", "schedules");
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || `Function "${name}" failed` } };
    }
  },
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

// ---------------- Storage (Express-backed) ----------------
const storageApi = {
  from(_bucket: string) {
    return {
      async upload(path: string, file: File) {
        try {
          const data = await fileToBase64(file);
          await api("POST", "/storage/upload", { path, data, contentType: file.type });
          return { data: { path }, error: null };
        } catch (e: any) {
          return { data: null, error: { message: e?.message || "Upload failed" } };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: `/uploads/${path}` } };
      },
      async remove(paths: string[]) {
        try {
          await api("POST", "/storage/remove", { paths });
          return { data: [], error: null };
        } catch (e: any) {
          return { data: null, error: { message: e?.message || "Remove failed" } };
        }
      },
      async list() { return { data: [], error: null }; },
    };
  },
};
// ---------------- Channels (no-op realtime) ----------------
const channelApi = (_name: string) => {
  const ch: any = {
    on: () => ch,
    subscribe: (cb?: any) => { cb?.("SUBSCRIBED"); return ch; },
    unsubscribe: () => Promise.resolve("ok"),
  };
  return ch;
};

// ---------------- Public client ----------------
export const supabase: any = {
  from: (table: string) => new QueryBuilder(table),
  auth: authApi,
  functions: functionsApi,
  storage: storageApi,
  channel: channelApi,
  removeChannel: () => {},
  rpc: async (_fn: string, _args?: any) => ({ data: null, error: null }),
};

