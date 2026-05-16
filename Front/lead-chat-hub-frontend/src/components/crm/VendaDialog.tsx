import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { Lead } from "@/lib/crm-types";

interface Produto {
  id: string;
  nome: string;
  valor_padrao: number;
  tipo: string;
}
interface ItemForm {
  produto_id: string;
  nome: string;
  quantidade: string;
  valor_unitario: string;
}

interface Props {
  lead: Lead;
  onSaved: () => void | Promise<void>;
}

const novoItem = (): ItemForm => ({ produto_id: "", nome: "", quantidade: "1", valor_unitario: "0" });

export function VendaDialog({ lead, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase
      .from("produtos_servicos")
      .select("id,nome,valor_padrao,tipo")
      .eq("empresa_id", lead.empresa_id)
      .eq("ativo", true)
      .order("nome")
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        setProdutos((data as any) || []);
      });
  }, [open, lead.empresa_id]);

  const total = useMemo(
    () => itens.reduce((acc, i) => acc + (parseFloat(i.quantidade || "0") * parseFloat(i.valor_unitario || "0")), 0),
    [itens]
  );

  const updateItem = (idx: number, patch: Partial<ItemForm>) => {
    setItens((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const onSelectProduto = (idx: number, pid: string) => {
    const p = produtos.find((x) => x.id === pid);
    if (!p) return;
    updateItem(idx, { produto_id: pid, nome: p.nome, valor_unitario: String(p.valor_padrao ?? 0) });
  };

  const addItem = () => setItens((a) => [...a, novoItem()]);
  const removeItem = (idx: number) => setItens((a) => a.filter((_, i) => i !== idx));

  const reset = () => { setItens([novoItem()]); setData(new Date().toISOString().slice(0, 10)); };

  const save = async () => {
    const validos = itens.filter((i) => i.produto_id && parseFloat(i.quantidade) > 0);
    if (validos.length === 0) { toast.error("Adicione ao menos 1 item"); return; }
    if (total <= 0) { toast.error("Valor total deve ser maior que zero"); return; }

    setSaving(true);
    try {
      const dataIso = new Date(data).toISOString();
      const { data: venda, error: ev } = await supabase
        .from("vendas")
        .insert({
          empresa_id: lead.empresa_id,
          lead_id: lead.id,
          status: "fechada",
          data_venda: dataIso,
          valor_total: total,
        })
        .select()
        .single();
      if (ev) throw ev;

      const itensPayload = validos.map((i) => {
        const q = parseFloat(i.quantidade);
        const v = parseFloat(i.valor_unitario);
        return {
          venda_id: venda.id,
          produto_servico_id: i.produto_id,
          nome_produto: i.nome,
          quantidade: q,
          valor_unitario: v,
          valor_total: q * v,
        };
      });
      const { error: ei } = await supabase.from("itens_venda").insert(itensPayload);
      if (ei) throw ei;

      // Atualizar lead como convertido
      await supabase.from("leads").update({
        status: "convertido",
        convertido: true,
        convertido_em: dataIso,
        data_conversao: dataIso,
        valor_estimado: total,
        valor_conversao: total,
        nome_conversao: validos.map((i) => i.nome).join(" + "),
      } as any).eq("id", lead.id);

      // Conversão offline (apenas se ainda não houver registro p/ a plataforma de origem)
      const plataforma = (lead as any).gclid ? "google_ads" : (lead as any).fbclid ? "meta_ads" : (lead as any).ttclid ? "tiktok_ads" : "outros";
      const { data: existing } = await supabase
        .from("conversoes_offline")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("plataforma", plataforma)
        .maybeSingle();
      if (!existing) {
        await supabase.from("conversoes_offline").insert({
          empresa_id: lead.empresa_id,
          lead_id: lead.id,
          plataforma,
          nome_conversao: validos.map((i) => i.nome).join(" + "),
          valor: total,
          descricao: `Venda #${venda.id.slice(0, 8)}`,
          convertido_em: dataIso,
          data_conversao: dataIso,
          gclid: (lead as any).gclid ?? null,
          fbclid: (lead as any).fbclid ?? null,
          ttclid: (lead as any).ttclid ?? null,
          email: lead.email,
          telefone: lead.telefone,
          status_envio: "pendente",
        } as any);
      }

      toast.success("Venda registrada! 🎉");
      setOpen(false);
      reset();
      await onSaved();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar venda");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <ShoppingCart className="mr-2 h-4 w-4" /> Registrar venda
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Registrar venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Data da venda</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Itens</Label>
            {produtos.length === 0 && (
              <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                Cadastre produtos em /produtos para começar.
              </p>
            )}
            {itens.map((it, idx) => {
              const subtotal = parseFloat(it.quantidade || "0") * parseFloat(it.valor_unitario || "0");
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 rounded-md border p-2">
                  <div className="col-span-6">
                    <Select value={it.produto_id} onValueChange={(v) => onSelectProduto(idx, v)}>
                      <SelectTrigger><SelectValue placeholder="Produto" /></SelectTrigger>
                      <SelectContent>
                        {produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    className="col-span-2"
                    type="number" min="0" step="1"
                    placeholder="Qtd"
                    value={it.quantidade}
                    onChange={(e) => updateItem(idx, { quantidade: e.target.value })}
                  />
                  <Input
                    className="col-span-3"
                    type="number" min="0" step="0.01"
                    placeholder="Valor unit."
                    value={it.valor_unitario}
                    onChange={(e) => updateItem(idx, { valor_unitario: e.target.value })}
                  />
                  <Button
                    type="button" variant="ghost" size="icon"
                    className="col-span-1"
                    onClick={() => removeItem(idx)}
                    disabled={itens.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="col-span-12 text-right text-xs text-muted-foreground">
                    Subtotal: {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </div>
                </div>
              );
            })}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar item
            </Button>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-accent p-3">
            <span className="font-medium">Total</span>
            <span className="text-lg font-bold">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || total <= 0}>
            {saving ? "Salvando..." : "Confirmar venda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
