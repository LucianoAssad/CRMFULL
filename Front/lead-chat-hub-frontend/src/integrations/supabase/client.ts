/**
 * API Client - Replaces Supabase SDK
 * Drop-in compatible layer that mimics supabase.from().select/insert/update/delete
 */
import axios, { AxiosInstance } from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "https://daring-balance-production-fc0c.up.railway.app/api";

const api: AxiosInstance = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Add JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 - try refresh
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, {
            refreshToken,
          });
          localStorage.setItem("access_token", data.accessToken);
          localStorage.setItem("refresh_token", data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(error.config);
        } catch {
          // Refresh failed — clear tokens and notify React to clear session.
          // Do NOT hard-redirect (window.location.href) to avoid blank flash.
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          localStorage.removeItem("active_conta_id");
          window.dispatchEvent(new CustomEvent("auth:session-expired"));
        }
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;

// ===== Table mapping for route names =====
const TABLE_ROUTE_MAP: Record<string, string> = {
  empresas: "empresas",
  usuarios: "usuarios",
  usuarios_contas: "usuarios-contas",
  canais_conectados: "canais-conectados",
  canal_contas: "canal-contas",
  leads: "leads",
  conversas: "conversas",
  mensagens: "mensagens",
  conversoes_offline: "conversoes-offline",
  produtos_servicos: "produtos-servicos",
  vendas: "vendas",
  itens_venda: "itens-venda",
  pipelines: "pipelines",
  pipeline_etapas: "pipeline-etapas",
  whatsapp_templates: "whatsapp-templates",
  campanhas: "campanhas",
  campanha_contas: "campanha-contas",
  campanha_destinatarios: "campanha-destinatarios",
  campanha_logs: "campanha-logs",
  opt_outs: "opt-outs",
  eventos_conversa: "eventos-conversa",
  orcamentos: "orcamentos",
  itens_orcamento: "itens-orcamento",
  notas_internas: "notas-internas",
  respostas_rapidas: "respostas-rapidas",
  lead_identidades: "lead-identidades",
  oportunidades: "oportunidades",
  arquivos: "arquivos",
  webhooks_config: "webhooks-config",
  importacoes: "importacoes",
  perfil_comercial: "perfil-comercial",
  audit_logs: "audit-logs",
};

function getRoute(table: string): string {
  return TABLE_ROUTE_MAP[table] || table;
}

/**
 * Supabase-compatible query builder.
 * Usage: supabase.from("leads").select("*").eq("empresa_id", id)
 * This is a compatibility layer - all operations go through REST API.
 */
class QueryBuilder {
  private table: string;
  private route: string;
  private filters: Record<string, string> = {};
  private _select: string = "*";
  private _orderBy: string = "";
  private _orderAsc: boolean = true;
  private _limit: number = 100;
  private _single: boolean = false;
  private _maybeSingle: boolean = false;

  constructor(table: string) {
    this.table = table;
    this.route = getRoute(table);
  }

  select(columns: string = "*") {
    this._select = columns;
    return this;
  }

  eq(column: string, value: any) {
    this.filters[column] = value;
    return this;
  }

  neq(column: string, value: any) {
    this.filters[`${column}__neq`] = value;
    return this;
  }

  in(column: string, values: any[]) {
    this.filters[`${column}__in`] = values.join(",");
    return this;
  }

  or(expression: string) {
    this.filters["_or"] = expression;
    return this;
  }

  order(column: string, opts?: { ascending?: boolean }) {
    this._orderBy = column;
    this._orderAsc = opts?.ascending ?? true;
    return this;
  }

  limit(n: number) {
    this._limit = n;
    return this;
  }

  single() {
    this._single = true;
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    return this;
  }

  async then(resolve: (value: any) => void, reject?: (error: any) => void) {
    try {
      const result = await this.execute();
      resolve(result);
    } catch (error) {
      if (reject) reject(error);
      else resolve({ data: null, error });
    }
  }

