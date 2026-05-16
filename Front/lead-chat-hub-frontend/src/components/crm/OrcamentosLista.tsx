import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Eye, Pencil, Send, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { Orcamento, Lead, Conversa } from "@/lib/crm-types";
import { OrcamentoDialog, type OrcamentoDialogMode } from "./OrcamentoDialog";
import { enviarOrcamentoNoChat } from "@/lib/orcamento-mensagem";
import { converterOrcamentoEmVenda, podeConverter } from "@/lib/orcamento-venda";

const STATUS_ENVIAVEIS = new Set(["rascunho", "pdf_gerado", "em_negociacao", "enviado", "reenviado"]);

interface Props {
  empresaId: string;
  lead: Lead | null;
  conversa?: Conversa | null;
}

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  pdf_gerado: "PDF gerado",
  enviado: "Enviado",
  reenviado: "Reenviado",
  em_negociacao: "Em negociação",
  aprovado: "Aprovado",
  recusado: "Recusado",
  expirado: "Expirado",
  convertido_em_venda: "Convertido em venda",
};



export function OrcamentosLista({ empresaId, lead, conversa }: Props) {
  const [orcs, setOrcs] = useState<(Orcamento & { itens_count: number })[]>([]);
  const [vendedores, setVendedores] = useState<Record<string, string>>({});
  const [dialogMode, setDialogMode] = useState<OrcamentoDialogMode>("create");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!empresaId || !lead?.id) { setOrcs([]); return; }
    let q = supabase.from("orcamentos").select("*").eq("empresa_id", empresaId).eq("lead_id", lead.id);
    const { data } = await q.order("created_at", { ascending: false });
    const list = ((data as any[]) ?? []) as Orcamento[];
    if (list.length === 0) { setOrcs([]); return; }
    const ids = list.map((o) => o.id);
    const { data: itens } = await supabase
      .from("orcamento_itens").select("orcamento_id").in("orcamento_id", ids);
    const counts: Record<string, number> = {};
    ((itens as any[]) ?? []).forEach((i) => { counts[i.orcamento_id] = (counts[i.orcamento_id] ?? 0) + 1; });
    setOrcs(list.map((o) => ({ ...o, itens_count: counts[o.id] ?? 0 })));

    const vIds = Array.from(new Set(list.map((o) => o.vendedor_id).filter(Boolean))) as string[];
    if (vIds.length > 0) {
      const { data: us } = await supabase.from("usuarios").select("id, nome").in("id", vIds);
      const map: Record<string, string> = {};
      ((us as any[]) ?? []).forEach((u) => { map[u.id] = u.nome; });
      setVendedores(map);
    }
  }, [empresaId, lead?.id]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setActiveId(null); setDialogMode("create"); setDialogOpen(true); };
  const openView = (id: string) => { setActiveId(id); setDialogMode("view"); setDialogOpen(true); };
  const openEdit = (id: string) => { setActiveId(id); setDialogMode("edit"); setDialogOpen(true); };

  const [enviandoId, setEnviandoId] = useState<string | null>(null);
  const handleEnviar = async (id: string) => {
    setEnviandoId(id);
    try {
      const { reenviado } = await enviarOrcamentoNoChat(id);
      toast.success(reenviado ? "Orçamento reenviado no chat" : "Orçamento enviado no chat");
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar orçamento no chat");
    } finally {
      setEnviandoId(null);
    }
  };

  const [confirmConvId, setConfirmConvId] = useState<string | null>(null);
  const [convertendoId, setConvertendoId] = useState<string | null>(null);
  const handleConverter = async () => {
    const id = confirmConvId;
    if (!id) return;
    setConvertendoId(id);
    try {
      const { jaConvertido } = await converterOrcamentoEmVenda(id);
      toast.success(jaConvertido ? "Orçamento já estava convertido" : "Venda criada a partir do orçamento");
      setConfirmConvId(null);
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao converter em venda");
    } finally {
      setConvertendoId(null);
    }
  };

  if (!lead) {
    return <p className="text-[11px] text-muted-foreground">Selecione uma conversa para ver os orçamentos.</p>;
  }

  return (
    <div className="space-y-3">
      {orcs.length === 0 ? (
        <div className="rounded-md border bg-muted/20 p-3 text-center text-[11px] text-muted-foreground">
          Nenhum orçamento criado para este atendimento.
        </div>
      ) : (
        <ul className="space-y-2">
          {orcs.map((o) => (
            <li key={o.id} className="rounded-md border bg-background p-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">Orçamento #{o.numero}</span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    {o.validade_em && ` · vence ${new Date(o.validade_em).toLocaleDateString("pt-BR")}`}
                    {o.enviado_em && ` · enviado ${new Date(o.enviado_em).toLocaleDateString("pt-BR")}`}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[o.status] ?? o.status}</Badge>
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground">{o.itens_count} item(ns)</span>
                <span className="font-mono font-semibold">{fmtBRL(o.valor_total)}</span>
              </div>

              {o.vendedor_id && vendedores[o.vendedor_id] && (
                <div className="text-[10px] text-muted-foreground">
                  Vendedor: <span className="text-foreground">{vendedores[o.vendedor_id]}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 pt-1">
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openView(o.id)}>
                  <Eye className="mr-1 h-3 w-3" /> Ver
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => openEdit(o.id)}>
                  <Pencil className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-[11px] col-span-2"
                  disabled={!o.conversa_id || !STATUS_ENVIAVEIS.has(o.status) || enviandoId === o.id}
                  onClick={() => handleEnviar(o.id)}
                  title={!o.conversa_id ? "Orçamento sem conversa vinculada" : undefined}
                >
                  <Send className="mr-1 h-3 w-3" />
                  {enviandoId === o.id
                    ? "Enviando..."
                    : (o.status === "enviado" || o.status === "reenviado")
                      ? "Reenviar no chat"
                      : "Enviar no chat"}
                </Button>
                {o.status === "convertido_em_venda" || o.convertido_venda_id ? (
                  <Button size="sm" variant="outline" className="h-7 text-[11px] col-span-2" disabled>
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Convertido em venda
                  </Button>
                ) : (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-[11px] col-span-2"
                    disabled={!podeConverter(o) || convertendoId === o.id}
                    onClick={() => setConfirmConvId(o.id)}
                  >
                    <ShoppingCart className="mr-1 h-3 w-3" />
                    {convertendoId === o.id ? "Convertendo..." : "Converter em venda"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Button size="sm" variant="secondary" className="w-full" onClick={openCreate}>
        <Plus className="mr-1 h-3.5 w-3.5" /> Novo orçamento
      </Button>

      <OrcamentoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        empresaId={empresaId}
        lead={lead}
        conversa={conversa ?? null}
        orcamentoId={activeId}
        onSaved={load}
      />

      <AlertDialog open={!!confirmConvId} onOpenChange={(o) => !o && setConfirmConvId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter orçamento em venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação criará uma venda com os dados do orçamento e marcará o orçamento como convertido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConverter} disabled={!!convertendoId}>
              {convertendoId ? "Convertendo..." : "Converter em venda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
