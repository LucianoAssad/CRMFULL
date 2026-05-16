import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Target, GitBranch, ShoppingCart, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NovaOportunidadeDialog } from "./NovaOportunidadeDialog";

interface Props {
  empresaId: string;
  leadId: string;
  conversaId?: string | null;
  canalOrigem?: string | null;
  origem?: string | null;
  compact?: boolean;
}

interface Oportunidade {
  id: string;
  titulo: string;
  status: string;
  valor_estimado: number;
  produto_id: string | null;
  pipeline_id: string | null;
  etapa_id: string | null;
  origem: string | null;
  responsavel_id: string | null;
  created_at: string;
  updated_at: string;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  aberta: "default", ganha: "secondary", perdida: "destructive", cancelada: "outline",
};

export function OportunidadesLead({ empresaId, leadId, conversaId, canalOrigem, origem, compact }: Props) {
  const navigate = useNavigate();
  const [opps, setOpps] = useState<Oportunidade[]>([]);
  const [etapas, setEtapas] = useState<Record<string, { nome: string; cor: string }>>({});
  const [pipelines, setPipelines] = useState<Record<string, string>>({});
  const [produtos, setProdutos] = useState<Record<string, string>>({});
  const [usuarios, setUsuarios] = useState<Record<string, string>>({});
  const [vendasPorOpp, setVendasPorOpp] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!empresaId || !leadId) return;
    const { data } = await supabase
      .from("oportunidades")
      .select("*")
      .eq("empresa_id", empresaId)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    const list = (data as any[]) || [];
    setOpps(list);

    if (list.length === 0) {
      setEtapas({}); setPipelines({}); setProdutos({}); setUsuarios({}); setVendasPorOpp({});
      return;
    }
    const etapaIds = Array.from(new Set(list.map((o) => o.etapa_id).filter(Boolean) as string[]));
    const pipeIds = Array.from(new Set(list.map((o) => o.pipeline_id).filter(Boolean) as string[]));
    const prodIds = Array.from(new Set(list.map((o) => o.produto_id).filter(Boolean) as string[]));
    const userIds = Array.from(new Set(list.map((o) => o.responsavel_id).filter(Boolean) as string[]));
    const oppIds = list.map((o) => o.id);

    const [et, pi, pr, us, vd] = await Promise.all([
      etapaIds.length ? supabase.from("pipeline_etapas").select("id,nome,cor").in("id", etapaIds) : { data: [] } as any,
      pipeIds.length ? supabase.from("pipelines").select("id,nome").in("id", pipeIds) : { data: [] } as any,
      prodIds.length ? supabase.from("produtos_servicos").select("id,nome").in("id", prodIds) : { data: [] } as any,
      userIds.length ? supabase.from("usuarios").select("id,nome").in("id", userIds) : { data: [] } as any,
      supabase.from("vendas").select("id,oportunidade_id").in("oportunidade_id", oppIds),
    ]);
    const em: Record<string, { nome: string; cor: string }> = {};
    (et.data as any[] || []).forEach((e) => { em[e.id] = { nome: e.nome, cor: e.cor }; });
    setEtapas(em);
    const pm: Record<string, string> = {};
    (pi.data as any[] || []).forEach((p) => { pm[p.id] = p.nome; });
    setPipelines(pm);
    const prm: Record<string, string> = {};
    (pr.data as any[] || []).forEach((p) => { prm[p.id] = p.nome; });
    setProdutos(prm);
    const um: Record<string, string> = {};
    (us.data as any[] || []).forEach((u) => { um[u.id] = u.nome; });
    setUsuarios(um);
    const vm: Record<string, number> = {};
    (vd.data as any[] || []).forEach((v) => { if (v.oportunidade_id) vm[v.oportunidade_id] = (vm[v.oportunidade_id] || 0) + 1; });
    setVendasPorOpp(vm);
  }, [empresaId, leadId]);

  useEffect(() => { load(); }, [load]);

  const totais = opps.reduce(
    (acc, o) => {
      acc.total++;
      if (o.status === "aberta") { acc.abertas++; acc.valorAberto += Number(o.valor_estimado || 0); }
      if (o.status === "ganha") { acc.ganhas++; acc.valorGanho += Number(o.valor_estimado || 0); }
      if (o.status === "perdida") acc.perdidas++;
      return acc;
    },
    { total: 0, abertas: 0, ganhas: 0, perdidas: 0, valorAberto: 0, valorGanho: 0 }
  );

  if (compact) {
    const ativa = opps.find((o) => o.status === "aberta") ?? opps[0];
    if (!ativa) {
      return (
        <div className="space-y-2">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Status comercial
          </div>
          <div className="rounded-md border bg-muted/20 p-2 space-y-1">
            <p className="text-xs font-medium">Aguardando intenção comercial.</p>
            <p className="text-[10px] text-muted-foreground">
              A oportunidade será criada automaticamente ao criar um orçamento.
            </p>
          </div>
          <NovaOportunidadeDialog
            empresaId={empresaId} leadId={leadId} conversaId={conversaId}
            canalOrigem={canalOrigem} origem={origem}
            onCreated={load}
            simple
            trigger={
              <Button variant="link" size="sm" className="h-auto px-0 text-[11px] text-muted-foreground hover:text-foreground">
                Criar oportunidade manualmente
              </Button>
            }
          />
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Oportunidade ativa
        </div>
        <div className="rounded-md border bg-background p-2 space-y-1 text-xs">
          <div className="font-medium truncate">{ativa.titulo}</div>
          {ativa.etapa_id && etapas[ativa.etapa_id] && (
            <div className="text-[11px] text-muted-foreground">
              Etapa: <span className="text-foreground" style={{ color: etapas[ativa.etapa_id].cor }}>{etapas[ativa.etapa_id].nome}</span>
            </div>
          )}
          {Number(ativa.valor_estimado) > 0 && (
            <div className="text-[11px] text-muted-foreground">
              Valor: <span className="font-mono font-semibold text-foreground">{fmtBRL(Number(ativa.valor_estimado))}</span>
            </div>
          )}
          <div className="text-[11px] text-muted-foreground">
            Próxima ação: <span className="text-foreground">Criar orçamento</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Venda será preferencialmente registrada a partir de orçamento.<br />
          Conversão automática em etapa futura.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          Oportunidades {opps.length > 0 && <span className="text-muted-foreground">({opps.length})</span>}
        </h3>
        <NovaOportunidadeDialog
          empresaId={empresaId} leadId={leadId} conversaId={conversaId}
          canalOrigem={canalOrigem} origem={origem}
          onCreated={load}
        />
      </div>

      {opps.length > 0 && !compact && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-[10px] uppercase text-muted-foreground">Abertas</div>
            <div className="font-semibold">{totais.abertas}</div>
            <div className="text-[10px] text-muted-foreground">{fmtBRL(totais.valorAberto)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-[10px] uppercase text-muted-foreground">Ganhas</div>
            <div className="font-semibold">{totais.ganhas}</div>
            <div className="text-[10px] text-muted-foreground">{fmtBRL(totais.valorGanho)}</div>
          </div>
          <div className="rounded-md border bg-muted/30 p-2">
            <div className="text-[10px] uppercase text-muted-foreground">Perdidas</div>
            <div className="font-semibold">{totais.perdidas}</div>
          </div>
        </div>
      )}

      {opps.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">Este cliente ainda não possui oportunidades.</p>
      ) : (
        <ul className="space-y-1.5">
          {opps.map((o) => (
            <li key={o.id} className="rounded-md border bg-background p-2 text-xs space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{o.titulo}</div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap gap-1">
                    {o.pipeline_id && pipelines[o.pipeline_id] && (
                      <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" /> {pipelines[o.pipeline_id]}</span>
                    )}
                    {o.etapa_id && etapas[o.etapa_id] && (
                      <span style={{ color: etapas[o.etapa_id].cor }}>· {etapas[o.etapa_id].nome}</span>
                    )}
                    {o.produto_id && produtos[o.produto_id] && <span>· {produtos[o.produto_id]}</span>}
                  </div>
                </div>
                <Badge variant={STATUS_VARIANT[o.status]} className="text-[10px] shrink-0">{o.status}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold">{fmtBRL(Number(o.valor_estimado))}</span>
                <div className="flex items-center gap-1">
                  {vendasPorOpp[o.id] ? (
                    <Badge variant="outline" className="text-[9px]">{compact ? "Venda existente" : "Venda registrada"}</Badge>
                  ) : o.status === "aberta" && !compact ? (
                    <Button
                      size="sm" variant="ghost" className="h-6 px-2 text-[11px]"
                      onClick={() => navigate(`/account/vendas?oportunidade=${o.id}`)}
                    >
                      <ShoppingCart className="mr-1 h-3 w-3" /> Registrar venda
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" className="h-6 px-2"
                    onClick={() => navigate(`/account/pipeline?oportunidade=${o.id}`)}
                    title="Abrir no Pipeline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              {o.responsavel_id && usuarios[o.responsavel_id] && (
                <div className="text-[10px] text-muted-foreground">Resp.: {usuarios[o.responsavel_id]}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
