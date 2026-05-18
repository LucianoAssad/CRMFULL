import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Item { nome_produto: string | null; quantidade: number; valor_total: number; }
interface Venda {
  id: string;
  data_venda: string;
  status: string;
  valor_total: number;
  itens_venda: Item[];
}

export function VendasHistorico({ leadId, refreshKey }: { leadId: string; refreshKey: number }) {
  const [vendas, setVendas] = useState<Venda[]>([]);

  useEffect(() => {
    (async () => {
      const { data: vendasData } = await supabase
        .from("vendas")
        .select("id, data_venda, status, valor_total")
        .eq("lead_id", leadId)
        .order("data_venda", { ascending: false });
      const vendasRaw: any[] = (vendasData as any) || [];
      if (vendasRaw.length === 0) { setVendas([]); return; }
      const vendaIds = vendasRaw.map((v) => v.id);
      const { data: itensData } = await supabase
        .from("itens_venda")
        .select("venda_id, nome_produto, quantidade, valor_total")
        .in("venda_id", vendaIds);
      const itensByVenda: Record<string, Item[]> = {};
      for (const item of (itensData as any) || []) {
        (itensByVenda[item.venda_id] ||= []).push({
          nome_produto: item.nome_produto ?? null,
          quantidade: Number(item.quantidade) || 1,
          valor_total: Number(item.valor_total) || 0,
        });
      }
      setVendas(vendasRaw.map((v) => ({ ...v, itens_venda: itensByVenda[v.id] || [] })));
    })();
  }, [leadId, refreshKey]);

  if (vendas.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma venda registrada.</p>;
  }

  return (
    <div className="space-y-2">
      {vendas.map((v) => (
        <div key={v.id} className="rounded-md border bg-muted/30 p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-medium">
              {new Date(v.data_venda).toLocaleDateString("pt-BR")}
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{v.status}</Badge>
              <span className="font-mono font-semibold">
                {Number(v.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>
          </div>
          <ul className="space-y-0.5 text-muted-foreground">
            {(v.itens_venda || []).map((i, idx) => (
              <li key={idx} className="flex justify-between">
                <span>{i.quantidade}× {i.nome_produto || "—"}</span>
                <span>{Number(i.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
