import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, AlertTriangle, Shield, Users as UsersIcon, GitBranch, Lock } from "lucide-react";
import { VinculosPanel } from "@/components/VinculosPanel";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";


type TipoVinculo = "propriedade" | "gerenciamento";
type TipoConta = "gerente" | "filha";

type AcessoRole =
  | "super_admin"
  | "admin_gerente"
  | "gestor_gerente"
  | "admin_filha"
  | "gestor_filha"
  | "atendente"
  | "leitura";

interface Empresa {
  id: string;
  nome: string;
  tipo_conta: TipoConta;
  codigo_publico?: string | null;
  conta_gerente_id?: string | null;
  tipo_vinculo_gerente?: TipoVinculo | null;
}

interface UsuarioRow {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  ativo: boolean;
}

interface VinculoRow {
  id: string;
  usuario_id: string;
  conta_id: string;
  role: AcessoRole;
  ativo: boolean;
  created_at: string;
  usuario: UsuarioRow | null;
  conta: Empresa | null;
}

interface AcessoView {
  key: string;
  vinculoId: string | null;            // null se herdado
  usuario: UsuarioRow;
  conta: Empresa;                      // conta ativa (acesso) — alvo da visão
  role: AcessoRole;
  ativo: boolean;
  created_at: string | null;
  source: "direct" | "inherited";
  via_conta_id?: string | null;        // administrador direto que originou o acesso herdado
  via_conta_nome?: string | null;
  via_conta_codigo?: string | null;
}

const ROLES_GERENTE: { value: AcessoRole; label: string }[] = [
  { value: "admin_gerente", label: "Administrador" },
  { value: "gestor_gerente", label: "Gestor" },
  { value: "leitura", label: "Somente leitura" },
];

const ROLES_FILHA: { value: AcessoRole; label: string }[] = [
  { value: "admin_filha", label: "Administrador" },
  { value: "gestor_filha", label: "Gestor" },
  { value: "atendente", label: "Atendente" },
  { value: "leitura", label: "Somente leitura" },
];

const ROLE_LABEL_ALL: Record<AcessoRole, string> = {
  super_admin: "Super Admin",
  admin_gerente: "Administrador",
  gestor_gerente: "Gestor",
  admin_filha: "Administrador",
  gestor_filha: "Gestor",
  atendente: "Atendente",
  leitura: "Somente leitura",
};

const ADMIN_ROLES: AcessoRole[] = ["super_admin", "admin_gerente", "admin_filha"];

const AVISO_GERENCIAMENTO =
  "Esta conta está vinculada apenas para gerenciamento. Para alterar usuários, é necessária propriedade administrativa.";

function rolesParaConta(tipo: TipoConta) {
  return tipo === "gerente" ? ROLES_GERENTE : ROLES_FILHA;
}

function defaultRoleParaConta(tipo: TipoConta): AcessoRole {
  return tipo === "gerente" ? "gestor_gerente" : "atendente";
}

interface FormState {
  nome: string;
  email: string;
  telefone: string;
  conta_id: string;
  role: AcessoRole;
  ativo: boolean;
}

const emptyForm: FormState = {
  nome: "", email: "", telefone: "", conta_id: "", role: "atendente", ativo: true,
};

