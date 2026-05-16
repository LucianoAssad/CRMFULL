import { useMemo, useState } from "react";
import { Download, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { toast } from "sonner";

type TipoImport = "leads" | "produtos" | "pipeline" | "templates" | "optouts";

const TIPOS: { value: TipoImport; label: string; headers: string[]; required: string[] }[] = [
  {
    value: "leads",
    label: "Leads/Clientes",
    headers: ["nome", "telefone", "email", "origem", "status_pipeline", "utm_source", "utm_medium", "utm_campaign", "gclid", "fbclid", "observacoes"],
    required: ["nome"],
  },
  {
    value: "produtos",
    label: "Produtos",
    headers: ["nome", "descricao", "valor_padrao", "ativo"],
    required: ["nome"],
  },
  {
    value: "pipeline",
    label: "Pipeline",
    headers: ["nome_etapa", "ordem", "cor", "ativo"],
    required: ["nome_etapa"],
  },
  {
    value: "templates",
    label: "Templates",
    headers: ["nome", "categoria", "canal", "conteudo", "ativo"],
    required: ["nome", "conteudo"],
  },
  {
    value: "optouts",
    label: "Opt-outs",
    headers: ["telefone", "email", "canal", "motivo", "data_opt_out"],
    required: ["canal"],
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[\d\s+()\-]{8,}$/;

type Row = { row: number; data: Record<string, string>; errors: string[]; duplicate: boolean };

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if ((ch === "," || ch === ";") && !inQ) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = split(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

export default function ImportacoesAccount() {
  const { activeConta } = useActiveAccount();
  const isFilha = activeConta?.tipo_conta === "filha";

  const [tipo, setTipo] = useState<TipoImport>("leads");
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Row[] | null>(null);

  const tipoDef = useMemo(() => TIPOS.find((t) => t.value === tipo)!, [tipo]);

  if (!activeConta) {
    return <div className="p-6 text-sm text-muted-foreground">Selecione uma conta para continuar.</div>;
  }
  if (!isFilha) {
    return <div className="p-6 text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Filhas.</div>;
  }

  const baixarModelo = () => {
    const csvContent = tipoDef.headers.join(",") + "\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo-${tipoDef.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onUpload = async (file: File) => {
    const text = await file.text();
    setCsv(text);
    setPreview(null);
  };

  const validar = () => {
    if (!csv.trim()) { toast.error("Cole ou envie um CSV."); return; }
    const { headers, rows } = parseCsv(csv);
    if (!headers.length) { toast.error("CSV vazio."); return; }

    const missingRequired = tipoDef.required.filter((r) => !headers.includes(r));
    if (missingRequired.length) {
      toast.error(`Cabeçalhos obrigatórios ausentes: ${missingRequired.join(", ")}`);
      return;
    }

    const seen = new Map<string, number>();
    const result: Row[] = rows.map((cells, idx) => {
      const data: Record<string, string> = {};
      headers.forEach((h, i) => { data[h] = (cells[i] ?? "").trim(); });
      const errors: string[] = [];

      tipoDef.required.forEach((r) => {
        if (!data[r]) errors.push(`Campo "${r}" vazio`);
      });

      if ("email" in data && data.email && !EMAIL_RE.test(data.email)) errors.push("Email inválido");
      if ("telefone" in data && data.telefone && !PHONE_RE.test(data.telefone)) errors.push("Telefone inválido");

      if (tipo === "produtos" && data.valor_padrao && isNaN(Number(data.valor_padrao.replace(",", ".")))) {
        errors.push("valor_padrao inválido");
      }
      if (tipo === "pipeline" && data.ordem && isNaN(Number(data.ordem))) {
        errors.push("ordem inválida");
      }
      if (tipo === "optouts") {
        if (!data.telefone && !data.email) errors.push("Informe telefone ou email");
      }

      // Duplicidade dentro do arquivo
      const dupKey = (() => {
        if (tipo === "leads") return (data.email || data.telefone || data.nome || "").toLowerCase();
        if (tipo === "produtos" || tipo === "pipeline" || tipo === "templates") return (data.nome || data.nome_etapa || "").toLowerCase();
        if (tipo === "optouts") return `${(data.email || "").toLowerCase()}|${(data.telefone || "").toLowerCase()}|${(data.canal || "").toLowerCase()}`;
        return "";
      })();
      let duplicate = false;
      if (dupKey) {
        if (seen.has(dupKey)) { duplicate = true; errors.push(`Duplicada da linha ${seen.get(dupKey)}`); }
        else seen.set(dupKey, idx + 2);
      }

      return { row: idx + 2, data, errors, duplicate };
    });

    setPreview(result);
  };

  const totals = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.length,
      validas: preview.filter((r) => r.errors.length === 0).length,
      erros: preview.filter((r) => r.errors.length > 0).length,
      dups: preview.filter((r) => r.duplicate).length,
    };
  }, [preview]);

  const previewCols = tipoDef.headers.slice(0, 4);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-semibold">Importações</h1>
        <p className="text-sm text-muted-foreground">
          Importe dados operacionais para esta conta, com pré-visualização antes da gravação.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Conta destino</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <div className="font-medium">{activeConta.nome}</div>
            <div className="font-mono text-xs text-muted-foreground">{formatCodigoPublico(activeConta.codigo_publico)}</div>
          </div>
          <Badge variant="secondary">Conta Filha</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tipo de importação</CardTitle>
          <CardDescription>Selecione o que deseja importar para esta conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1.5 md:col-span-2">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => { setTipo(v as TipoImport); setCsv(""); setPreview(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={baixarModelo}>
              <Download className="mr-2 h-4 w-4" /> Baixar modelo CSV
            </Button>
          </div>

          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Cabeçalhos esperados: </span>
            <span className="font-mono">{tipoDef.headers.join(", ")}</span>
          </div>

          <div className="space-y-2">
            <Label>Conteúdo CSV</Label>
            <Textarea
              rows={8}
              placeholder="Cole o conteúdo do CSV aqui..."
              value={csv}
              onChange={(e) => { setCsv(e.target.value); setPreview(null); }}
              className="font-mono text-xs"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.currentTarget.value = ""; }}
              />
              <Button asChild variant="outline">
                <span><Upload className="mr-2 h-4 w-4" /> Enviar arquivo CSV</span>
              </Button>
            </label>
            <Button onClick={validar}><FileText className="mr-2 h-4 w-4" /> Pré-visualizar</Button>
            <Button disabled variant="secondary">Importação real será ativada em uma próxima etapa.</Button>
          </div>
        </CardContent>
      </Card>

      {!preview ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            Cole ou envie um CSV para iniciar a pré-visualização.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Stat label="Tipo" value={tipoDef.label} />
            <Stat label="Conta destino" value={activeConta.nome} />
            <Stat label="Total" value={String(totals!.total)} />
            <Stat label="Válidas" value={String(totals!.validas)} />
            <Stat label="Com erro" value={`${totals!.erros} (${totals!.dups} dup.)`} />
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Linha</TableHead>
                    {previewCols.map((c) => <TableHead key={c}>{c}</TableHead>)}
                    <TableHead>Status</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((r) => (
                    <TableRow key={r.row}>
                      <TableCell className="font-mono text-xs">{r.row}</TableCell>
                      {previewCols.map((c) => (
                        <TableCell key={c} className="text-xs">{r.data[c] || "—"}</TableCell>
                      ))}
                      <TableCell>
                        {r.errors.length === 0 ? (
                          <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> válido</Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> erro</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.errors.join("; ") || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent className="pt-0"><div className="text-base font-semibold truncate">{value}</div></CardContent>
    </Card>
  );
}
