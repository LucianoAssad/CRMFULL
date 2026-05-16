import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Star } from "lucide-react";
import {
  IDENTIDADE_BADGE_CLASS,
  IDENTIDADE_LABEL,
  type LeadIdentidade,
  type IdentidadeTipo,
} from "@/lib/lead-identidades";
import { cn } from "@/lib/utils";

interface Props {
  identidades: LeadIdentidade[];
  emptyMessage?: string;
  compact?: boolean;
}

export function IdentidadesLista({ identidades, emptyMessage, compact }: Props) {
  if (!identidades || identidades.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {emptyMessage || "Nenhuma identidade adicional registrada para este cliente."}
      </p>
    );
  }
  return (
    <ul className={cn("space-y-1.5", compact && "space-y-1")}>
      {identidades.map((i) => {
        const tipo = (i.tipo as IdentidadeTipo) || "outro";
        return (
          <li
            key={i.id}
            className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-2 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className={cn("border", IDENTIDADE_BADGE_CLASS[tipo])}>
                {IDENTIDADE_LABEL[tipo]}
              </Badge>
              <span className="truncate text-xs font-mono">{i.valor}</span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {i.canal && !compact && (
                <span className="text-[10px] text-muted-foreground">{i.canal}</span>
              )}
              {i.principal && (
                <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-label="Principal" />
              )}
              {i.verificado && (
                <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-label="Verificado" />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