  private async execute(): Promise<{ data: any; error: any }> {
    try {
      const params: Record<string, string> = {
        limit: String(this._limit),
      };

      // Add filters as query params
      for (const [key, value] of Object.entries(this.filters)) {
        params[key] = String(value);
      }

      if (this._orderBy) {
        params["_orderBy"] = this._orderBy;
        params["_orderDir"] = this._orderAsc ? "asc" : "desc";
      }

      const { data } = await api.get(`/${this.route}`, { params });

      let result = Array.isArray(data) ? data : [data];

      // Apply client-side filtering for eq/neq/in
      // Backend returns camelCase, but queries may use snake_case — try both
      const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const resolveVal = (r: any, k: string) => {
        const v = r[k];
        if (v !== undefined) return v;
        return r[toCamel(k)];
      };
      for (const [key, value] of Object.entries(this.filters)) {
        if (key.startsWith("_")) continue;
        if (key.includes("__neq")) {
          const col = key.replace("__neq", "");
          result = result.filter((r: any) => resolveVal(r, col) !== value);
        } else if (key.includes("__in")) {
          const col = key.replace("__in", "");
          const vals = String(value).split(",");
          result = result.filter((r: any) => vals.includes(String(resolveVal(r, col))));
        } else {
          result = result.filter(
            (r: any) => String(resolveVal(r, key)) === String(value)
          );
        }
      }

      // Apply ordering
      if (this._orderBy) {
        result.sort((a: any, b: any) => {
          const aVal = a[this._orderBy];
          const bVal = b[this._orderBy];
          if (aVal < bVal) return this._orderAsc ? -1 : 1;
          if (aVal > bVal) return this._orderAsc ? 1 : -1;
          return 0;
        });
      }

      if (this._single || this._maybeSingle) {
        return { data: result[0] || null, error: null };
      }

      return { data: result, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error.message };
    }
  }

  // Insert
  async insert(data: any) {
    try {
      const payload = Array.isArray(data) ? data : data;
      const { data: result } = await api.post(`/${this.route}`, payload);
      return { data: result, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error.message };
    }
  }

  // Update
  async update(data: any) {
    try {
      // If we have an id filter, use PATCH
      const id = this.filters["id"];
      if (id) {
        const { data: result } = await api.patch(
          `/${this.route}/${id}`,
          data
        );
        return { data: result, error: null };
      }
      // Bulk update not supported, return error
      return { data: null, error: "ID required for update" };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error.message };
    }
  }

  // Delete
  async delete() {
    try {
      const id = this.filters["id"];
      if (id) {
        await api.delete(`/${this.route}/${id}`);
        return { data: null, error: null };
      }
      return { data: null, error: "ID required for delete" };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error.message };
    }
  }

  // Upsert
  async upsert(data: any) {
    return this.insert(data);
  }
}

// ===== JWT decode (no API call needed) =====
function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const part = token.split(".")[1];
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Microsoft claim URIs used by .NET
const CLAIM_ID   = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
const CLAIM_EMAIL = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";
const CLAIM_NAME  = "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name";

function sessionFromToken(token: string) {
  const p = decodeJwtPayload(token);
  if (!p) return null;
  // Check expiry
  if (p.exp && p.exp * 1000 < Date.now()) return null;
  return {
    access_token: token,
    user: {
      id:    p[CLAIM_ID]    ?? p.sub ?? "",
      email: p[CLAIM_EMAIL] ?? p.email ?? "",
      user_metadata: { nome: p[CLAIM_NAME] ?? p.name ?? "" },
    },
  };
}

/**
 * Supabase-compatible client object.
 * Maintains the same API surface: supabase.from("table").select().eq()
 */
