import { FileText, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PLACEHOLDER_MSG =
  "Recurso visual/preparatório. Orçamentos reais serão implementados em etapa futura.";
const NEW_MSG =
  "Recurso em preparação. Em breve será possível criar orçamentos com itens, imagens e PDF.";

const itens = [
  "Sofá retrátil 3 lugares — Higienização",
  "Poltrona — Higienização",
  "Impermeabilização",
  "Taxa de deslocamento",
];

export function OrcamentosPlaceholder() {
  const placeholder = () => toast.info(PLACEHOLDER_MSG);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-muted-foreground">
        Em breve, será possível criar orçamentos com itens, imagens e PDF para envio na conversa.
      </p>

      <div className="rounded-md border bg-background p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Orçamento exemplo #1024</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              4 itens · PDF não gerado
            </div>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Visual/preparatório
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-mono font-semibold">R$ 520,00</span>
        </div>

        <ul className="space-y-1 rounded-md border bg-muted/30 p-2 text-[11px]">
          {itens.map((it) => (
            <li key={it} className="flex items-start gap-1.5">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{it}</span>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={placeholder}>
            Ver prévia
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={placeholder}>
            Editar
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={placeholder}>
            Reenviar PDF
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={placeholder}>
            Converter em venda
          </Button>
        </div>
      </div>

      <Button
        size="sm"
        variant="secondary"
        className="w-full"
        onClick={() => toast.info(NEW_MSG)}
      >
        <Plus className="mr-1 h-3.5 w-3.5" /> Novo orçamento
      </Button>
    </div>
  );
}
