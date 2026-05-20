import React, { useEffect, useState } from "react";
import { Plus, Trash2, GripVertical, Bot, ChevronDown, ChevronUp, Clock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface Fluxo {
  id: string;
  empresa_id: string;
  canal_id: string | null;
  nome: string;
  tipo: string;
  configuracao: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  dias_semana: string | null;
  ativo: boolean;
  ordem: number;
}

interface Canal { id: string; nome: string; tipo: string; identificador: string | null }

// Configuração de mensagens (saudação / menu)
interface MsgConfig { conteudo: string; delay_s: number }
interface RegraConfig { palavra_chave: string; resposta: string; exato: boolean }
interface MenuOpcao { numero: number; label: string; resposta: string }

const TIPOS_FLUXO = [
  { v: "saudacao", l: "Saudação automática", desc: "Mensagens enviadas ao primeiro contato" },
  { v: "menu",     l: "Menu interativo",     desc: "Opções numeradas que o cliente responde" },
  { v: "regras",   l: "Respostas por palavra-chave", desc: "Responde automaticamente a palavras-chave" },
  { v: "ia",       l: "Assistente IA",       desc: "GPT responde automaticamente (requer token OpenAI)" },
  { v: "horario",  l: "Fora do horário",     desc: "Mensagem quando fora do horário de atendimento" },
];

const DIAS = [
  { v: "0", l: "Dom" }, { v: "1", l: "Seg" }, { v: "2", l: "Ter" },
  { v: "3", l: "Qua" }, { v: "4", l: "Qui" }, { v: "5", l: "Sex" },
  { v: "6", l: "Sáb" },
];

// ── Página ────────────────────────────────────────────────────────────────────
export default function ChatbotFluxos() {
  const { activeContaId, scopedContaIds } = useActiveAccount();
  const ids = activeContaId ? [activeContaId] : scopedContaIds;

  const [fluxos, setFluxos]   = useState<Fluxo[]>([]);
  const [canais, setCanais]   = useState<Canal[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("saudacao");

  const load = async () => {
    if (ids.length === 0) { setFluxos([]); setLoading(false); return; }
    setLoading(true);
    const [f, c] = await Promise.all([
      supabase.from("chatbot_fluxos").select("*").in("empresa_id", ids).order("ordem"),
      supabase.from("canais_conectados").select("id,nome,tipo,identificador").in("empresa_id", ids).eq("ativo", true),
    ]);
    setFluxos((f.data as any) || []);
    setCanais((c.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ids.join(",")]);

  const createFluxo = async (tipo: string) => {
    if (ids.length === 0) return;
    const defaultCfg: Record<string, any> = {
      saudacao: { mensagens: [{ conteudo: "Olá {{nome}}! Como posso ajudar?", delay_s: 0 }] },
      menu:     { cabecalho: "Olá! Como posso ajudar?", opcoes: [{ numero: 1, label: "Falar com atendente", resposta: "Um momento, vou transferir para um atendente." }] },
      regras:   { regras: [{ palavra_chave: "preco", resposta: "Nossos preços variam. Qual serviço você tem interesse?", exato: false }] },
      ia:       { prompt_sistema: "Você é um assistente de atendimento. Responda de forma educada e objetiva.", modelo: "gpt-3.5-turbo", token_openai: "" },
      horario:  { mensagens: [{ conteudo: "Olá! Nosso horário de atendimento é de seg-sex das 9h às 18h. Retornaremos em breve!", delay_s: 0 }] },
    };
    const payload: any = {
      empresa_id: ids[0],
      nome: TIPOS_FLUXO.find((t) => t.v === tipo)?.l ?? tipo,
      tipo,
      configuracao: JSON.stringify(defaultCfg[tipo] || {}),
      ativo: false,
      ordem: fluxos.filter((f) => f.tipo === tipo).length,
    };
    const { error } = await supabase.from("chatbot_fluxos").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Fluxo criado");
    load();
  };

  const saveFluxo = async (fluxo: Fluxo) => {
    const { error } = await supabase.from("chatbot_fluxos").update({
      nome: fluxo.nome,
      canal_id: fluxo.canal_id,
      configuracao: fluxo.configuracao,
      horario_inicio: fluxo.horario_inicio,
      horario_fim: fluxo.horario_fim,
      dias_semana: fluxo.dias_semana,
      ativo: fluxo.ativo,
      updated_at: new Date().toISOString(),
    } as any).eq("id", fluxo.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Fluxo salvo");
    load();
  };

  const deleteFluxo = async (id: string) => {
    if (!confirm("Excluir este fluxo?")) return;
    await supabase.from("chatbot_fluxos").delete().eq("id", id);
    toast.success("Fluxo excluído");
    load();
  };

  const tipoFluxos = (tipo: string) => fluxos.filter((f) => f.tipo === tipo);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Bot className="h-6 w-6" /> Chatbot & Fluxos</h1>
          <p className="text-sm text-muted-foreground">Configure respostas automáticas, saudações e menus interativos</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TIPOS_FLUXO.map((t) => (
            <TabsTrigger key={t.v} value={t.v} className="text-xs">
              {t.l}
              {tipoFluxos(t.v).filter((f) => f.ativo).length > 0 && (
                <Badge className="ml-1.5 h-4 min-w-4 text-[9px] px-1">{tipoFluxos(t.v).filter((f) => f.ativo).length}</Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {TIPOS_FLUXO.map((tipoMeta) => (
          <TabsContent key={tipoMeta.v} value={tipoMeta.v} className="pt-3 space-y-3">
            <div className="flex items-start justify-between">
              <p className="text-sm text-muted-foreground">{tipoMeta.desc}</p>
              <Button size="sm" onClick={() => createFluxo(tipoMeta.v)}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Novo fluxo
              </Button>
            </div>

            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : tipoFluxos(tipoMeta.v).length === 0 ? (
              <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground text-sm">
                Nenhum fluxo de "{tipoMeta.l}" configurado.
              </div>
            ) : tipoFluxos(tipoMeta.v).map((fluxo) => (
              <FluxoCard
                key={fluxo.id}
                fluxo={fluxo}
                canais={canais}
                onChange={(updated) => setFluxos((prev) => prev.map((f) => f.id === fluxo.id ? updated : f))}
                onSave={() => saveFluxo(fluxo)}
                onDelete={() => deleteFluxo(fluxo.id)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ── Card de fluxo ─────────────────────────────────────────────────────────────
function FluxoCard({ fluxo, canais, onChange, onSave, onDelete }: {
  fluxo: Fluxo;
  canais: Canal[];
  onChange: (f: Fluxo) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const upd = (k: keyof Fluxo, v: any) => onChange({ ...fluxo, [k]: v });

  let cfg: any = {};
  try { cfg = JSON.parse(fluxo.configuracao || "{}"); } catch { /**/ }
  const saveCfg = (newCfg: any) => upd("configuracao", JSON.stringify(newCfg));

  const diasAtivos = (fluxo.dias_semana || "1,2,3,4,5").split(",").filter(Boolean);
  const toggleDia = (d: string) => {
    const set = new Set(diasAtivos);
    set.has(d) ? set.delete(d) : set.add(d);
    upd("dias_semana", Array.from(set).sort().join(","));
  };

  return (
    <Card className={cn("transition-colors", fluxo.ativo ? "border-primary/30" : "")}>
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              value={fluxo.nome}
              onChange={(e) => { e.stopPropagation(); upd("nome", e.target.value); }}
              onClick={(e) => e.stopPropagation()}
              className="h-7 border-none p-0 text-sm font-medium shadow-none focus-visible:ring-0 bg-transparent"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={fluxo.ativo ? "border-success/40 text-success bg-success/5" : ""}>
              {fluxo.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <Switch checked={fluxo.ativo} onCheckedChange={(v) => upd("ativo", v)} onClick={(e) => e.stopPropagation()} />
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 pt-0">
          {/* Canal */}
          <div className="space-y-1">
            <Label className="text-xs">Canal (deixe em branco para todos)</Label>
            <Select value={fluxo.canal_id || "todos"} onValueChange={(v) => upd("canal_id", v === "todos" ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os canais</SelectItem>
                {canais.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome} ({c.tipo}){c.identificador ? ` · ${c.identificador}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horário de funcionamento */}
          <div className="space-y-2">
            <Label className="text-xs">Dias de funcionamento</Label>
            <div className="flex gap-1 flex-wrap">
              {DIAS.map((d) => (
                <button
                  key={d.v}
                  type="button"
                  onClick={() => toggleDia(d.v)}
                  className={cn(
                    "rounded px-2 py-1 text-xs border transition-colors",
                    diasAtivos.includes(d.v)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/40",
                  )}
                >
                  {d.l}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Início do horário</Label>
                <Input type="time" value={fluxo.horario_inicio || ""} onChange={(e) => upd("horario_inicio", e.target.value || null)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fim do horário</Label>
                <Input type="time" value={fluxo.horario_fim || ""} onChange={(e) => upd("horario_fim", e.target.value || null)} />
              </div>
            </div>
          </div>

          {/* Configuração específica por tipo */}
          {fluxo.tipo === "saudacao" || fluxo.tipo === "horario" ? (
            <SaudacaoConfig cfg={cfg} onChange={saveCfg} />
          ) : fluxo.tipo === "menu" ? (
            <MenuConfig cfg={cfg} onChange={saveCfg} />
          ) : fluxo.tipo === "regras" ? (
            <RegrasConfig cfg={cfg} onChange={saveCfg} />
          ) : fluxo.tipo === "ia" ? (
            <IaConfig cfg={cfg} onChange={saveCfg} />
          ) : null}

          <div className="flex justify-between pt-2">
            <Button size="sm" variant="destructive" onClick={onDelete}><Trash2 className="mr-1 h-3.5 w-3.5" /> Excluir</Button>
            <Button size="sm" onClick={onSave}>Salvar fluxo</Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ── Sub-configs ───────────────────────────────────────────────────────────────
function SaudacaoConfig({ cfg, onChange }: { cfg: any; onChange: (c: any) => void }) {
  const msgs: MsgConfig[] = cfg.mensagens || [{ conteudo: "", delay_s: 0 }];
  const setMsgs = (m: MsgConfig[]) => onChange({ ...cfg, mensagens: m });
  return (
    <div className="space-y-2">
      <Label className="text-xs">Mensagens <span className="text-muted-foreground">(máx. 5)</span></Label>
      {msgs.map((m, i) => (
        <div key={i} className="rounded border p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Msg {i + 1}</span>
            {msgs.length > 1 && (
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setMsgs(msgs.filter((_, j) => j !== i))}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Textarea rows={2} value={m.conteudo} onChange={(e) => setMsgs(msgs.map((x, j) => j === i ? { ...x, conteudo: e.target.value } : x))} placeholder="Olá {{nome}}, como posso ajudar?" className="text-xs" />
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Delay (s)</Label>
            <Input type="number" min={0} max={300} value={m.delay_s} onChange={(e) => setMsgs(msgs.map((x, j) => j === i ? { ...x, delay_s: Number(e.target.value) } : x))} className="h-7 w-20 text-xs" />
          </div>
        </div>
      ))}
      {msgs.length < 5 && (
        <Button size="sm" variant="outline" onClick={() => setMsgs([...msgs, { conteudo: "", delay_s: 5 }])}>
          <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar mensagem
        </Button>
      )}
      <p className="text-[11px] text-muted-foreground">Variáveis: <code>{"{{nome}}"}</code> <code>{"{{telefone}}"}</code></p>
    </div>
  );
}

function MenuConfig({ cfg, onChange }: { cfg: any; onChange: (c: any) => void }) {
  const opcoes: MenuOpcao[] = cfg.opcoes || [];
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Mensagem do menu</Label>
        <Textarea rows={2} value={cfg.cabecalho || ""} onChange={(e) => onChange({ ...cfg, cabecalho: e.target.value })} placeholder="Olá! Como posso ajudar?" className="text-xs" />
      </div>
      <Label className="text-xs">Opções</Label>
      {opcoes.map((o, i) => (
        <div key={i} className="rounded border p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{o.numero}</span>
            <Input value={o.label} onChange={(e) => onChange({ ...cfg, opcoes: opcoes.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder="Rótulo" className="h-7 text-xs flex-1" />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange({ ...cfg, opcoes: opcoes.filter((_, j) => j !== i) })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <Textarea rows={1} value={o.resposta} onChange={(e) => onChange({ ...cfg, opcoes: opcoes.map((x, j) => j === i ? { ...x, resposta: e.target.value } : x) })} placeholder="Resposta automática..." className="text-xs" />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange({ ...cfg, opcoes: [...opcoes, { numero: opcoes.length + 1, label: "", resposta: "" }] })}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar opção
      </Button>
    </div>
  );
}

function RegrasConfig({ cfg, onChange }: { cfg: any; onChange: (c: any) => void }) {
  const regras: RegraConfig[] = cfg.regras || [];
  return (
    <div className="space-y-2">
      <Label className="text-xs">Regras de palavra-chave</Label>
      {regras.map((r, i) => (
        <div key={i} className="rounded border p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Input value={r.palavra_chave} onChange={(e) => onChange({ ...cfg, regras: regras.map((x, j) => j === i ? { ...x, palavra_chave: e.target.value } : x) })} placeholder="Palavra-chave..." className="h-7 text-xs" />
            <div className="flex items-center gap-1 whitespace-nowrap text-xs">
              <Switch checked={r.exato} onCheckedChange={(v) => onChange({ ...cfg, regras: regras.map((x, j) => j === i ? { ...x, exato: v } : x) })} />
              <span>Exato</span>
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange({ ...cfg, regras: regras.filter((_, j) => j !== i) })}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          <Textarea rows={1} value={r.resposta} onChange={(e) => onChange({ ...cfg, regras: regras.map((x, j) => j === i ? { ...x, resposta: e.target.value } : x) })} placeholder="Resposta automática..." className="text-xs" />
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onChange({ ...cfg, regras: [...regras, { palavra_chave: "", resposta: "", exato: false }] })}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar regra
      </Button>
    </div>
  );
}

function IaConfig({ cfg, onChange }: { cfg: any; onChange: (c: any) => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="text-xs">Prompt do sistema</Label>
        <Textarea rows={4} value={cfg.prompt_sistema || ""} onChange={(e) => onChange({ ...cfg, prompt_sistema: e.target.value })} placeholder="Você é um assistente de atendimento da empresa X. Responda de forma educada..." className="text-xs" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Modelo</Label>
        <Select value={cfg.modelo || "gpt-3.5-turbo"} onValueChange={(v) => onChange({ ...cfg, modelo: v })}>
          <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (mais rápido)</SelectItem>
            <SelectItem value="gpt-4o-mini">GPT-4o Mini (equilibrado)</SelectItem>
            <SelectItem value="gpt-4o">GPT-4o (melhor qualidade)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Token OpenAI</Label>
        <Input type="password" value={cfg.token_openai || ""} onChange={(e) => onChange({ ...cfg, token_openai: e.target.value })} placeholder="sk-..." className="text-xs font-mono" />
        <p className="text-[11px] text-muted-foreground">Gere em: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="underline">platform.openai.com/api-keys</a></p>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Mensagem de escalonamento</Label>
        <Input value={cfg.mensagem_escalonamento || ""} onChange={(e) => onChange({ ...cfg, mensagem_escalonamento: e.target.value })} placeholder="Vou transferir para um atendente. Aguarde!" className="text-xs" />
        <p className="text-[11px] text-muted-foreground">Enviada quando o cliente digitar "atendente" ou "humano".</p>
      </div>
    </div>
  );
}
