import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";

interface Produto {
  id: string;
  empresa_id: string;
  nome: string;
  descricao: string | null;
  tipo: "produto" | "servico";
  valor_padrao: number;
  ativo: boolean;
  created_at: string;
}

const empty = {
  nome: "",
  descricao: "",
  tipo: "produto" as "produto" | "servico",
  valor_padrao: "",
  ativo: true,
};

const fmtMoney = (v: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Produtos() {
  const { activeConta } = useActiveAccount();
  const isFilha = activeConta?.tipo_conta === "filha";
  const empresaId = isFilha ? activeConta?.id ?? null : null;

  const [items, setItems] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"all" | "ativos" | "inativos">("all");

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!empresaId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("produtos_servicos")
      .select("*")
      .eq("empresa_id", empresaId)
      .order("nome");
    if (error) { toast.error(error.message); }
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [empresaId]);

  const filtrados = useMemo(() => {
    return items.filter((p) => {
      if (filtroStatus === "ativos" && !p.ativo) return false;
      if (filtroStatus === "inativos" && p.ativo) return false;
      if (busca) {
        const q = busca.toLowerCase();
        if (!p.nome.toLowerCase().includes(q) && !(p.descricao ?? "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, busca, filtroStatus]);

  if (!activeConta) {
    return <div className="p-6 text-sm text-muted-foreground">Selecione uma conta para continuar.</div>;
  }
  if (!isFilha) {
    return <div className="p-6 text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Filhas.</div>;
  }

  const openNew = () => { setEditing(null); setForm({ ...empty }); setOpen(true); };
  const openEdit = (p: Produto) => {
    setEditing(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? "",
      tipo: p.tipo,
      valor_padrao: String(p.valor_padrao ?? ""),
      ativo: p.ativo,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!empresaId) return;
    const nome = form.nome.trim();
    if (!nome) { toast.error("Informe o nome"); return; }
    const valor = parseFloat(form.valor_padrao || "0");
    if (isNaN(valor) || valor < 0) { toast.error("Valor inválido"); return; }

    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("produtos_servicos")
          .update({
            nome,
            descricao: form.descricao.trim() || null,
            tipo: form.tipo,
            valor_padrao: valor,
            ativo: form.ativo,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Atualizado");
      } else {
        const { error } = await supabase.from("produtos_servicos").insert({
          empresa_id: empresaId,
          nome,
          descricao: form.descricao.trim() || null,
          tipo: form.tipo,
          valor_padrao: valor,
          ativo: form.ativo,
        });
        if (error) throw error;
        toast.success("Cadastrado");
      }
      setOpen(false);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleAtivo = async (p: Produto) => {
    const { error } = await supabase
      .from("produtos_servicos")
      .update({ ativo: !p.ativo })
      .eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(!p.ativo ? "Ativado" : "Desativado");
    load();
  };

  const remove = async (p: Produto) => {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    const { error } = await supabase.from("produtos_servicos").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Removido");
    load();
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Gerencie os produtos oferecidos por esta conta.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo produto</Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar por nome ou descrição..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="ativos">Ativos</SelectItem>
              <SelectItem value="inativos">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Nenhum produto cadastrado nesta conta.</p>
              <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Cadastrar primeiro produto</Button>
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum resultado para os filtros aplicados.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor padrão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-28 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.nome}</span>
                        <Badge variant="outline" className="text-[10px]">{p.tipo === "produto" ? "Produto" : "Serviço"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{p.descricao || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmtMoney(p.valor_padrao)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} />
                        <Badge variant={p.ativo ? "default" : "secondary"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(p.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={150} />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={3} maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="produto">Produto</SelectItem>
                    <SelectItem value="servico">Serviço</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor padrão (R$)</Label>
                <Input type="number" step="0.01" min="0" value={form.valor_padrao} onChange={(e) => setForm({ ...form, valor_padrao: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="ativo">Ativo</Label>
              <Switch id="ativo" checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
