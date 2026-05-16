import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

type TipoImport = "contas" | "leads" | "produtos" | "templates" | "pipeline" | "optouts";

const MODELOS: Record<TipoImport, { label: string; arquivo: string; headers: string[]; exemplo: string[] }> = {
  contas: {
    label: "Contas/Unidades",
    arquivo: "modelo_contas_unidades.csv",
    headers: ["nome","status","telefone","whatsapp","email","site","instagram","regiao","area_atendimento","horario_seg_sexta","horario_sabado","pais"],
    exemplo: ["Unidade Barra","ativo","2130001234","5521999990000","barra@exemplo.com","https://exemplo.com","@exemplo","RJ","Zona Oeste","09:00-18:00","09:00-13:00","Brasil"],
  },
  leads: {
    label: "Clientes/Leads",
    arquivo: "modelo_clientes_leads.csv",
    headers: ["nome","telefone","email","status_pipeline","origem","utm_source","utm_medium","utm_campaign","gclid","fbclid","ttclid","observacoes","tags","opt_in_whatsapp"],
    exemplo: ["Maria Silva","5521988887777","maria@exemplo.com","novo","site","google","cpc","verao_2026","Cj0KC...","IwAR...","E.C.P...","Cliente VIP","vip;recorrente","true"],
  },
  produtos: {
    label: "Produtos/Serviços",
    arquivo: "modelo_produtos_servicos.csv",
    headers: ["nome","descricao","tipo","categoria","valor_padrao","custo","ativo"],
    exemplo: ["Limpeza de Sofá 3 lugares","Higienização completa","servico","Higienização","250.00","80.00","true"],
  },
  templates: {
    label: "Templates",
    arquivo: "modelo_templates.csv",
    headers: ["nome","nome_externo","idioma","categoria","corpo","variaveis","status","ativo"],
    exemplo: ["boas_vindas","boas_vindas_v1","pt_BR","MARKETING","Olá {{1}}, bem-vindo!","nome","aprovado","true"],
  },
  pipeline: {
    label: "Pipeline",
    arquivo: "modelo_pipeline.csv",
    headers: ["pipeline","etapa","ordem","cor","ativo"],
    exemplo: ["Vendas","Novo","1","#3B82F6","true"],
  },
  optouts: {
    label: "Opt-outs",
    arquivo: "modelo_optouts.csv",
    headers: ["nome","telefone","email","canal","motivo","data_optout"],
    exemplo: ["João Souza","5521977776666","joao@exemplo.com","whatsapp","solicitação do cliente","2026-05-04"],
  },
};

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function baixarModelo(tipo: TipoImport) {
  const m = MODELOS[tipo];
  const linhas = [m.headers.join(","), m.exemplo.map(csvEscape).join(",")];
  const blob = new Blob(["\ufeff" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = m.arquivo;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

const TIPOS_PERMITIDOS: Record<TipoImport, ("gerente" | "filha")[]> = {
  contas: ["gerente"],
  leads: ["filha"],
  produtos: ["filha"],
  templates: ["gerente", "filha"],
  pipeline: ["gerente", "filha"],
  optouts: ["filha"],
};

const AJUDA_DESTINO: Record<TipoImport, string> = {
  contas: "Informe o ID de uma Conta Gerente. As unidades serão criadas como Contas Filhas abaixo dela.",
  leads: "Informe o ID de uma Conta Filha. Leads e clientes pertencem sempre a uma conta operacional.",
  produtos: "Informe o ID de uma Conta Filha. Produtos e serviços pertencem à operação da conta filha.",
  templates: "Informe o ID de uma Conta Gerente para biblioteca compartilhada ou de uma Conta Filha para template local.",
  pipeline: "Informe o ID de uma Conta Gerente para modelo compartilhado ou de uma Conta Filha para pipeline local.",
  optouts: "Informe o ID de uma Conta Filha. Opt-outs pertencem à base operacional da conta filha.",
};

function formatCodigoPublico(c: string): string {
  const d = (c || "").replace(/\D+/g, "").padStart(10, "0").slice(-10);
  return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6)}`;
}

function escopoImportacao(tipo: TipoImport, tipoConta: "gerente" | "filha"): string {
  if (tipo === "contas") return "gestão (criação de contas filhas)";
  if (tipo === "templates" || tipo === "pipeline") {
    return tipoConta === "gerente" ? "biblioteca/modelo compartilhado" : "operacional (local da conta filha)";
  }
  return "operacional (dados da conta filha)";
}

const CAMPOS = [
  "Title", "Status", "telefone_", "whatsapp_", "whatslinks", "_email_",
  "Permalink", "instagram_", "horario-de-seg-sexta_", "horario-de-sabado_",
  "Localização de Unidades", "Área Atendimento", "Países",
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else if (c === "\r") {}
      else field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows.filter(r => r.some(v => v && v.trim() !== ""));
}

function normalizaWhats(v: string): string {
  return (v || "").replace(/\D+/g, "");
}

function statusValido(s: string): boolean {
  const v = (s || "").trim().toLowerCase();
  return ["ativo", "ativa", "ativado", "publish", "published", "active", "1", "true"].includes(v) ||
         ["inativo", "inativa", "rascunho", "draft", "pending", "0", "false"].includes(v);
}

interface Linha {
  raw: Record<string, string>;
  nome: string;
  whatsapp: string;
  regional: string;
  statusOk: boolean;
}

export default function ImportarContas() {
  const { scopedContaIds, activeConta } = useActiveAccount();
  const [tipoImport, setTipoImport] = useState<TipoImport>("contas");
  const [idDestino, setIdDestino] = useState("");
  const [criarRegionais, setCriarRegionais] = useState<"sim" | "nao">("nao");
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<null | {
    contaDestino: { id: string; nome: string; codigo_publico: string; tipo_conta: "gerente" | "filha" };
    tipoImport: TipoImport;
    linhas: Linha[];
    contas: number;
    regionais: string[];
    whatsUnicos: number;
    whatsCompartilhados: { numero: string; contas: string[] }[];
    semNome: number;
    semWhats: number;
    statusInvalido: number;
  }>(null);

  const onPreview = async () => {
    setResultado(null);
    const codigo = (idDestino || "").replace(/\D+/g, "").trim();
    if (!codigo) { toast.error("Informe o ID da conta destino"); return; }
    if (!csv.trim()) { toast.error("Cole o CSV"); return; }
    setLoading(true);
    try {
      const { data: empresa, error } = await supabase
        .from("empresas")
        .select("id, nome, codigo_publico, tipo_conta")
        .eq("codigo_publico", codigo)
        .maybeSingle();
      if (error) throw error;
      if (!empresa) { toast.error("Conta não encontrada para este ID"); return; }
      if (scopedContaIds.length > 0 && !scopedContaIds.includes(empresa.id)) {
        toast.error(`Conta destino fora do escopo da Conta ativa${activeConta ? ` (${activeConta.nome})` : ""}.`);
        return;
      }
      const tipoConta = empresa.tipo_conta as "gerente" | "filha";
      const permitidos = TIPOS_PERMITIDOS[tipoImport];
      if (!permitidos.includes(tipoConta)) {
        toast.error(`Este tipo de importação não permite usar uma Conta ${tipoConta === "gerente" ? "Gerente" : "Filha"} como destino.`);
        return;
      }

      const rows = parseCSV(csv);
      if (rows.length < 2) { toast.error("CSV vazio ou sem cabeçalho"); return; }
      const header = rows[0].map(h => h.trim());
      const idx: Record<string, number> = {};
      for (const c of CAMPOS) {
        const i = header.findIndex(h => h.toLowerCase() === c.toLowerCase());
        idx[c] = i;
      }

      const linhas: Linha[] = rows.slice(1).map(r => {
        const get = (c: string) => idx[c] >= 0 ? (r[idx[c]] || "").trim() : "";
        const nome = get("Title");
        const whats = normalizaWhats(get("whatsapp_") || get("whatslinks") || get("telefone_"));
        const regional = get("Área Atendimento") || get("Localização de Unidades");
        const st = get("Status");
        return {
          raw: Object.fromEntries(CAMPOS.map(c => [c, get(c)])),
          nome,
          whatsapp: whats,
          regional,
          statusOk: st === "" ? true : statusValido(st),
        };
      });

      const semNome = linhas.filter(l => !l.nome).length;
      const semWhats = linhas.filter(l => !l.whatsapp).length;
      const statusInvalido = linhas.filter(l => !l.statusOk).length;

      const whatsMap = new Map<string, Set<string>>();
      for (const l of linhas) {
        if (!l.whatsapp || !l.nome) continue;
        if (!whatsMap.has(l.whatsapp)) whatsMap.set(l.whatsapp, new Set());
        whatsMap.get(l.whatsapp)!.add(l.nome);
      }
      const whatsCompartilhados = [...whatsMap.entries()]
        .filter(([, s]) => s.size > 1)
        .map(([numero, s]) => ({ numero, contas: [...s] }));

      const regionais = criarRegionais === "sim"
        ? [...new Set(linhas.map(l => l.regional).filter(Boolean))]
        : [];

      setResultado({
        contaDestino: { id: empresa.id, nome: empresa.nome, codigo_publico: empresa.codigo_publico!, tipo_conta: tipoConta },
        tipoImport,
        linhas,
        contas: linhas.filter(l => l.nome).length,
        regionais,
        whatsUnicos: whatsMap.size,
        whatsCompartilhados,
        semNome,
        semWhats,
        statusInvalido,
      });
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-xl font-semibold">Central de Importações</h1>
        <p className="text-sm text-muted-foreground">
          Importe contas, clientes, produtos, templates, pipelines e opt-outs com pré-visualização antes da gravação.
        </p>
        {activeConta && (
          <p className="mt-1 text-xs text-muted-foreground">
            Escopo ativo: <span className="font-medium text-foreground">{activeConta.nome}</span>
            {" "}· apenas contas dentro desta subárvore podem receber importações.
          </p>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuração</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de importação</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select value={tipoImport} onValueChange={(v: TipoImport) => setTipoImport(v)}>
                <SelectTrigger className="sm:w-72"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODELOS) as TipoImport[]).map(k => (
                    <SelectItem key={k} value={k}>{MODELOS[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => baixarModelo(tipoImport)}>
                <Download className="h-4 w-4" /> Baixar modelo CSV
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O modelo é apenas um arquivo de exemplo. Nenhum dado é alterado ao baixar.
            </p>
          </div>

          <div className="space-y-2">
            <Label>ID da Conta destino</Label>
            <Input
              value={idDestino}
              onChange={e => setIdDestino(e.target.value)}
              placeholder="Ex: 904-830-9854"
            />
            <p className="text-xs text-muted-foreground">{AJUDA_DESTINO[tipoImport]}</p>
          </div>

          {tipoImport === "contas" && (
            <div className="space-y-2">
              <Label>Criar agrupadores regionais?</Label>
              <RadioGroup value={criarRegionais} onValueChange={(v: any) => setCriarRegionais(v)} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="sim" id="r-sim" /><Label htmlFor="r-sim">Sim</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="nao" id="r-nao" /><Label htmlFor="r-nao">Não</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>CSV</Label>
            <Textarea
              rows={10}
              value={csv}
              onChange={e => setCsv(e.target.value)}
              placeholder="Cole o conteúdo CSV aqui (com cabeçalho)..."
              className="font-mono text-xs"
            />
          </div>

          <Button onClick={onPreview} disabled={loading}>
            {loading ? "Processando..." : "Pré-visualizar"}
          </Button>
        </CardContent>
      </Card>

      {resultado && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-3">
              <Info label="Tipo de importação" value={MODELOS[resultado.tipoImport].label} />
              <Info label="Conta destino" value={resultado.contaDestino.nome} />
              <Info label="ID público" value={formatCodigoPublico(resultado.contaDestino.codigo_publico)} />
              <Info label="Tipo da conta" value={resultado.contaDestino.tipo_conta === "gerente" ? "Gerente" : "Filha"} />
              <Info label="Escopo da importação" value={escopoImportacao(resultado.tipoImport, resultado.contaDestino.tipo_conta)} />
              <Info label="Linhas lidas" value={resultado.linhas.length} />
              <Info label="Contas filhas detectadas" value={resultado.contas} />
              <Info label="Agrupadores regionais" value={resultado.regionais.length} />
              <Info label="WhatsApps únicos" value={resultado.whatsUnicos} />
              <Info label="WhatsApps compartilhados" value={resultado.whatsCompartilhados.length} />
              <Info label="Linhas sem nome" value={resultado.semNome} />
              <Info label="Linhas sem WhatsApp" value={resultado.semWhats} />
              <Info label="Linhas com status inválido" value={resultado.statusInvalido} />
            </CardContent>
          </Card>

          {resultado.regionais.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Agrupadores regionais</CardTitle></CardHeader>
              <CardContent className="text-sm">
                <div className="flex flex-wrap gap-2">
                  {resultado.regionais.map(r => (
                    <span key={r} className="rounded border bg-muted px-2 py-1 text-xs">{r}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {resultado.whatsCompartilhados.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">WhatsApps compartilhados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>WhatsApp</TableHead><TableHead>Contas</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {resultado.whatsCompartilhados.map(w => (
                      <TableRow key={w.numero}>
                        <TableCell className="font-mono text-xs">{w.numero}</TableCell>
                        <TableCell className="text-xs">{w.contas.join(", ")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Primeiras 10 linhas interpretadas</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Regional</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Instagram</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultado.linhas.slice(0, 10).map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs">{l.nome || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell className="font-mono text-xs">{l.whatsapp || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell className="text-xs">{l.regional}</TableCell>
                      <TableCell className="text-xs">
                        {l.statusOk ? l.raw["Status"] : <span className="text-destructive">{l.raw["Status"]}</span>}
                      </TableCell>
                      <TableCell className="text-xs">{l.raw["_email_"]}</TableCell>
                      <TableCell className="text-xs">{l.raw["instagram_"]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">
            Esta é uma pré-visualização. Nenhuma conta, canal ou vínculo foi criado.
          </p>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value}</div>
    </div>
  );
}