export const supabase = {
  from: (table: string) => new QueryBuilder(table),

  auth: {
    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      try {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("access_token", data.accessToken);
        localStorage.setItem("refresh_token", data.refreshToken);
        return {
          data: {
            session: {
              access_token: data.accessToken,
              refresh_token: data.refreshToken,
              expires_at: new Date(data.expiresAt).getTime() / 1000,
              user: {
                id: data.usuario.id,
                email: data.usuario.email,
                user_metadata: { nome: data.usuario.nome },
              },
            },
            user: {
              id: data.usuario.id,
              email: data.usuario.email,
              user_metadata: { nome: data.usuario.nome },
            },
          },
          error: null,
        };
      } catch (error: any) {
        return {
          data: { session: null, user: null },
          error: {
            message:
              error.response?.data?.error || "Credenciais inválidas",
          },
        };
      }
    },

    signOut: async () => {
      try {
        await api.post("/auth/logout");
      } catch {
        // ignore
      }
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      localStorage.removeItem("active_conta_id");
    },

    getSession: async () => {
      const token = localStorage.getItem("access_token");
      if (!token) return { data: { session: null }, error: null };
      const session = sessionFromToken(token);
      if (!session) {
        // Token expired — clear it
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        return { data: { session: null }, error: null };
      }
      return { data: { session }, error: null };
    },

    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Check initial state by decoding the stored token — no API call needed
      const token = localStorage.getItem("access_token");
      const session = token ? sessionFromToken(token) : null;
      if (session) {
        setTimeout(() => callback("SIGNED_IN", session), 0);
      } else {
        setTimeout(() => callback("SIGNED_OUT", null), 0);
      }

      // Listen for storage changes (multi-tab support)
      const handler = (e: StorageEvent) => {
        if (e.key === "access_token") {
          if (e.newValue) {
            const s = sessionFromToken(e.newValue);
            callback(s ? "SIGNED_IN" : "SIGNED_OUT", s);
          } else {
            callback("SIGNED_OUT", null);
          }
        }
      };
      window.addEventListener("storage", handler);

      return {
        data: {
          subscription: {
            unsubscribe: () =>
              window.removeEventListener("storage", handler),
          },
        },
      };
    },

    resetPasswordForEmail: async (email: string) => {
      // Not implemented in this version
      return { data: null, error: null };
    },

    updateUser: async (updates: any) => {
      try {
        if (updates.password) {
          await api.post("/auth/change-password", {
            currentPassword: updates.currentPassword || "",
            newPassword: updates.password,
          });
        }
        return { data: null, error: null };
      } catch (error: any) {
        return {
          data: null,
          error: { message: error.response?.data?.error || "Erro" },
        };
      }
    },

    signUp: async ({
      email,
      password,
      options,
    }: {
      email: string;
      password: string;
      options?: { data?: Record<string, any> };
    }) => {
      try {
        const empresaId =
          options?.data?.empresa_id ||
          "00000000-0000-0000-0000-000000000001";
        const { data } = await api.post("/auth/register", {
          nome: options?.data?.nome || email.split("@")[0],
          email,
          password,
          empresaId,
        });
        return {
          data: { user: { id: data.id, email: data.email } },
          error: null,
        };
      } catch (error: any) {
        return {
          data: null,
          error: {
            message: error.response?.data?.error || "Erro no cadastro",
          },
        };
      }
    },
  },

  // Edge functions replacement - maps to API endpoints
  functions: {
    invoke: async (funcName: string, options?: { body?: any }) => {
      const funcMap: Record<string, string> = {
        "whatsapp-send": "/whatsapp/send",
        "whatsapp-webhook": "/whatsapp/webhook",
      };
      const route = funcMap[funcName] || `/functions/${funcName}`;
      try {
        const { data } = await api.post(route, options?.body);
        return { data, error: null };
      } catch (error: any) {
        return { data: error.response?.data, error: error.response?.data || error.message };
      }
    },
  },

  // RPC calls
  rpc: async (funcName: string, params?: any) => {
    try {
      const { data } = await api.post(`/rpc/${funcName}`, params);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: error.response?.data || error.message };
    }
  },

  // Realtime channel (now using SignalR)
  channel: (name: string) => ({
    on: (
      event: string,
      filter: any,
      callback: (payload: any) => void
    ) => ({
      subscribe: () => {
        // SignalR connection is managed separately
        return { unsubscribe: () => {} };
      },
    }),
    subscribe: () => ({ unsubscribe: () => {} }),
  }),

  removeChannel: (channel: any) => {},
};