export default function Usuarios() {
  const { activeContaId, activeConta, isManagerMode, contas } = useActiveAccount();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [vinculos, setVinculos] = useState<VinculoRow[]>([]);
  const [adminDiretos, setAdminDiretos] = useState<Empresa[]>([]); // contas administradoras diretas da conta ativa
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VinculoRow | null>(null);
  const [form, setForm] = useState<FormState>({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"usuarios" | "administradores" | "seguranca">("usuarios");

  // Carrega: conta ativa + administradores diretos (pai principal + vínculos diretos em contas_vinculos).
  const loadEmpresas = async () => {
    if (!activeContaId || !activeConta) {
      setEmpresas([]);
      setAdminDiretos([]);
      return;
    }

    const adminIds = new Set<string>();
    if (activeConta.conta_gerente_id) adminIds.add(activeConta.conta_gerente_id);

    const { data: vincDir } = await supabase
      .from("contas_vinculos" as any)
      .select("conta_gerente_id")
      .eq("conta_alvo_id", activeContaId)
      .eq("status", "ativo")
      .eq("principal", false);
    for (const r of (vincDir as any[]) ?? []) {
      if (r?.conta_gerente_id) adminIds.add(r.conta_gerente_id);
    }

    const ids = Array.from(new Set<string>([activeContaId, ...adminIds]));
    const { data, error } = await supabase
      .from("empresas")
      .select("id, nome, tipo_conta, codigo_publico, conta_gerente_id, tipo_vinculo_gerente")
      .in("id", ids)
      .order("nome");
    if (error) { toast.error(error.message); return; }
    const lista = ((data as any) || []) as Empresa[];
    setEmpresas(lista);
    setAdminDiretos(lista.filter((e) => adminIds.has(e.id)));
  };

  // Carrega vínculos de usuários: conta ativa (diretos) + administradores diretos (herdados).
  const load = async () => {
    if (!activeContaId || !activeConta) { setVinculos([]); return; }
    const adminIds = new Set<string>();
    if (activeConta.conta_gerente_id) adminIds.add(activeConta.conta_gerente_id);
    const { data: vincDir } = await supabase
      .from("contas_vinculos" as any)
      .select("conta_gerente_id")
      .eq("conta_alvo_id", activeContaId)
      .eq("status", "ativo")
      .eq("principal", false);
    for (const r of (vincDir as any[]) ?? []) {
      if (r?.conta_gerente_id) adminIds.add(r.conta_gerente_id);
    }
    const ids = Array.from(new Set<string>([activeContaId, ...adminIds]));

    const { data, error } = await supabase
      .from("usuarios_contas")
      .select(`
        id, usuario_id, conta_id, role, ativo, created_at,
        usuario:usuarios(id, nome, email, telefone, ativo),
        conta:empresas(id, nome, tipo_conta, codigo_publico, conta_gerente_id, tipo_vinculo_gerente)
      `)
      .in("conta_id", ids)
      .order("created_at", { ascending: false });
    if (error) { toast.error(error.message); return; }
    setVinculos((data as any) || []);
  };

  useEffect(() => { loadEmpresas(); load(); /* eslint-disable-next-line */ }, [activeContaId]);

  useEffect(() => {
    const reloadUsuarios = () => { loadEmpresas(); load(); };
    window.addEventListener("usuarios-contas-changed", reloadUsuarios);
    return () => window.removeEventListener("usuarios-contas-changed", reloadUsuarios);
    // eslint-disable-next-line
  }, [activeContaId]);

  const empresasById = useMemo(() => {
    const m: Record<string, Empresa> = {};
    [...empresas, ...(contas as any[])].forEach((e: any) => { if (e?.id && !m[e.id]) m[e.id] = e; });
    return m;
  }, [empresas, contas]);

  // Permissão de escrita (somente sobre a conta ativa nesta tela).
  const canWriteEmpresa = (empresaId: string): boolean => {
    if (!empresaId) return false;
    return empresaId === activeContaId;
  };

  const empresasGravaveis = useMemo(
    () => empresas.filter((e) => canWriteEmpresa(e.id)),
    // eslint-disable-next-line
    [empresas, activeContaId],
  );

  // Constrói visões: diretos da conta ativa + herdados de cada administrador direto.
  // Super Admin é papel global e não aparece nas listas de usuários da conta.
  const acessos: AcessoView[] = useMemo(() => {
    if (!activeContaId) return [];
    const out: AcessoView[] = [];
    const seenUser = new Set<string>(); // dedupe: prefere direto

    // Diretos da conta ativa
    for (const v of vinculos) {
      if (!v.usuario || !v.conta) continue;
      if (v.conta_id !== activeContaId) continue;
      if (v.role === "super_admin") continue;
      seenUser.add(v.usuario_id);
      out.push({
        key: `d-${v.id}`,
        vinculoId: v.id,
        usuario: v.usuario,
        conta: v.conta,
        role: v.role,
        ativo: v.ativo,
        created_at: v.created_at,
        source: "direct",
      });
    }

    // Herdados: vínculos em qualquer administrador direto.
    const adminSet = new Set(adminDiretos.map((e) => e.id));
    const contaAtiva = empresasById[activeContaId];
    if (contaAtiva) {
      for (const v of vinculos) {
        if (!v.usuario || !v.conta) continue;
        if (!adminSet.has(v.conta_id)) continue;
        if (v.role === "super_admin") continue;
        if (seenUser.has(v.usuario_id)) continue;
        seenUser.add(v.usuario_id);
        out.push({
          key: `i-${v.id}-${activeContaId}`,
          vinculoId: null,
          usuario: v.usuario,
          conta: contaAtiva,
          role: v.role,
          ativo: v.ativo,
          created_at: v.created_at,
          source: "inherited",
          via_conta_id: v.conta.id,
          via_conta_nome: v.conta.nome,
          via_conta_codigo: v.conta.codigo_publico ?? null,
        });
      }
    }

    return out.sort((a, b) => a.usuario.nome.localeCompare(b.usuario.nome));
  }, [vinculos, adminDiretos, activeContaId, empresasById]);

  const openNew = () => {
    setEditing(null);
    const conta = empresasGravaveis[0];
    setForm({
      ...emptyForm,
      conta_id: conta?.id ?? "",
      role: conta ? defaultRoleParaConta(conta.tipo_conta) : "atendente",
    });
    setOpen(true);
  };

  const openEdit = (v: VinculoRow) => {
    if (!v.usuario || !v.conta) return;
    setEditing(v);
    setForm({
      nome: v.usuario.nome,
      email: v.usuario.email,
      telefone: v.usuario.telefone ?? "",
      conta_id: v.conta_id,
      role: v.role,
      ativo: v.ativo,
    });
    setOpen(true);
  };

  const formConta = empresasById[form.conta_id];
  const formCanWrite = canWriteEmpresa(form.conta_id);
  const rolesDisponiveis = formConta ? rolesParaConta(formConta.tipo_conta) : ROLES_FILHA;

  useEffect(() => {
    if (!formConta) return;
    const valid = rolesParaConta(formConta.tipo_conta).some((r) => r.value === form.role);
    if (!valid) setForm((f) => ({ ...f, role: defaultRoleParaConta(formConta.tipo_conta) }));
    // eslint-disable-next-line
  }, [form.conta_id]);

  const save = async () => {
    const nome = form.nome.trim();
    const email = form.email.trim().toLowerCase();
    if (!nome) { toast.error("Informe o nome"); return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { toast.error("E-mail inválido"); return; }
    if (!form.conta_id) { toast.error("Selecione uma conta"); return; }
    if (!canWriteEmpresa(form.conta_id)) { toast.error(AVISO_GERENCIAMENTO); return; }

    setLoading(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("usuarios_contas")
          .update({ conta_id: form.conta_id, role: form.role, ativo: form.ativo })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Acesso atualizado");
      } else {
        const { data: existente, error: errFind } = await supabase
          .from("usuarios")
          .select("id")
          .ilike("email", email)
          .maybeSingle();
        if (errFind) throw errFind;

        let usuarioId = existente?.id as string | undefined;
        if (!usuarioId) {
          const { data: novo, error: errIns } = await supabase
            .from("usuarios")
            .insert({
              nome,
              email,
              telefone: form.telefone.trim() || null,
              empresa_id: form.conta_id,
              ativo: true,
            })
            .select("id")
            .single();
          if (errIns) throw errIns;
          usuarioId = novo.id;
        }

        const { data: dup } = await supabase
          .from("usuarios_contas")
          .select("id")
          .eq("usuario_id", usuarioId!)
          .eq("conta_id", form.conta_id)
          .maybeSingle();
        if (dup) {
          toast.error("Usuário já tem acesso a esta conta");
          setLoading(false);
          return;
        }

        const { error: errVinc } = await supabase
          .from("usuarios_contas")
          .insert({
            usuario_id: usuarioId!,
            conta_id: form.conta_id,
            role: form.role,
            ativo: form.ativo,
          });
        if (errVinc) throw errVinc;
        toast.success("Acesso criado");
      }
      setOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const toggleAtivo = async (v: VinculoRow) => {
    if (!canWriteEmpresa(v.conta_id)) { toast.error(AVISO_GERENCIAMENTO); return; }
    const { error } = await supabase
      .from("usuarios_contas")
      .update({ ativo: !v.ativo })
      .eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!v.ativo ? "Acesso ativado" : "Acesso desativado");
    load();
  };

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroAcesso, setFiltroAcesso] = useState<"todos" | "direct" | "inherited">("todos");
  const [filtroNivel, setFiltroNivel] = useState<"todos" | AcessoRole>("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filtroProprietario, setFiltroProprietario] = useState<"todos" | "sim" | "nao">("todos");

  // Proprietário: para acesso direto, baseia-se no tipo_vinculo_gerente da conta ativa em relação ao seu pai.
  // Para herdado, baseia-se na cadeia entre conta ativa e via_conta_id.
  const isOwnerOrigem = (a: AcessoView): "sim" | "nao" | "na" => {
    if (a.source === "direct") return "na";
    let cur: Empresa | undefined = a.conta;
    let hops = 0;
    while (cur && hops < 50) {
      if (cur.id === a.via_conta_id) return "sim";
      const vinc = (cur.tipo_vinculo_gerente ?? "propriedade") as TipoVinculo;
      if (vinc !== "propriedade") return "nao";
      if (!cur.conta_gerente_id) return "nao";
      cur = empresasById[cur.conta_gerente_id];
      hops++;
    }
    return "nao";
  };

  const acessosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return acessos.filter((a) => {
      if (q && !`${a.usuario.nome} ${a.usuario.email}`.toLowerCase().includes(q)) return false;
      if (filtroAcesso !== "todos" && a.source !== filtroAcesso) return false;
      if (filtroNivel !== "todos" && a.role !== filtroNivel) return false;
      if (filtroStatus !== "todos" && (filtroStatus === "ativo") !== a.ativo) return false;
      if (filtroProprietario !== "todos") {
        const o = isOwnerOrigem(a);
        if (filtroProprietario === "sim" && o !== "sim") return false;
        if (filtroProprietario === "nao" && o !== "nao") return false;
      }
      return true;
    });
    // eslint-disable-next-line
  }, [acessos, busca, filtroAcesso, filtroNivel, filtroStatus, filtroProprietario]);

  // Métricas
  const totalUsuarios = acessos.length;
  const totalAdmins = acessos.filter((a) => ADMIN_ROLES.includes(a.role)).length;
  const totalAtivos = acessos.filter((a) => a.ativo).length;
  const totalInativos = acessos.filter((a) => !a.ativo).length;

  const subtitle = isManagerMode()
    ? "Gerencie usuários e administradores desta Conta Gerente."
    : "Gerencie usuários e administradores desta conta.";

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-semibold">Acesso e segurança</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="administradores">Administradores</TabsTrigger>
          <TabsTrigger value="seguranca">Segurança</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={<UsersIcon className="h-4 w-4" />} label="Total de usuários" value={totalUsuarios} />
            <MetricCard icon={<Shield className="h-4 w-4" />} label="Administradores" value={totalAdmins} />
            <MetricCard icon={<UsersIcon className="h-4 w-4" />} label="Usuários ativos" value={totalAtivos} />
            <MetricCard icon={<UsersIcon className="h-4 w-4" />} label="Usuários inativos" value={totalInativos} />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 rounded-md border bg-card p-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew} disabled={empresasGravaveis.length === 0}>
                  <Plus className="mr-1 h-4 w-4" /> Novo acesso
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? "Editar acesso" : "Novo acesso"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      maxLength={150}
                      disabled={!!editing}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>E-mail *</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        maxLength={150}
                        disabled={!!editing}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Telefone</Label>
                      <Input
                        value={form.telefone}
                        onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                        maxLength={30}
                        disabled={!!editing}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conta *</Label>
                    <Select value={form.conta_id} onValueChange={(v) => setForm({ ...form, conta_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {empresasGravaveis.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!formCanWrite && form.conta_id && (
                      <p className="flex items-start gap-1 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-3 w-3" /> {AVISO_GERENCIAMENTO}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nível de acesso</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AcessoRole })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {rolesDisponiveis.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-3">
                    <Label htmlFor="ativo">Acesso ativo</Label>
                    <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={save} disabled={loading || !formCanWrite}>{loading ? "Salvando..." : "Salvar"}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold">Usuários convidados</h2>
            <p className="text-xs text-muted-foreground">Convites por e-mail enviados aos novos usuários.</p>
          </div>
          <div className="rounded-md border bg-card p-6 text-center text-sm text-muted-foreground">
            Nenhum usuário convidado no momento.
          </div>

          <div className="space-y-1">
            <h2 className="text-base font-semibold">Usuários com acesso</h2>
            <p className="text-xs text-muted-foreground">
              Pessoas com acesso a esta conta.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card p-3">
            <Input
              placeholder="Buscar por nome ou e-mail"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-64"
            />
            <Select value={filtroNivel} onValueChange={(v) => setFiltroNivel(v as any)}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder="Nível" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Nível: todos</SelectItem>
                {(["admin_gerente","admin_filha","gestor_gerente","gestor_filha","atendente","leitura"] as AcessoRole[]).map((r) => (
                  <SelectItem key={r} value={r}>{ROLE_LABEL_ALL[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
              <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Status: todos</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SectionTable
            data={acessosFiltrados}
            canWriteEmpresa={canWriteEmpresa}
            onToggle={(v) => {
              if (!v.vinculoId) { toast.info("Este acesso é herdado da conta de origem. Altere o acesso na conta de origem."); return; }
              const vinc = vinculos.find((x) => x.id === v.vinculoId);
              if (vinc) toggleAtivo(vinc);
            }}
            onEdit={(v) => {
              if (!v.vinculoId) { toast.info("Este acesso é herdado da conta de origem. Altere o acesso na conta de origem."); return; }
              const vinc = vinculos.find((x) => x.id === v.vinculoId);
              if (vinc) openEdit(vinc);
            }}
          />
        </TabsContent>

        <TabsContent value="administradores">
          <VinculosPanel />
        </TabsContent>

        <TabsContent value="seguranca">
          <EmptyState
            icon={<Lock className="h-6 w-6" />}
            title="Segurança da conta"
            description="Em breve: políticas de senha, autenticação em duas etapas e auditoria de acessos."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionTable({
  data, canWriteEmpresa, onToggle, onEdit,
}: {
  data: AcessoView[];
  canWriteEmpresa: (id: string) => boolean;
  onToggle: (v: AcessoView) => void;
  onEdit: (v: AcessoView) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-md border bg-card">
        {data.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nenhum usuário com acesso.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Nível de acesso</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((a) => {
                const writable = a.source === "direct" && canWriteEmpresa(a.conta.id);
                const tooltipHerdado = "Este acesso é herdado da conta de origem. Altere o acesso na conta de origem.";
                return (
                  <TableRow key={a.key}>
                    <TableCell className="font-medium">{a.usuario.nome}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{a.usuario.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{ROLE_LABEL_ALL[a.role]}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativo" : "Inativo"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!writable}
                        title={!writable ? (a.source === "inherited" ? tooltipHerdado : AVISO_GERENCIAMENTO) : undefined}
                        onClick={() => onToggle(a)}
                      >
                        {a.ativo ? "Desativar" : "Ativar"}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={!writable}
                        title={!writable ? (a.source === "inherited" ? tooltipHerdado : AVISO_GERENCIAMENTO) : undefined}
                        onClick={() => onEdit(a)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold">{value}</div>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border bg-card p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
