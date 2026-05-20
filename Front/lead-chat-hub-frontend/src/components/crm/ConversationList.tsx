import { useEffect, useMemo, useState } from "react";
import { Search, MessageCircle, Filter, UserCircle2, Flag, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Canal, Conversa } from "@/lib/crm-types";
import { CONVERSA_STATUS_LABEL, PRIORIDADE_LABEL } from "@/lib/crm-types";
import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  conversas: Conversa[];
  canais: Canal[];
  selectedId: string | null;
  onSelect: (c: Conversa) => void;
}

type SortKey = "ultima" | "nao_lidas" | "recentes" | "antigas_sem_resposta" | "sem_resp" | "prioridade";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "ultima", label: "Última mensagem" },
  { value: "nao_lidas", label: "Não lidas primeiro" },
  { value: "recentes", label: "Iniciadas recentemente" },
  { value: "antigas_sem_resposta", label: "Mais antigas sem resposta" },
  { value: "sem_resp", label: "Sem responsável primeiro" },
  { value: "prioridade", label: "Prioridade alta primeiro" },
];

export function ConversationList({ conversas, canais, selectedId, onSelect }: Props) {
  const { usuarioId } = useAuth();
  const [q, setQ] = useState("");
  const [canalFilter, setCanalFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [respFilter, setRespFilter] = useState<string>("all");
  const [prioFilter, setPrioFilter] = useState<string>("all");
  const [periodoFilter, setPeriodoFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("ultima");
  const [tab, setTab] = useState<string>("todas");
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => {
    const empresaIds = Array.from(new Set(conversas.map((c) => c.empresa_id))).filter(Boolean);
    if (empresaIds.length === 0) { setUsuarios([]); return; }
    supabase.from("usuarios").select("id,nome").in("empresa_id", empresaIds).eq("ativo", true).order("nome")
      .then(({ data }) => setUsuarios((data as any[]) || []));
  }, [conversas.map((c) => c.empresa_id).join(",")]);

  const isForaJanela = (c: Conversa) => {
    if (c.canal?.tipo !== "whatsapp" || c.canal?.provider !== "cloud_api") return false;
    if (!c.ultima_mensagem_em) return false;
    return (Date.now() - new Date(c.ultima_mensagem_em).getTime()) / 3_600_000 >= 24;
  };

  const tabCounts = useMemo(() => ({
    todas: conversas.length,
    minha: conversas.filter((c) => usuarioId && c.responsavel_id === usuarioId).length,
    sem_resp: conversas.filter((c) => !c.responsavel_id).length,
    nao_lidas: conversas.filter((c) => (c.nao_lidas ?? 0) > 0).length,
  }), [conversas, usuarioId]);

  const filtered = useMemo(() => {
    const periodMs: Record<string, number> = { "24h": 86400000, "7d": 7 * 86400000, "30d": 30 * 86400000 };
    const now = Date.now();
    const list = conversas.filter((c) => {
      const matchesQ =
        !q ||
        c.lead?.nome.toLowerCase().includes(q.toLowerCase()) ||
        c.lead?.telefone?.includes(q) ||
        c.lead?.telefone?.replace(/\D/g, "").includes(q.replace(/\D/g, "")) ||
        c.ultima_mensagem?.toLowerCase().includes(q.toLowerCase());
      const matchesCanal = canalFilter === "all" || c.canal_id === canalFilter;
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesResp =
        respFilter === "all" ||
        (respFilter === "none" ? !c.responsavel_id : c.responsavel_id === respFilter);
      const matchesPrio = prioFilter === "all" || (c.prioridade ?? "normal") === prioFilter;
      const matchesPeriodo = periodoFilter === "all" || !periodMs[periodoFilter] ||
        (c.ultima_mensagem_em && now - new Date(c.ultima_mensagem_em).getTime() <= periodMs[periodoFilter]);
      const matchesTab =
        tab === "todas" ? true :
        tab === "minha" ? !!usuarioId && c.responsavel_id === usuarioId :
        tab === "sem_resp" ? !c.responsavel_id :
        tab === "nao_lidas" ? (c.nao_lidas ?? 0) > 0 : true;
      return matchesQ && matchesCanal && matchesStatus && matchesResp && matchesPrio && matchesPeriodo && matchesTab;
    });

    const tsUltima = (c: Conversa) => c.ultima_mensagem_em ? new Date(c.ultima_mensagem_em).getTime() : 0;
    const tsCriada = (c: Conversa) => (c as any).created_at ? new Date((c as any).created_at).getTime() : tsUltima(c);
    const prioRank: Record<string, number> = { urgente: 4, alta: 3, normal: 2, baixa: 1 };

    return list.sort((a, b) => {
      switch (sortBy) {
        case "nao_lidas": {
          const an = (a.nao_lidas ?? 0) > 0 ? 1 : 0;
          const bn = (b.nao_lidas ?? 0) > 0 ? 1 : 0;
          if (an !== bn) return bn - an;
          return tsUltima(b) - tsUltima(a);
        }
        case "recentes":
          return tsCriada(b) - tsCriada(a);
        case "antigas_sem_resposta":
          return tsUltima(a) - tsUltima(b);
        case "sem_resp": {
          const ar = !a.responsavel_id ? 1 : 0;
          const br = !b.responsavel_id ? 1 : 0;
          if (ar !== br) return br - ar;
          return tsUltima(b) - tsUltima(a);
        }
        case "prioridade": {
          const pa = prioRank[a.prioridade ?? "normal"] ?? 2;
          const pb = prioRank[b.prioridade ?? "normal"] ?? 2;
          if (pa !== pb) return pb - pa;
          return tsUltima(b) - tsUltima(a);
        }
        case "ultima":
        default:
          return tsUltima(b) - tsUltima(a);
      }
    });
  }, [conversas, q, canalFilter, statusFilter, respFilter, prioFilter, periodoFilter, tab, usuarioId, sortBy]);

  const usuariosMap = useMemo(() => {
    const m: Record<string, string> = {};
    usuarios.forEach((u) => { m[u.id] = u.nome; });
    return m;
  }, [usuarios]);

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-r bg-card">
      <div className="bg-[hsl(var(--sidebar-header))] px-4 py-3 text-primary-foreground">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          <div className="flex flex-col">
            <h1 className="text-base font-semibold leading-tight">Inbox</h1>
            <p className="text-[11px] leading-tight opacity-80">Conversas desta conta</p>
          </div>
        </div>
      </div>
      <div className="border-b">
        <Tabs value={tab} onValueChange={setTab}>
          <div className="overflow-x-auto px-2 pt-2 pb-2">
            <TabsList className="inline-flex h-auto w-auto bg-transparent p-0 gap-1">
              {[
                { v: "todas", l: "Todas", n: tabCounts.todas },
                { v: "minha", l: "Minha caixa", n: tabCounts.minha },
                { v: "sem_resp", l: "Sem responsável", n: tabCounts.sem_resp },
                { v: "nao_lidas", l: "Não lidas", n: tabCounts.nao_lidas },
              ].map((t) => (
                <TabsTrigger
                  key={t.v}
                  value={t.v}
                  className="h-7 whitespace-nowrap rounded-full border bg-background px-2.5 text-[11px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary"
                >
                  {t.l} <span className="ml-1 opacity-60">{t.n}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>
      <div className="space-y-2 border-b p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar conversas..."
            className="h-9 pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Select value={canalFilter} onValueChange={setCanalFilter}>
            <SelectTrigger className="h-8 text-xs"><Filter className="mr-1 h-3 w-3" /><SelectValue placeholder="Canal" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os canais</SelectItem>
              {canais.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(CONVERSA_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={respFilter} onValueChange={setRespFilter}>
            <SelectTrigger className="h-8 text-xs"><UserCircle2 className="mr-1 h-3 w-3" /><SelectValue placeholder="Responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos responsáveis</SelectItem>
              <SelectItem value="none">Sem responsável</SelectItem>
              {usuarios.map((u) => <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prioFilter} onValueChange={setPrioFilter}>
            <SelectTrigger className="h-8 text-xs"><Flag className="mr-1 h-3 w-3" /><SelectValue placeholder="Prioridade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas prioridades</SelectItem>
              {Object.entries(PRIORIDADE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodoFilter} onValueChange={setPeriodoFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo período</SelectItem>
              <SelectItem value="24h">Últimas 24h</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-8 text-xs"><ArrowUpDown className="mr-1 h-3 w-3" /><SelectValue placeholder="Ordenar por" /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {conversas.length === 0
              ? "Nenhuma conversa encontrada nesta conta."
              : "Nenhuma conversa corresponde aos filtros aplicados."}
          </div>
        )}
        {filtered.map((c) => (
          <ConvItem
            key={c.id}
            c={c}
            active={c.id === selectedId}
            responsavelNome={c.responsavel_id ? usuariosMap[c.responsavel_id] : null}
            foraJanela={isForaJanela(c)}
            onClick={() => onSelect(c)}
          />
        ))}
      </div>
    </aside>
  );
}

type BadgeSpec = { key: string; label: string; className: string };

function buildBadges(c: Conversa, foraJanela: boolean, hasResponsavel: boolean): BadgeSpec[] {
  const all: BadgeSpec[] = [];

  // 1. Pendente de conta filha — prioridade máxima
  if (c.conta_filha_pendente) {
    all.push({
      key: "conta",
      label: "⚠ Definir conta",
      className: "border-amber-500/50 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    });
  }

  // 2. Status da conversa — somente se diferente de "aberta" (estado normal)
  if (c.status && c.status !== "aberta") {
    all.push({
      key: "status",
      label: CONVERSA_STATUS_LABEL[c.status] ?? c.status,
      className: "border-border bg-muted text-muted-foreground",
    });
  }

  // 3. Fora da janela 24h
  if (foraJanela) {
    all.push({
      key: "janela",
      label: "Expirado",
      className: "border-amber-500/50 bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
    });
  }

  // 4. Erro de envio
  if ((c as any).erro_envio) {
    all.push({
      key: "erro",
      label: "Erro envio",
      className: "border-destructive/40 bg-destructive/10 text-destructive",
    });
  }

  // Ocultos (não exibir): canal/provider técnico, score, campanha — apenas os 3 acima são permitidos
  // Máximo 2 badges visíveis
  return all.slice(0, 2);
}

function ConvItem({
  c, active, onClick, responsavelNome, foraJanela,
}: {
  c: Conversa; active: boolean; onClick: () => void; responsavelNome?: string | null; foraJanela: boolean;
}) {
  const initials = (c.lead?.nome || "?").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const time = c.ultima_mensagem_em
    ? formatDistanceToNowStrict(new Date(c.ultima_mensagem_em), { locale: ptBR, addSuffix: false })
    : "";
  const empresa = c.lead?.nome_fantasia || c.lead?.razao_social || null;
  const badges = buildBadges(c, foraJanela, !!responsavelNome);

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-left transition hover:bg-muted/50",
        active && "bg-accent",
        c.conta_filha_pendente && "border-l-4 border-l-amber-500 bg-amber-50/40 dark:bg-amber-950/20",
      )}
    >
      <Avatar className="h-9 w-9">
        <AvatarFallback className="bg-gradient-to-br from-primary to-[hsl(var(--primary-glow))] text-xs text-primary-foreground">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-medium text-foreground">{c.lead?.nome}</h3>
          <span className="shrink-0 text-[10px] text-muted-foreground">{time}</span>
        </div>
        {empresa && (
          <p className="truncate text-[11px] text-muted-foreground">{empresa}</p>
        )}
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <p className="truncate text-xs text-muted-foreground">{c.ultima_mensagem || "Sem mensagens"}</p>
          {c.nao_lidas > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {c.nao_lidas}
            </span>
          )}
        </div>
        {badges.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {badges.map((b) => (
              <span
                key={b.key}
                className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", b.className)}
              >
                {b.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
