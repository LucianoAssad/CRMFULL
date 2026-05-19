import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

import { toast } from "sonner";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import { Copy, Check, X, Ban, Trash2 } from "lucide-react";
import { getActiveRole } from "@/lib/permissions";
import { usuarioEhAdminEfetivo, garantirAdminDireto } from "@/lib/admin-guard";
import { contaEhDescendente, aprovarPedidoVinculo } from "@/lib/contas-vinculos";


type TipoVinculo = "gerenciamento" | "propriedade";
type TipoConta = "gerente" | "filha";
type TipoSolic = "vinculo" | "transferencia" | "desvinculo";
type StatusSolic = "pendente" | "aprovado" | "recusado" | "cancelado" | "expirado";

interface Empresa {
  id: string;
  nome: string;
  tipo_conta: TipoConta;
  codigo_publico: string | null;
  conta_gerente_id: string | null;
  tipo_vinculo_gerente: TipoVinculo | null;
  ativo: boolean;
}

interface Solic {
  id: string;
  conta_solicitante_id: string;
  conta_alvo_id: string;
  conta_destino_id: string | null;
  tipo_solicitacao: TipoSolic;
  tipo_vinculo_solicitado: TipoVinculo | null;
  status: StatusSolic;
  mensagem: string | null;
  created_at: string;
  respondido_em: string | null;
  solicitante?: Empresa | null;
  alvo?: Empresa | null;
  destino?: Empresa | null;
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

function TipoPedidoBadge({ t }: { t: TipoSolic }) {
  const label = t === "vinculo" ? "Adicionar conta" : t === "transferencia" ? "Transferir conta" : "Remover conta";
  return <Badge variant="secondary">{label}</Badge>;
}

interface ContaRow {
  empresa: Empresa;
  vinculoId: string | null; // id em contas_vinculos quando for vínculo direto adicional
  isHierarquia: boolean;    // true: vínculo da hierarquia principal (empresas.conta_gerente_id)
  desde: string | null;
  proprietario: boolean;
}

export function VinculosPanel() {
  const { activeConta, activeContaId, reload: reloadContas } = useActiveAccount();
  const { usuarioId } = useAuth();

  const [linhas, setLinhas] = useState<ContaRow[]>([]);
  const [recebidos, setRecebidos] = useState<Solic[]>([]);
  const [enviados, setEnviados] = useState<Solic[]>([]);
  const [, setLoading] = useState(false);

  const [removerAlvo, setRemoverAlvo] = useState<ContaRow | null>(null);
  const [bloqueioSemAdmin, setBloqueioSemAdmin] = useState(false);

  const isManager = activeConta?.tipo_conta === "gerente";

  const carregar = async () => {
    if (!activeContaId || !activeConta) return;
    setLoading(true);
    try {
      const lista: ContaRow[] = [];

      // Busca o tipo_vinculo_gerente da conta ativa para determinar Proprietário do pai principal.
      const { data: ativaRow } = await supabase
        .from("empresas")
        .select("tipo_vinculo_gerente")
        .eq("id", activeContaId)
        .maybeSingle();
      const tipoVincPai = ((ativaRow as any)?.tipo_vinculo_gerente ?? "propriedade") as TipoVinculo;

      // Administradores da conta ativa: pai principal + vínculos diretos adicionais.
      // Vale igualmente para Conta Filha e Conta Gerente.
      if (activeConta.conta_gerente_id) {
        const { data: pai } = await supabase
          .from("empresas")
          .select("id, nome, tipo_conta, codigo_publico, conta_gerente_id, tipo_vinculo_gerente, ativo, created_at")
          .eq("id", activeConta.conta_gerente_id)
          .maybeSingle();
        if (pai) {
          const { data: vincPrinc } = await supabase
            .from("contas_vinculos" as any)
            .select("id, created_at, tipo_vinculo")
            .eq("conta_alvo_id", activeContaId)
            .eq("conta_gerente_id", activeConta.conta_gerente_id)
            .eq("status", "ativo")
            .eq("principal", true)
            .maybeSingle();
          lista.push({
            empresa: pai as any,
            vinculoId: null,
            isHierarquia: true,
            desde: (vincPrinc as any)?.created_at ?? (pai as any).created_at ?? null,
            proprietario: tipoVincPai === "propriedade",
          });
        }
      }

      const { data: adicRaw } = await supabase
        .from("contas_vinculos" as any)
        .select("id, conta_gerente_id, created_at, tipo_vinculo")
        .eq("conta_alvo_id", activeContaId)
        .eq("status", "ativo")
        .eq("principal", false);
      const adicRows = ((adicRaw as any[]) ?? []).filter(
        (r) => r.conta_gerente_id !== activeConta.conta_gerente_id,
      );
      if (adicRows.length > 0) {
        const ids = Array.from(new Set(adicRows.map((r: any) => r.conta_gerente_id as string)));
        const { data: emps } = await supabase
          .from("empresas")
          .select("id, nome, tipo_conta, codigo_publico, conta_gerente_id, tipo_vinculo_gerente, ativo")
          .in("id", ids);
        const byId = new Map<string, Empresa>(((emps as any) ?? []).map((e: Empresa) => [e.id, e]));
        for (const r of adicRows) {
          const e = byId.get(r.conta_gerente_id);
          if (!e) continue;
          lista.push({
            empresa: e,
            vinculoId: r.id,
            isHierarquia: false,
            desde: r.created_at ?? null,
            proprietario: ((r as any).tipo_vinculo ?? "gerenciamento") === "propriedade",
          });
        }
      }

      setLinhas(lista);

      // Busca solicitações (flat) + enrich com empresas separadamente
      const [{ data: recRaw }, { data: envRaw }] = await Promise.all([
        supabase.from("solicitacoes_vinculo_conta").select("*")
          .eq("conta_alvo_id", activeContaId).order("created_at", { ascending: false }),
        supabase.from("solicitacoes_vinculo_conta").select("*")
          .eq("conta_solicitante_id", activeContaId).order("created_at", { ascending: false }),
      ]);

      // Coleta todos os empresa IDs das solicitações
      const allSolicRaw = [...(recRaw as any[] || []), ...(envRaw as any[] || [])];
      const solEmpIds = [...new Set(allSolicRaw.flatMap((r: any) => [
        r.conta_solicitante_id ?? r.contaSolicitanteId,
        r.conta_alvo_id ?? r.contaAlvoId,
        r.conta_destino_id ?? r.contaDestinoId,
      ].filter(Boolean)))];
      let solEmpMap: Record<string, any> = {};
      if (solEmpIds.length > 0) {
        const { data: emps } = await supabase.from("empresas")
          .select("id,nome,tipo_conta,codigo_publico,conta_gerente_id,tipo_vinculo_gerente,ativo")
          .in("id", solEmpIds);
        for (const e of (emps as any) || []) solEmpMap[e.id] = e;
      }
      const enrichSolic = (r: any) => ({
        ...r,
        solicitante: solEmpMap[r.conta_solicitante_id ?? r.contaSolicitanteId] ?? null,
        alvo: solEmpMap[r.conta_alvo_id ?? r.contaAlvoId] ?? null,
        destino: solEmpMap[r.conta_destino_id ?? r.contaDestinoId] ?? null,
      });
      setRecebidos((recRaw as any[] || []).map(enrichSolic));
      setEnviados((envRaw as any[] || []).map(enrichSolic));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [activeContaId]);

  // ===== Envio de pedido foi removido =====
  // O envio de pedido de vínculo é feito apenas em /manager/contas via
  // enviarPedidoVinculo. Conta filha não envia pedido. Conta gerente envia
  // somente pelo fluxo correto, evitando criar solicitação invertida em nome
  // de outra conta.

  // ===== Remover =====
  const confirmarRemover = async () => {
    if (!removerAlvo || !activeContaId || !activeConta || !usuarioId) return;
    const row = removerAlvo;
    const contaGerenteAlvoId = row.empresa.id;
    const diag: Record<string, any> = {
      activeContaId,
      activeContaNome: activeConta.nome,
      activeContaCodigo: activeConta.codigo_publico,
      contaGerenteAlvoId,
      contaGerenteAlvoNome: row.empresa.nome,
      contaGerenteAlvoCodigo: row.empresa.codigo_publico,
      usuarioIdContexto: usuarioId,
      rowIsHierarquia: row.isHierarquia,
      rowVinculoId: row.vinculoId,
    };
    const logDiag = (stage: string) => console.info("[diagnostico-remover-conta-gerente]", stage, diag);

    const [{ data: directRows, error: directError }, { data: empresaAtual, error: empresaError }, { data: vinculosRows, error: vinculosError }] = await Promise.all([
      supabase
        .from("usuarios_contas")
        .select("id, usuario_id, conta_id, role, ativo")
        .eq("usuario_id", usuarioId)
        .eq("conta_id", activeContaId),
      supabase
        .from("empresas")
        .select("id, nome, codigo_publico, tipo_conta, conta_gerente_id, tipo_vinculo_gerente")
        .eq("id", activeContaId)
        .maybeSingle(),
      supabase
        .from("contas_vinculos" as any)
        .select("id, conta_gerente_id, conta_alvo_id, principal, status, tipo_vinculo")
        .eq("conta_gerente_id", contaGerenteAlvoId)
        .eq("conta_alvo_id", activeContaId),
    ]);
    diag.directRowsAntes = directRows ?? [];
    diag.rolesDiretasAntes = ((directRows ?? []) as any[]).map((r) => ({ role: r.role, ativo: r.ativo }));
    diag.directError = directError;
    diag.empresaAtual = empresaAtual;
    diag.empresaError = empresaError;
    diag.awrEmEmpresasContaGerenteId = (empresaAtual as any)?.conta_gerente_id === contaGerenteAlvoId;
    diag.contasVinculosRows = vinculosRows ?? [];
    diag.contasVinculosError = vinculosError;
    diag.awrEmContasVinculos = ((vinculosRows ?? []) as any[]).length > 0;
    diag.tipoVinculoEncontrado = diag.awrEmEmpresasContaGerenteId
      ? "principal"
      : ((vinculosRows ?? []) as any[]).some((v) => v.status === "ativo" && v.principal === false)
        ? "adicional"
        : null;

    const adminResult = await usuarioEhAdminEfetivo(usuarioId, activeContaId);
    diag.usuarioEhAdminEfetivo = adminResult;
    diag.authUserId = adminResult.authUserId;
    diag.authEmail = adminResult.authEmail;
    diag.usuarioIdUsadoEmUsuariosContas = adminResult.usuarioIdUsado;
    if (adminResult.usuarioIdUsado && adminResult.usuarioIdUsado !== usuarioId) {
      const { data: directRowsResolvido, error: directResolvidoError } = await supabase
        .from("usuarios_contas")
        .select("id, usuario_id, conta_id, role, ativo")
        .eq("usuario_id", adminResult.usuarioIdUsado)
        .eq("conta_id", activeContaId);
      diag.directRowsUsuarioResolvido = directRowsResolvido ?? [];
      diag.rolesDiretasUsuarioResolvido = ((directRowsResolvido ?? []) as any[]).map((r) => ({ role: r.role, ativo: r.ativo }));
      diag.directResolvidoError = directResolvidoError;
    }
    logDiag("antes-de-validar-admin");

    if (!adminResult.isAdmin) {
      diag.erro = adminResult.error ?? "Você não é Administrador efetivo desta conta.";
      logDiag("bloqueado-sem-admin-efetivo");
      setRemoverAlvo(null);
      setBloqueioSemAdmin(true);
      toast.error("Você não é Administrador efetivo desta conta.");
      return;
    }
    try {
      const garantia = await garantirAdminDireto(usuarioId, activeContaId, activeConta.tipo_conta);
      diag.garantirAdminDireto = garantia;
      logDiag("apos-garantir-admin-direto");
      if (!garantia.ok || !garantia.confirmed) {
        diag.erro = garantia.error ?? "Não foi possível criar seu acesso direto como administrador.";
        logDiag("erro-garantir-admin-direto");
        toast.error("Não foi possível criar seu acesso direto como administrador.");
        return;
      }

      const isGerentePrincipal = (empresaAtual as any)?.conta_gerente_id === contaGerenteAlvoId;
      const vinculoAdicional = ((vinculosRows ?? []) as any[]).find((v) => v.status === "ativo" && v.principal === false);
      const vinculoPrincipal = ((vinculosRows ?? []) as any[]).find((v) => v.status === "ativo" && v.principal === true);

      if (isGerentePrincipal) {
        // Hierarquia principal: remove vínculo gerente da conta ativa.
        const { error } = await supabase
          .from("empresas")
          .update({ conta_gerente_id: null, tipo_vinculo_gerente: null })
          .eq("id", activeContaId)
          .eq("conta_gerente_id", contaGerenteAlvoId);
        if (error) {
          diag.erro = error;
          logDiag("erro-remover-gerente-principal");
          toast.error("Erro ao remover gerente principal.");
          return;
        }
        const { error: vincError } = await supabase.from("contas_vinculos" as any)
          .update({ status: "removido" })
          .eq("conta_alvo_id", activeContaId)
          .eq("conta_gerente_id", contaGerenteAlvoId)
          .eq("principal", true)
          .eq("status", "ativo");
        if (vincError) {
          diag.erro = vincError;
          logDiag("erro-marcar-vinculo-principal-removido");
          toast.error("Erro ao remover gerente principal.");
          return;
        }
        toast.success("Conta Gerente removida");
      } else if (vinculoAdicional || row.vinculoId) {
        const { error } = await supabase.from("contas_vinculos" as any)
          .update({ status: "removido" })
          .eq("id", vinculoAdicional?.id ?? row.vinculoId);
        if (error) {
          diag.erro = error;
          logDiag("erro-remover-vinculo-adicional");
          toast.error("Erro ao remover vínculo adicional.");
          return;
        }
        toast.success("Conta Gerente removida");
      } else {
        diag.erro = "Não foi encontrado vínculo entre AWR e Clínica Cleuza Canan.";
        diag.vinculoPrincipalSemEmpresaGerente = vinculoPrincipal ?? null;
        logDiag("vinculo-nao-encontrado");
        toast.error("Não foi encontrado vínculo entre AWR e Clínica Cleuza Canan.");
        return;
      }
      logDiag("remocao-concluida");
      setRemoverAlvo(null);
      await carregar();
      await reloadContas();
      try {
        window.dispatchEvent(new CustomEvent("active-conta-changed", {
          detail: { contaId: activeContaId },
        }));
        window.dispatchEvent(new CustomEvent("usuarios-contas-changed", {
          detail: { contaId: activeContaId },
        }));
      } catch { /* ignore */ }
    } catch (e: any) {
      diag.erro = e;
      logDiag("erro-inesperado");
      toast.error(e?.message ?? "Erro ao remover");
    }
  };

  // ===== Aceitar / Recusar =====
  const responder = async (s: Solic, aceitar: boolean) => {
    const novoStatus: StatusSolic = aceitar ? "aprovado" : "recusado";
    if (aceitar) {
      try {
        if (s.tipo_solicitacao === "vinculo") {
          const res = await aprovarPedidoVinculo({
            solicitacao_id: s.id,
            conta_solicitante_id: s.conta_solicitante_id,
            conta_alvo_id: s.conta_alvo_id,
            tipo_vinculo_solicitado: s.tipo_vinculo_solicitado,
            usuario_id: usuarioId,
          });
          if (!res.ok) { toast.error(res.error ?? "Erro ao aprovar pedido"); return; }
        } else if (s.tipo_solicitacao === "transferencia") {
          if (!s.conta_destino_id) { toast.error("Destino ausente"); return; }
          if (await contaEhDescendente(s.conta_destino_id, s.conta_alvo_id)) {
            toast.error("Aceitar criaria ciclo hierárquico"); return;
          }
          const tipo = (s.tipo_vinculo_solicitado ?? "propriedade") as TipoVinculo;
          const { error: e1 } = await supabase.from("empresas").update({
            conta_gerente_id: s.conta_destino_id,
            tipo_vinculo_gerente: tipo,
          }).eq("id", s.conta_alvo_id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("contas_vinculos" as any).update({
            principal: false, status: "removido",
          }).eq("conta_alvo_id", s.conta_alvo_id).eq("principal", true).eq("status", "ativo");
          if (e2) throw e2;
          const { data: existente } = await supabase
            .from("contas_vinculos" as any)
            .select("id")
            .eq("conta_gerente_id", s.conta_destino_id)
            .eq("conta_alvo_id", s.conta_alvo_id)
            .maybeSingle();
          if (existente) {
            const { error } = await supabase.from("contas_vinculos" as any).update({
              status: "ativo", tipo_vinculo: tipo, principal: true, solicitacao_id: s.id,
            }).eq("id", (existente as any).id);
            if (error) throw error;
          } else {
            const { error } = await supabase.from("contas_vinculos" as any).insert({
              conta_gerente_id: s.conta_destino_id,
              conta_alvo_id: s.conta_alvo_id,
              tipo_vinculo: tipo,
              status: "ativo",
              principal: true,
              origem: "solicitacao_transferencia",
              solicitacao_id: s.id,
              created_by: usuarioId,
            });
            if (error) throw error;
          }
        } else if (s.tipo_solicitacao === "desvinculo") {
          const { error } = await supabase.from("contas_vinculos" as any).update({
            status: "removido",
          })
            .eq("conta_gerente_id", s.conta_solicitante_id)
            .eq("conta_alvo_id", s.conta_alvo_id)
            .eq("status", "ativo");
          if (error) throw error;
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao aplicar mudança");
        return;
      }
    }
    const { error } = await supabase.from("solicitacoes_vinculo_conta").update({
      status: novoStatus,
      respondido_por: usuarioId,
      respondido_em: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success(aceitar ? "Pedido aceito" : "Pedido recusado");
    carregar();
    reloadContas();
  };

  const cancelar = async (s: Solic) => {
    const { error } = await supabase.from("solicitacoes_vinculo_conta").update({
      status: "cancelado",
      respondido_por: usuarioId,
      respondido_em: new Date().toISOString(),
    }).eq("id", s.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Pedido cancelado");
    carregar();
  };

  const recebidosPendentes = recebidos.filter((s) => s.status === "pendente").length;

  const canRemove = ["super_admin", "admin_gerente", "admin_filha"].includes(getActiveRole());

  const titulo = "Administradores da conta";
  const descricao = "Esta lista mostra as Contas Gerentes que administram esta conta.";
  const colunaConta = "Conta Gerente";

  return (
    <Tabs defaultValue="atual">
      <TabsList>
        <TabsTrigger value="atual">Configuração atual</TabsTrigger>
        <TabsTrigger value="recebidos">
          Pedidos recebidos {recebidosPendentes > 0 && (
            <Badge variant="secondary" className="ml-2">{recebidosPendentes}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="enviados">Pedidos enviados</TabsTrigger>
      </TabsList>

      <TabsContent value="atual" className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">{titulo}</h3>
            <p className="text-xs text-muted-foreground">{descricao}</p>
          </div>
          {isManager && (
            <p className="text-xs text-muted-foreground italic">
              Para enviar pedido de vínculo, vá em Contas → Configurações.
            </p>
          )}
        </div>

        <div className="overflow-x-auto rounded-md border bg-card">
          {linhas.length === 0 ? (
            <div className="space-y-1 p-6 text-center text-sm text-muted-foreground">
              <p>Esta conta não possui administradora.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{colunaConta}</TableHead>
                  <TableHead>Código público</TableHead>
                  <TableHead>Proprietário</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((row) => {
                  const c = row.empresa;
                  return (
                    <TableRow key={c.id + (row.vinculoId ?? "h")}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="font-mono text-xs">{formatCodigoPublico(c.codigo_publico)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={row.proprietario ? "border-primary/40 text-primary" : ""}>
                          {row.proprietario ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.desde ? new Date(row.desde).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={c.ativo ? "default" : "secondary"}>{c.ativo ? "Ativa" : "Inativa"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="icon" variant="ghost" title="Copiar ID"
                          onClick={() => {
                            navigator.clipboard.writeText(formatCodigoPublico(c.codigo_publico));
                            toast.success("ID copiado");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        {canRemove && (
                          <Button
                            size="icon" variant="ghost" title="Remover"
                            onClick={() => setRemoverAlvo(row)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
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

      {/* Dialog de adicionar removido — envio agora ocorre apenas em /manager/contas */}
      {/* Dialog: remover */}
      <Dialog open={!!removerAlvo} onOpenChange={(o) => !o && setRemoverAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover Conta Gerente</DialogTitle>
            <DialogDescription>
              Você continuará como Administrador direto desta conta após a remoção da Conta Gerente.
            </DialogDescription>
          </DialogHeader>
          {removerAlvo && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{removerAlvo.empresa.nome}</div>
              <div className="font-mono text-xs">{formatCodigoPublico(removerAlvo.empresa.codigo_publico)}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoverAlvo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRemover}>Remover Conta Gerente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: bloqueio sem permissão de administrador efetivo */}
      <Dialog open={bloqueioSemAdmin} onOpenChange={setBloqueioSemAdmin}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permissão necessária</DialogTitle>
            <DialogDescription>
              Você precisa ser Administrador desta conta para remover uma Conta Gerente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setBloqueioSemAdmin(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Tabs>
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
        {modo === "recebidos"
          ? "Nenhum pedido recebido."
          : "Nenhum pedido enviado."}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Conta solicitante</TableHead>
            <TableHead>Conta alvo</TableHead>
            <TableHead>Código público</TableHead>
            <TableHead>Tipo de pedido</TableHead>
            <TableHead>Proprietário solicitado</TableHead>
            {modo === "recebidos" && <TableHead>Mensagem</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {itens.map((s) => {
            const contaCodigo = modo === "recebidos" ? s.solicitante : s.alvo;
            return (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.solicitante?.nome ?? "—"}</TableCell>
                <TableCell className="font-medium">
                  {s.alvo?.nome ?? "—"}
                  {s.tipo_solicitacao === "transferencia" && s.destino && (
                    <div className="text-xs text-muted-foreground">
                      → destino: {s.destino.nome}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{formatCodigoPublico(contaCodigo?.codigo_publico)}</TableCell>
                <TableCell><TipoPedidoBadge t={s.tipo_solicitacao} /></TableCell>
                <TableCell>
                  <Badge variant="outline">{(s.tipo_vinculo_solicitado ?? "gerenciamento") === "propriedade" ? "Sim" : "Não"}</Badge>
                </TableCell>
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
                        <Check className="mr-1 h-4 w-4" /> Aceitar
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
