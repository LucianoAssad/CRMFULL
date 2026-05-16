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
    supabase
      .from("vendas")
      .select("id, data_venda, status, valor_total, itens_venda(nome_produto, quantidade, valor_total)")
      .eq("lead_id", leadId)
      .order("data_venda", { ascending: false })
      .then(({ data }) => setVendas((data as any) || []));
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
