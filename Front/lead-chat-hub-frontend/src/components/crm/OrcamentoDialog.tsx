import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { EmpresaPerfilComercial, Lead, Conversa, Orcamento, OrcamentoItem } from "@/lib/crm-types";
import { enviarOrcamentoNoChat } from "@/lib/orcamento-mensagem";
import { converterOrcamentoEmVenda } from "@/lib/orcamento-venda";

export type OrcamentoDialogMode = "create" | "edit" | "view";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: OrcamentoDialogMode;
  empresaId: string;
  lead: Lead | null;
  conversa?: Conversa | null;
  orcamentoId?: string | null;
  onSaved?: () => void;
}

interface ItemForm {
  id?: string;
  produto_id: string | null;
  categoria: string;
  descricao: string;
  servico: string;
  quantidade: number;
  unidade: string;
  medida: string;
  material: string;
  nivel_sujeira: string;
  valor_unitario: number;
  desconto: number;
  observacao_tecnica: string;
  ordem: number;
}

interface ProdutoServico {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string;
  valor_padrao: number;
}

const ITEM_VAZIO = (ordem: number): ItemForm => ({
  produto_id: null,
  categoria: "", descricao: "", servico: "", quantidade: 1, unidade: "un",
  medida: "", material: "", nivel_sujeira: "", valor_unitario: 0, desconto: 0,
  observacao_tecnica: "", ordem,
});

const fmtBRL = (n: number) =>
  Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PREP_MSG = "Recurso em preparação. Será implementado em uma próxima etapa.";

