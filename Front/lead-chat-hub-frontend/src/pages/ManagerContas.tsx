import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Plus, LogIn, Link2, Check, X, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { criarContaFilha } from "@/lib/criar-conta-filha";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import {
  enviarPedidoVinculo,
  contaEhDescendente,
  contarGerentesDiretosAtivos,
  LIMITE_GERENTES_FILHA,
  LIMITE_GERENTES_GERENTE,
} from "@/lib/contas-vinculos";

interface Filha {
  id: string;
  nome: string;
  codigo_publico: string | null;
  ativo: boolean;
}

type StatusSolic = "pendente" | "aprovado" | "recusado" | "cancelado" | "expirado";

interface EmpresaMin {
  id: string;
  nome: string;
  tipo_conta: "gerente" | "filha";
  codigo_publico: string | null;
}

interface Solic {
  id: string;
  conta_solicitante_id: string;
  conta_alvo_id: string;
  tipo_solicitacao: string;
  tipo_vinculo_solicitado: string | null;
  status: StatusSolic;
  mensagem: string | null;
  created_at: string;
  solicitante?: EmpresaMin | null;
  alvo?: EmpresaMin | null;
}

const STATUS_LABEL: Record<StatusSolic, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  recusado: "Recusado",
  cancelado: "Cancelado",
  expirado: "Expirado",
};

function StatusBadge({ s }: { s: StatusSolic }) {
  const map: Record<StatusSolic, string> = {
    pendente: "border-amber-400 text-amber-700 dark:text-amber-400",
    aprovado: "border-emerald-400 text-emerald-700 dark:text-emerald-400",
    recusado: "border-rose-400 text-rose-700 dark:text-rose-400",
    cancelado: "border-muted-foreground/40 text-muted-foreground",
    expirado: "border-muted-foreground/40 text-muted-foreground",
  };
  return <Badge variant="outline" className={map[s]}>{STATUS_LABEL[s]}</Badge>;
}