export function OrcamentoDialog({
  open, onOpenChange, mode, empresaId, lead, conversa, orcamentoId, onSaved,
}: Props) {
  const readOnly = mode === "view";

  const [perfil, setPerfil] = useState<EmpresaPerfilComercial | null>(null);
  const [creatingPerfil, setCreatingPerfil] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoServico[]>([]);
  const [usuarios, setUsuarios] = useState<{ id: string; nome: string }[]>([]);
  const [oportunidades, setOportunidades] = useState<{ id: string; titulo: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enviandoChat, setEnviandoChat] = useState(false);
  const [confirmConv, setConfirmConv] = useState(false);
  const [convertendoVenda, setConvertendoVenda] = useState(false);

  // Cadastro rápido de produto
  const [novoProdOpen, setNovoProdOpen] = useState(false);
  const [novoProdItemIdx, setNovoProdItemIdx] = useState<number | null>(null);
  const [novoProdSaving, setNovoProdSaving] = useState(false);
  const [novoProdNome, setNovoProdNome] = useState("");
  const [novoProdDescricao, setNovoProdDescricao] = useState("");
  const [novoProdTipo, setNovoProdTipo] = useState<string>("produto");
  const [novoProdValor, setNovoProdValor] = useState<number>(0);
  const [novoProdAtivo, setNovoProdAtivo] = useState(true);

  const abrirCadastroProduto = (idx: number) => {
    setNovoProdItemIdx(idx);
    setNovoProdNome("");
    setNovoProdDescricao("");
    setNovoProdTipo("produto");
    setNovoProdValor(0);
    setNovoProdAtivo(true);
    setNovoProdOpen(true);
  };

  const handleSalvarNovoProduto = async () => {
    if (!empresaId) { toast.error("Empresa não identificada"); return; }
    if (!novoProdNome.trim()) { toast.error("Informe o nome do produto"); return; }
    setNovoProdSaving(true);
    try {
      const { data, error } = await supabase.from("produtos_servicos").insert({
        empresa_id: empresaId,
        nome: novoProdNome.trim(),
        descricao: novoProdDescricao || null,
        tipo: novoProdTipo,
        valor_padrao: Number(novoProdValor) || 0,
        ativo: novoProdAtivo,
      } as any).select("id, nome, descricao, tipo, valor_padrao").single();
      if (error) throw error;
      const novo = data as any as ProdutoServico;
      const { data: lista } = await supabase.from("produtos_servicos")
        .select("id, nome, descricao, tipo, valor_padrao")
        .eq("empresa_id", empresaId).eq("ativo", true).order("nome");
      setProdutos((lista as any) ?? []);
      if (novoProdItemIdx !== null) {
        updateItem(novoProdItemIdx, {
          produto_id: novo.id,
          descricao: novo.nome || novo.descricao || "",
          servico: novo.tipo || "",
          valor_unitario: Number(novo.valor_padrao) || 0,
        });
      }
      toast.success("Produto cadastrado");
      setNovoProdOpen(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao cadastrar produto");
    } finally {
      setNovoProdSaving(false);
    }
  };

  const [titulo, setTitulo] = useState("");
  const [numero, setNumero] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("rascunho");
  const [operadorNome, setOperadorNome] = useState<string>("");
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [oportunidadeId, setOportunidadeId] = useState<string | null>(null);
  const [validadeEm, setValidadeEm] = useState<string>("");
  const [condicoesPagamento, setCondicoesPagamento] = useState("");
  const [termos, setTermos] = useState("");
  const [observacoesCliente, setObservacoesCliente] = useState("");
  const [observacoesInternas, setObservacoesInternas] = useState("");
  const [mensagemChat, setMensagemChat] = useState("");
  const [descontoTotal, setDescontoTotal] = useState(0);
  const [taxasTotal, setTaxasTotal] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([]);

  // Perfil comercial
  useEffect(() => {
    if (!open || !empresaId) return;
    supabase.from("empresa_perfil_comercial")
      .select("*").eq("empresa_id", empresaId).maybeSingle()
      .then(({ data }) => setPerfil((data as any) ?? null));
  }, [open, empresaId]);

  // Produtos/serviços ativos da empresa
  useEffect(() => {
    if (!open || !empresaId) { setProdutos([]); return; }
    supabase.from("produtos_servicos")
      .select("id, nome, descricao, tipo, valor_padrao")
      .eq("empresa_id", empresaId).eq("ativo", true).order("nome")
      .then(({ data }) => setProdutos((data as any) ?? []));
  }, [open, empresaId]);

  const handleCriarPerfilInicial = async () => {
    if (!empresaId) return;
    setCreatingPerfil(true);
    try {
      const { data: emp } = await supabase.from("empresas")
        .select("nome, documento, telefone, email, site").eq("id", empresaId).maybeSingle();
      const e = (emp as any) ?? {};
      const payload: any = {
        empresa_id: empresaId,
        nome_unidade: e.nome ?? null,
        nome_fantasia: e.nome ?? null,
        cnpj: e.documento ?? null,
        telefone: e.telefone ?? null,
        whatsapp: e.telefone ?? null,
        email: e.email ?? null,
        site: e.site ?? null,
        validade_orcamento_padrao_dias: 7,
        formas_pagamento_padrao: ["Pix", "Cartão de crédito", "Cartão de débito", "Dinheiro"],
        parcelamento_padrao: "Até 3x",
        termos_orcamento_padrao: "Valores sujeitos à avaliação técnica.",
        observacao_orcamento_padrao: "Orçamento válido conforme prazo informado.",
        ativo: true,
      };
      const { data, error } = await supabase.from("empresa_perfil_comercial")
        .upsert(payload, { onConflict: "empresa_id" }).select("*").single();
      if (error) throw error;
      setPerfil(data as any);
      toast.success("Perfil comercial inicial criado");
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao criar perfil comercial");
    } finally {
      setCreatingPerfil(false);
    }
  };


  // Usuários vinculados à conta/empresa (via usuarios_contas)
  useEffect(() => {
    if (!open || !empresaId) { setUsuarios([]); return; }
    (async () => {
      try {
        const { data: vinc } = await supabase
          .from("usuarios_contas")
          .select("usuario_id")
          .eq("conta_id", empresaId)
          .eq("ativo", true);
        const ids = Array.from(new Set((vinc ?? []).map((v: any) => v.usuario_id).filter(Boolean)));
        if (ids.length === 0) { setUsuarios([]); return; }
        const { data: us } = await supabase
          .from("usuarios")
          .select("id, nome")
          .in("id", ids)
          .eq("ativo", true)
          .order("nome");
        setUsuarios((us as any) ?? []);
      } catch {
        setUsuarios([]);
      }
    })();
  }, [open, empresaId]);

  // Oportunidades do lead
  useEffect(() => {
    if (!open || !empresaId || !lead?.id) { setOportunidades([]); return; }
    supabase.from("oportunidades")
      .select("id, titulo").eq("empresa_id", empresaId).eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setOportunidades((data as any) ?? []));
  }, [open, empresaId, lead?.id]);

  // Carrega orçamento existente
  useEffect(() => {
    if (!open) return;
    if (mode === "create") {
      // Reset com defaults
      setTitulo(""); setNumero(null); setStatus("rascunho");
      setOperadorNome("");
      setVendedorId(conversa?.responsavel_id ?? null);
      setOportunidadeId(null);
      setCondicoesPagamento(""); setObservacoesCliente(""); setObservacoesInternas("");
      setMensagemChat(""); setDescontoTotal(0); setTaxasTotal(0);
      setItens([ITEM_VAZIO(0)]);
      return;
    }
    if (!orcamentoId) return;
    setLoading(true);
    (async () => {
      const { data: orc } = await supabase.from("orcamentos").select("*").eq("id", orcamentoId).maybeSingle();
      const { data: its } = await supabase.from("orcamento_itens").select("*").eq("orcamento_id", orcamentoId).order("ordem");
      const o = orc as any as Orcamento | null;
      if (o) {
        setTitulo(o.titulo ?? "");
        setNumero(o.numero);
        setStatus(o.status);
        setOperadorNome((o as any).operador_nome ?? "");
        setVendedorId(o.vendedor_id);
        setOportunidadeId(o.oportunidade_id);
        setValidadeEm(o.validade_em ? o.validade_em.slice(0, 10) : "");
        setCondicoesPagamento(o.condicoes_pagamento ?? "");
        setTermos(o.termos ?? "");
        setObservacoesCliente(o.observacoes_cliente ?? "");
        setObservacoesInternas(o.observacoes_internas ?? "");
        setMensagemChat(o.mensagem_chat ?? "");
        setDescontoTotal(Number(o.desconto_total ?? 0));
        setTaxasTotal(Number(o.taxas_total ?? 0));
      }
      const list = ((its as any[]) ?? []) as OrcamentoItem[];
      setItens(list.map((it, i) => ({
        id: it.id,
        produto_id: (it as any).produto_id ?? null,
        categoria: it.categoria ?? "",
        descricao: it.descricao ?? "",
        servico: it.servico ?? "",
        quantidade: Number(it.quantidade ?? 1),
        unidade: it.unidade ?? "un",
        medida: it.medida ?? "",
        material: it.material ?? "",
        nivel_sujeira: it.nivel_sujeira ?? "",
        valor_unitario: Number(it.valor_unitario ?? 0),
        desconto: Number(it.desconto ?? 0),
        observacao_tecnica: it.observacao_tecnica ?? "",
        ordem: it.ordem ?? i,
      })));
      setLoading(false);
    })();
  }, [open, mode, orcamentoId, conversa?.responsavel_id]);

  // Pré-preenchimentos a partir do perfil (apenas em create, com campos vazios)
  useEffect(() => {
    if (mode !== "create" || !perfil || !open) return;
    setValidadeEm((cur) => {
      if (cur) return cur;
      const dias = perfil.validade_orcamento_padrao_dias ?? 7;
      const d = new Date(); d.setDate(d.getDate() + dias);
      return d.toISOString().slice(0, 10);
    });
    setTermos((cur) => cur || perfil.termos_orcamento_padrao || "");
    setObservacoesCliente((cur) => cur || perfil.observacao_orcamento_padrao || "");
  }, [perfil, mode, open]);


  const formasPagamento = useMemo<string[]>(() => {
    const fp = perfil?.formas_pagamento_padrao as any;
    if (!Array.isArray(fp)) return [];
    return fp.map((x: any) => (typeof x === "string" ? x : x?.label ?? "")).filter(Boolean);
  }, [perfil]);

  const subtotal = useMemo(
    () => itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0) - (Number(it.desconto) || 0), 0),
    [itens],
  );
  const valorTotal = subtotal - (Number(descontoTotal) || 0) + (Number(taxasTotal) || 0);

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };
  const removeItem = (idx: number) => setItens((arr) => arr.filter((_, i) => i !== idx).map((it, i) => ({ ...it, ordem: i })));
  const addItem = (preset?: Partial<ItemForm>) => {
    setItens((arr) => [...arr, { ...ITEM_VAZIO(arr.length), ...preset }]);
  };
  const moveItem = (idx: number, dir: -1 | 1) => {
    setItens((arr) => {
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return arr;
      const copy = [...arr];
      [copy[idx], copy[j]] = [copy[j], copy[idx]];
      return copy.map((it, i) => ({ ...it, ordem: i }));
    });
  };

  const handleSave = async () => {
    if (!empresaId) { toast.error("Empresa não identificada"); return; }
    if (itens.length === 0) { toast.error("Adicione ao menos um item"); return; }
    if (itens.some((it) => !it.produto_id)) {
      toast.error("Selecione um produto cadastrado para todos os itens do orçamento.");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        empresa_id: empresaId,
        lead_id: lead?.id ?? null,
        conversa_id: conversa?.id ?? null,
        canal_id: conversa?.canal_id ?? null,
        oportunidade_id: oportunidadeId,
        operador_nome: operadorNome.trim() || null,
        vendedor_id: vendedorId,
        titulo: titulo || null,
        status,
        validade_em: validadeEm ? new Date(validadeEm).toISOString() : null,
        condicoes_pagamento: condicoesPagamento || null,
        termos: termos || null,
        observacoes_cliente: observacoesCliente || null,
        observacoes_internas: observacoesInternas || null,
        mensagem_chat: mensagemChat || null,
        subtotal,
        desconto_total: descontoTotal,
        taxas_total: taxasTotal,
        valor_total: valorTotal,
      };

      let orcId = orcamentoId ?? null;
      if (mode === "create") {
        const { data, error } = await supabase.from("orcamentos").insert(payload).select("id").single();
        if (error) throw error;
        orcId = (data as any).id;
      } else if (mode === "edit" && orcId) {
        const { error } = await supabase.from("orcamentos").update(payload).eq("id", orcId);
        if (error) throw error;
        // Limpar itens e reinserir (simples e seguro)
        await supabase.from("orcamento_itens").delete().eq("orcamento_id", orcId);
      }

      if (orcId) {
        const itensPayload = itens.map((it, i) => ({
          orcamento_id: orcId!,
          empresa_id: empresaId,
          produto_id: it.produto_id ?? null,
          categoria: it.categoria || null,
          descricao: it.descricao || it.servico || it.categoria || "Item",
          servico: it.servico || null,
          quantidade: Number(it.quantidade) || 0,
          unidade: it.unidade || "un",
          medida: it.medida || null,
          material: it.material || null,
          nivel_sujeira: it.nivel_sujeira || null,
          valor_unitario: Number(it.valor_unitario) || 0,
          desconto: Number(it.desconto) || 0,
          observacao_tecnica: it.observacao_tecnica || null,
          ordem: i,
        }));
        const { error: e2 } = await supabase.from("orcamento_itens").insert(itensPayload);
        if (e2) throw e2;
      }

      toast.success(mode === "create" ? "Orçamento criado" : "Orçamento atualizado");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar orçamento");
    } finally {
      setSaving(false);
    }
  };

  const tituloDialog =
    mode === "create" ? "Novo orçamento" :
    mode === "edit" ? "Editar orçamento" :
    `Orçamento #${numero ?? ""}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tituloDialog}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando...</div>
        ) : (
          <div className="space-y-5">
            {/* 1. Empresa emissora */}
            <Section title="Empresa emissora">
              {perfil ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <Info label="Unidade" value={perfil.nome_unidade} />
                  <Info label="Nome fantasia" value={perfil.nome_fantasia} />
                  <Info label="Razão social" value={perfil.razao_social} />
                  <Info label="CNPJ" value={perfil.cnpj} />
                  <Info label="WhatsApp" value={perfil.whatsapp} />
                  <Info label="E-mail" value={perfil.email} />
                  <Info label="Cidade/UF" value={[perfil.endereco_cidade, perfil.endereco_uf].filter(Boolean).join("/")} />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Perfil comercial da conta não configurado. Você pode criar um perfil inicial agora ou completar em Configurações da conta.</span>
                  </div>
                  {!readOnly && (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] shrink-0"
                      disabled={creatingPerfil} onClick={handleCriarPerfilInicial}>
                      {creatingPerfil ? "Criando..." : "Criar perfil inicial"}
                    </Button>
                  )}
                </div>
              )}
            </Section>

            {/* 2. Cliente */}
            <Section title="Cliente">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Info label="Nome" value={lead?.nome} />
                <Info label="Telefone" value={lead?.telefone} />
                <Info label="E-mail" value={lead?.email} />
                <Info label="Empresa" value={lead?.nome_fantasia ?? lead?.razao_social ?? ""} />
              </div>
            </Section>

            {/* 3. Operador / Vendedor / 4. Oportunidade */}
            <Section title="Atribuição">
              <div className="grid grid-cols-3 gap-3">
                <Field label="Operador">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nome do operador"
                    value={operadorNome}
                    onChange={(e) => setOperadorNome(e.target.value)}
                    disabled={readOnly}
                  />
                </Field>
                <Field label="Vendedor">
                  <UserSelect users={usuarios} value={vendedorId} onChange={setVendedorId} disabled={readOnly} />
                </Field>
                <Field label="Oportunidade">
                  <Select
                    value={oportunidadeId ?? "none"}
                    onValueChange={(v) => setOportunidadeId(v === "none" ? null : v)}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sem oportunidade" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem oportunidade</SelectItem>
                      {oportunidades.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.titulo}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {oportunidades.length === 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Este orçamento poderá ser vinculado a uma oportunidade em etapa futura.
                </p>
              )}
            </Section>

            {/* 5. Itens */}
            <Section title={`Itens e serviços (${itens.length})`}>
              <div className="space-y-2">
                {itens.map((it, idx) => (
                  <div key={idx} className="rounded-md border bg-muted/20 p-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-medium text-muted-foreground">Item {idx + 1}</span>
                      {!readOnly && (
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, -1)}><ArrowUp className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveItem(idx, 1)}><ArrowDown className="h-3 w-3" /></Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground">Produto/Serviço *</Label>
                        {!readOnly && (
                          <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-[10px]"
                            onClick={() => abrirCadastroProduto(idx)}>
                            + Cadastrar produto
                          </Button>
                        )}
                      </div>
                      <Select
                        value={it.produto_id ?? ""}
                        onValueChange={(v) => {
                          const p = produtos.find((x) => x.id === v);
                          if (!p) return;
                          updateItem(idx, {
                            produto_id: p.id,
                            descricao: p.nome || p.descricao || "",
                            servico: p.tipo || "",
                            valor_unitario: Number(p.valor_padrao) || 0,
                          });
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione um produto/serviço" />
                        </SelectTrigger>
                        <SelectContent>
                          {produtos.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {produtos.length === 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Nenhum produto/serviço cadastrado. Use “+ Cadastrar produto” para criar agora.
                        </p>
                      )}
                    </div>
                    <ItemInput label="Descrição" value={it.descricao} onChange={(v) => updateItem(idx, { descricao: v })} disabled={readOnly} />
                    <div className="grid grid-cols-6 gap-2">
                      <ItemInput label="Qtd" type="number" value={it.quantidade} onChange={(v) => updateItem(idx, { quantidade: Number(v) || 0 })} disabled={readOnly} />
                      <ItemInput label="Unidade" value={it.unidade} onChange={(v) => updateItem(idx, { unidade: v })} disabled={readOnly} />
                      <ItemInput label="Medida" value={it.medida} onChange={(v) => updateItem(idx, { medida: v })} disabled={readOnly} />
                      <ItemInput label="Valor unit." type="number" value={it.valor_unitario} onChange={(v) => updateItem(idx, { valor_unitario: Number(v) || 0 })} disabled={readOnly} />
                      <ItemInput label="Desconto" type="number" value={it.desconto} onChange={(v) => updateItem(idx, { desconto: Number(v) || 0 })} disabled={readOnly} />
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Total</Label>
                        <div className="h-8 flex items-center text-xs font-mono font-semibold">
                          {fmtBRL((Number(it.quantidade) || 0) * (Number(it.valor_unitario) || 0) - (Number(it.desconto) || 0))}
                        </div>
                      </div>
                    </div>
                    <ItemInput label="Observação técnica" value={it.observacao_tecnica} onChange={(v) => updateItem(idx, { observacao_tecnica: v })} disabled={readOnly} />
                  </div>
                ))}
                {itens.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum item adicionado.</p>
                )}
              </div>

              {!readOnly && (
                <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => addItem()}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar item
                </Button>
              )}
            </Section>

            {/* 6. Condições */}
            <Section title="Condições comerciais">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Validade">
                  <Input type="date" className="h-8 text-xs" value={validadeEm}
                    onChange={(e) => setValidadeEm(e.target.value)} disabled={readOnly} />
                </Field>
                <Field label="Título do orçamento">
                  <Input className="h-8 text-xs" value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={readOnly} />
                </Field>
              </div>
              <Field label="Condições de pagamento">
                {formasPagamento.length > 0 ? (
                  <>
                    <Select
                      value={formasPagamento.includes(condicoesPagamento) ? condicoesPagamento : "__custom__"}
                      onValueChange={(v) => setCondicoesPagamento(v === "__custom__" ? "" : v)}
                      disabled={readOnly}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {formasPagamento.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                        <SelectItem value="__custom__">Outra (digitar)</SelectItem>
                      </SelectContent>
                    </Select>
                    {!formasPagamento.includes(condicoesPagamento) && (
                      <Textarea rows={2} className="mt-2" value={condicoesPagamento}
                        onChange={(e) => setCondicoesPagamento(e.target.value)} disabled={readOnly}
                        placeholder="Descreva a condição de pagamento" />
                    )}
                    {perfil?.parcelamento_padrao && (
                      <p className="text-[10px] text-muted-foreground mt-1">Parcelamento padrão: {perfil.parcelamento_padrao}</p>
                    )}
                  </>
                ) : (
                  <>
                    <Textarea rows={2} value={condicoesPagamento} onChange={(e) => setCondicoesPagamento(e.target.value)} disabled={readOnly} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cadastre formas de pagamento no Perfil comercial da conta para facilitar a seleção.
                    </p>
                  </>
                )}
              </Field>
              <Field label="Termos">
                <Textarea rows={2} value={termos} onChange={(e) => setTermos(e.target.value)} disabled={readOnly} />
              </Field>
            </Section>

            {/* 7. Observações */}
            <Section title="Observações">
              <Field label="Observações para o cliente">
                <Textarea rows={2} value={observacoesCliente} onChange={(e) => setObservacoesCliente(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Observações internas">
                <Textarea rows={2} value={observacoesInternas} onChange={(e) => setObservacoesInternas(e.target.value)} disabled={readOnly} />
              </Field>
              <Field label="Mensagem para enviar no chat (futuro)">
                <Textarea rows={2} value={mensagemChat} onChange={(e) => setMensagemChat(e.target.value)} disabled={readOnly}
                  placeholder="Esta mensagem será usada quando o envio pelo chat for liberado." />
              </Field>
            </Section>

            {/* 8. Resumo */}
            <Section title="Resumo financeiro">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Desconto total (R$)">
                  <Input type="number" className="h-8 text-xs" value={descontoTotal}
                    onChange={(e) => setDescontoTotal(Number(e.target.value) || 0)} disabled={readOnly} />
                </Field>
                <Field label="Taxas total (R$)">
                  <Input type="number" className="h-8 text-xs" value={taxasTotal}
                    onChange={(e) => setTaxasTotal(Number(e.target.value) || 0)} disabled={readOnly} />
                </Field>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 text-xs">
                <Row label="Subtotal" value={fmtBRL(subtotal)} />
                <Row label="Desconto" value={`- ${fmtBRL(descontoTotal)}`} />
                <Row label="Taxas" value={`+ ${fmtBRL(taxasTotal)}`} />
                <div className="border-t pt-1">
                  <Row label="Valor total" value={fmtBRL(valorTotal)} bold />
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="outline" className="text-[10px]">{status}</Badge>
                </div>
              </div>
            </Section>

            {/* Ações */}
            <Section title="Ações">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button" variant="default" size="sm" className="h-8 text-xs col-span-2"
                  disabled={
                    mode === "create" || !orcamentoId || enviandoChat ||
                    !conversa?.id ||
                    !["rascunho", "pdf_gerado", "em_negociacao", "enviado", "reenviado"].includes(status)
                  }
                  title={
                    mode === "create" ? "Salve o orçamento antes de enviar" :
                    !conversa?.id ? "Orçamento sem conversa vinculada" : undefined
                  }
                  onClick={async () => {
                    if (!orcamentoId) return;
                    setEnviandoChat(true);
                    try {
                      const { reenviado } = await enviarOrcamentoNoChat(orcamentoId);
                      toast.success(reenviado ? "Orçamento reenviado no chat" : "Orçamento enviado no chat");
                      setStatus(reenviado ? "reenviado" : "enviado");
                      onSaved?.();
                    } catch (e: any) {
                      toast.error(e.message ?? "Erro ao enviar orçamento no chat");
                    } finally {
                      setEnviandoChat(false);
                    }
                  }}
                >
                  {enviandoChat
                    ? "Enviando..."
                    : (status === "enviado" || status === "reenviado")
                      ? "Reenviar no chat"
                      : "Enviar no chat"}
                </Button>
                <Button
                  type="button" variant="outline" size="sm" className="h-8 text-xs"
                  disabled={
                    mode === "create" || !orcamentoId || convertendoVenda ||
                    status === "convertido_em_venda" ||
                    !["rascunho", "enviado", "reenviado", "em_negociacao", "aprovado"].includes(status)
                  }
                  onClick={() => setConfirmConv(true)}
                >
                  {status === "convertido_em_venda"
                    ? "Venda gerada"
                    : convertendoVenda ? "Convertendo..." : "Converter em venda"}
                </Button>
                {["Gerar PDF", "Adicionar imagens/anexos"].map((label) => (
                  <Button key={label} type="button" variant="outline" size="sm" className="h-8 text-xs"
                    onClick={() => toast.info(PREP_MSG)}>
                    {label}
                  </Button>
                ))}
              </div>
            </Section>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : mode === "create" ? "Criar orçamento" : "Salvar alterações"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmConv} onOpenChange={setConfirmConv}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Converter orçamento em venda?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação criará uma venda com os dados do orçamento e marcará o orçamento como convertido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={convertendoVenda}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={convertendoVenda}
              onClick={async (e) => {
                e.preventDefault();
                if (!orcamentoId) return;
                setConvertendoVenda(true);
                try {
                  const { jaConvertido } = await converterOrcamentoEmVenda(orcamentoId);
                  toast.success(jaConvertido ? "Orçamento já estava convertido" : "Venda criada a partir do orçamento");
                  setStatus("convertido_em_venda");
                  setConfirmConv(false);
                  onSaved?.();
                } catch (err: any) {
                  toast.error(err.message ?? "Erro ao converter em venda");
                } finally {
                  setConvertendoVenda(false);
                }
              }}
            >
              {convertendoVenda ? "Convertendo..." : "Converter em venda"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={novoProdOpen} onOpenChange={setNovoProdOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cadastrar produto/serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Nome *">
              <Input className="h-8 text-xs" value={novoProdNome}
                onChange={(e) => setNovoProdNome(e.target.value)} />
            </Field>
            <Field label="Descrição">
              <Textarea rows={2} value={novoProdDescricao}
                onChange={(e) => setNovoProdDescricao(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <Select value={novoProdTipo} onValueChange={setNovoProdTipo}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valor padrão">
                <Input type="number" className="h-8 text-xs" value={novoProdValor}
                  onChange={(e) => setNovoProdValor(Number(e.target.value) || 0)} />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={novoProdAtivo}
                onChange={(e) => setNovoProdAtivo(e.target.checked)} />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNovoProdOpen(false)} disabled={novoProdSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSalvarNovoProduto} disabled={novoProdSaving}>
              {novoProdSaving ? "Salvando..." : "Salvar produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px]">{label}</Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-2 border-b border-border/40 py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-sm font-semibold" : ""}`}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function ItemInput({
  label, value, onChange, type, disabled,
}: {
  label: string; value: string | number; onChange: (v: string) => void; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Input
        type={type ?? "text"}
        className="h-8 text-xs"
        value={value as any}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function UserSelect({
  users, value, onChange, disabled,
}: { users: { id: string; nome: string }[]; value: string | null; onChange: (v: string | null) => void; disabled?: boolean }) {
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)} disabled={disabled}>
      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">—</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