export default function ManagerContas() {
  const navigate = useNavigate();
  const { activeConta, setActiveContaId, reload } = useActiveAccount();
  const { usuarioId } = useAuth();

  const [filhas, setFilhas] = useState<Filha[]>([]);
  const [recebidos, setRecebidos] = useState<Solic[]>([]);
  const [enviados, setEnviados] = useState<Solic[]>([]);
  const [loading, setLoading] = useState(false);

  const [openCriar, setOpenCriar] = useState(false);
  const [openVincular, setOpenVincular] = useState(false);
  const [formCriar, setFormCriar] = useState({ nome: "", email: "", telefone: "" });
  const [formVinc, setFormVinc] = useState({ destino: "", mensagem: "" });
  const [busy, setBusy] = useState(false);

  const gerenteId = activeConta?.tipo_conta === "gerente" ? activeConta.id : null;

  const load = async () => {
    if (!gerenteId) { setFilhas([]); setRecebidos([]); setEnviados([]); return; }
    setLoading(true);
    const [fRes, rRes, eRes] = await Promise.all([
      supabase
        .from("empresas")
        .select("id, nome, codigo_publico, ativo")
        .eq("conta_gerente_id", gerenteId)
        .eq("tipo_conta", "filha")
        .order("nome"),
      supabase
        .from("solicitacoes_vinculo_conta")
        .select(`
          id, conta_solicitante_id, conta_alvo_id, tipo_solicitacao, tipo_vinculo_solicitado, status, mensagem, created_at,
          solicitante:empresas!solicitacoes_vinculo_conta_conta_solicitante_id_fkey(id, nome, tipo_conta, codigo_publico),
          alvo:empresas!solicitacoes_vinculo_conta_conta_alvo_id_fkey(id, nome, tipo_conta, codigo_publico)
        `)
        .eq("conta_alvo_id", gerenteId)
        .eq("tipo_solicitacao", "vinculo")
        .order("created_at", { ascending: false }),
      supabase
        .from("solicitacoes_vinculo_conta")
        .select(`
          id, conta_solicitante_id, conta_alvo_id, tipo_solicitacao, tipo_vinculo_solicitado, status, mensagem, created_at,
          solicitante:empresas!solicitacoes_vinculo_conta_conta_solicitante_id_fkey(id, nome, tipo_conta, codigo_publico),
          alvo:empresas!solicitacoes_vinculo_conta_conta_alvo_id_fkey(id, nome, tipo_conta, codigo_publico)
        `)
        .eq("conta_solicitante_id", gerenteId)
        .eq("tipo_solicitacao", "vinculo")
        .order("created_at", { ascending: false }),
    ]);
    setLoading(false);
    if (fRes.error) toast.error(fRes.error.message);
    setFilhas((fRes.data as any) || []);
    setRecebidos((rRes.data as any) || []);
    setEnviados((eRes.data as any) || []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [gerenteId]);

  const onCriarFilha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gerenteId) { toast.error("Conta gerente ativa não identificada."); return; }
    setBusy(true);
    try {
      await criarContaFilha({
        nome: formCriar.nome,
        email: formCriar.email,
        telefone: formCriar.telefone,
        conta_gerente_id: gerenteId,
        usuario_id: usuarioId,
      });
      toast.success("Conta filha criada");
      setOpenCriar(false);
      setFormCriar({ nome: "", email: "", telefone: "" });
      await reload();
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar conta filha.");
    } finally {
      setBusy(false);
    }
  };

  const onEnviarVinculo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gerenteId || !activeConta) { toast.error("Conta gerente ativa não identificada."); return; }
    setBusy(true);
    try {
      const r = await enviarPedidoVinculo({
        conta_solicitante_id: gerenteId,
        conta_solicitante_tipo: activeConta.tipo_conta,
        destino_input: formVinc.destino,
        mensagem: formVinc.mensagem,
        usuario_id: usuarioId,
      });
      if (!r.ok) { toast.error(r.error ?? "Não foi possível enviar o pedido."); return; }
      toast.success(`Pedido enviado para ${r.destino?.nome}`);
      setOpenVincular(false);
      setFormVinc({ destino: "", mensagem: "" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const acessar = (f: Filha) => {
    setActiveContaId(f.id);
    try {
      localStorage.setItem("modo_sistema", "account");
      localStorage.setItem("active_role", "admin_filha");
    } catch {}
    toast.success(`Acessando ${f.nome}`);
    navigate("/account/dashboard", { replace: true });
  };

  const responder = async (s: Solic, aceitar: boolean) => {
    if (!gerenteId) return;
    if (aceitar) {
      // Validações: ciclo + limite
      if (await contaEhDescendente(s.conta_solicitante_id, s.conta_alvo_id)) {
        toast.error("Este vínculo criaria um ciclo na hierarquia e não pode ser aprovado.");
        return;
      }
      const tipoAlvo = activeConta?.tipo_conta;
      const ativos = await contarGerentesDiretosAtivos(s.conta_alvo_id);
      const limite = tipoAlvo === "gerente" ? LIMITE_GERENTES_GERENTE : LIMITE_GERENTES_FILHA;
      if (ativos >= limite) {
        toast.error(tipoAlvo === "gerente"
          ? "Uma conta gerente só pode ter uma conta gerente direta acima."
          : "Esta conta já atingiu o limite de contas gerente diretas.");
        return;
      }

      // Já existe vínculo ativo igual?
      const { data: jaAtivo } = await supabase
        .from("contas_vinculos" as any)
        .select("id")
        .eq("conta_gerente_id", s.conta_solicitante_id)
        .eq("conta_alvo_id", s.conta_alvo_id)
        .eq("status", "ativo")
        .maybeSingle();
      if (jaAtivo) {
        toast.error("Já existe um vínculo ativo entre estas contas.");
        return;
      }

      // Verifica se haverá principal
      const { data: jaPrincipal } = await supabase
        .from("contas_vinculos" as any)
        .select("id")
        .eq("conta_alvo_id", s.conta_alvo_id)
        .eq("status", "ativo")
        .eq("principal", true)
        .maybeSingle();
      const definirPrincipal = !jaPrincipal;

      // Cria vínculo
      const { data: existente } = await supabase
        .from("contas_vinculos" as any)
        .select("id")
        .eq("conta_gerente_id", s.conta_solicitante_id)
        .eq("conta_alvo_id", s.conta_alvo_id)
        .maybeSingle();
      if (existente) {
        const { error } = await supabase.from("contas_vinculos" as any).update({
          status: "ativo",
          tipo_vinculo: s.tipo_vinculo_solicitado ?? "gerenciamento",
          principal: definirPrincipal,
          solicitacao_id: s.id,
        }).eq("id", (existente as any).id);
        if (error) { toast.error(error.message); return; }
      } else {
        const { error } = await supabase.from("contas_vinculos" as any).insert({
          conta_gerente_id: s.conta_solicitante_id,
          conta_alvo_id: s.conta_alvo_id,
          tipo_vinculo: s.tipo_vinculo_solicitado ?? "gerenciamento",
          status: "ativo",
          principal: definirPrincipal,
          origem: "solicitacao_vinculo",
          solicitacao_id: s.id,
          created_by: usuarioId,
        });
        if (error) { toast.error(error.message); return; }
      }

      // Se for principal, atualiza empresas.conta_gerente_id
      if (definirPrincipal) {
        await supabase.from("empresas").update({
          conta_gerente_id: s.conta_solicitante_id,
          tipo_vinculo_gerente: s.tipo_vinculo_solicitado ?? "gerenciamento",
        }).eq("id", s.conta_alvo_id);
      }
    }

    const { error } = await supabase.from("solicitacoes_vinculo_conta").update({
      status: aceitar ? "aprovado" : "recusado",
      respondido_por: usuarioId,
      respondido_em: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(aceitar ? "Pedido aprovado" : "Pedido recusado");
    await reload();
    await load();
  };

  const cancelar = async (s: Solic) => {
    const { error } = await supabase.from("solicitacoes_vinculo_conta").update({
      status: "cancelado",
      respondido_por: usuarioId,
      respondido_em: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido cancelado");
    await load();
  };

  if (!gerenteId) {
    return (
      <main className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Selecione uma conta gerente ativa para gerenciar contas.
          </CardContent>
        </Card>
      </main>
    );
  }

  const recebidosPendentes = recebidos.filter((s) => s.status === "pendente").length;

  return (
    <main className="p-6 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Contas</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie subcontas e pedidos de vinculação para <span className="font-medium">{activeConta?.nome}</span>.
        </p>
      </header>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configurações da subconta</TabsTrigger>
          <TabsTrigger value="recebidos">
            Pedidos recebidos
            {recebidosPendentes > 0 && <Badge variant="secondary" className="ml-2">{recebidosPendentes}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="enviados">Pedidos enviados</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpenVincular(true)}>
              <Link2 className="mr-2 h-4 w-4" /> Vincular conta existente
            </Button>
            <Button onClick={() => setOpenCriar(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar nova conta filha
            </Button>
          </div>

          {loading ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando...</CardContent></Card>
          ) : filhas.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted p-3"><Building2 className="h-6 w-6 text-muted-foreground" /></div>
                <h2 className="text-lg font-semibold">Nenhuma conta filha vinculada</h2>
                <p className="max-w-md text-sm text-muted-foreground">
                  Crie uma nova conta filha ou vincule uma conta existente por ID/código público.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filhas.map((f) => (
                <Card key={f.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="truncate">{f.nome}</span>
                      <Badge variant={f.ativo ? "default" : "secondary"}>{f.ativo ? "Ativa" : "Inativa"}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Conta filha</span>
                      {f.codigo_publico && <span className="font-mono text-xs">{formatCodigoPublico(f.codigo_publico)}</span>}
                    </div>
                    <Button size="sm" className="w-full" onClick={() => acessar(f)}>
                      <LogIn className="mr-2 h-4 w-4" /> Acessar conta
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="recebidos">
          <ListaPedidos
            modo="recebidos"
            itens={recebidos}
            onAceitar={(s) => responder(s, true)}
            onRecusar={(s) => responder(s, false)}
          />
        </TabsContent>

        <TabsContent value="enviados">
          <ListaPedidos
            modo="enviados"
            itens={enviados}
            onCancelar={cancelar}
          />
        </TabsContent>
      </Tabs>

      {/* Criar conta filha */}
      <Dialog open={openCriar} onOpenChange={setOpenCriar}>
        <DialogContent>
          <DialogHeader><DialogTitle>Criar nova conta filha</DialogTitle></DialogHeader>
          <form onSubmit={onCriarFilha} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da conta filha *</Label>
              <Input id="nome" value={formCriar.nome} onChange={(e) => setFormCriar({ ...formCriar, nome: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail comercial</Label>
              <Input id="email" type="email" value={formCriar.email} onChange={(e) => setFormCriar({ ...formCriar, email: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">WhatsApp / Telefone</Label>
              <Input id="telefone" value={formCriar.telefone} onChange={(e) => setFormCriar({ ...formCriar, telefone: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenCriar(false)} disabled={busy}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? "Criando..." : "Criar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vincular conta existente */}
      <Dialog open={openVincular} onOpenChange={setOpenVincular}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular conta existente</DialogTitle>
            <DialogDescription>
              Informe o ID ou código público da conta destino. O pedido será enviado para aprovação.
              A conta atual ficará acima na hierarquia após o aceite.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={onEnviarVinculo} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="destino">ID ou código público da conta destino *</Label>
              <Input
                id="destino"
                placeholder="000-000-0000 ou UUID"
                value={formVinc.destino}
                onChange={(e) => setFormVinc({ ...formVinc, destino: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg">Mensagem (opcional)</Label>
              <Textarea
                id="msg"
                rows={3}
                value={formVinc.mensagem}
                onChange={(e) => setFormVinc({ ...formVinc, mensagem: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpenVincular(false)} disabled={busy}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? "Enviando..." : "Enviar pedido"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ListaPedidos({
  modo, itens, onAceitar, onRecusar, onCancelar,
}: {
  modo: "recebidos" | "enviados";
  itens: Solic[];
  onAceitar?: (s: Solic) => void;
  onRecusar?: (s: Solic) => void;
  onCancelar?: (s: Solic) => void;
}) {
  if (itens.length === 0) {
    return (
      <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
        {modo === "recebidos" ? "Nenhum pedido recebido." : "Nenhum pedido enviado."}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{modo === "recebidos" ? "Conta solicitante" : "Conta destino"}</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Código público</TableHead>
            {modo === "recebidos" && <TableHead>Mensagem</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((s) => {
            const ref = modo === "recebidos" ? s.solicitante : s.alvo;
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{ref?.nome ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {ref?.tipo_conta === "gerente" ? "Gerente" : "Filha"}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">{formatCodigoPublico(ref?.codigo_publico)}</TableCell>
                {modo === "recebidos" && (
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={s.mensagem ?? ""}>
                    {s.mensagem || "—"}
                  </TableCell>
                )}
                <TableCell><StatusBadge s={s.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  {modo === "recebidos" && s.status === "pendente" && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onAceitar?.(s)}>
                        <Check className="mr-1 h-4 w-4" /> Aprovar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onRecusar?.(s)}>
                        <X className="mr-1 h-4 w-4" /> Recusar
                      </Button>
                    </>
                  )}
                  {modo === "enviados" && s.status === "pendente" && (
                    <Button size="sm" variant="ghost" onClick={() => onCancelar?.(s)}>
                      <Ban className="mr-1 h-4 w-4" /> Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
