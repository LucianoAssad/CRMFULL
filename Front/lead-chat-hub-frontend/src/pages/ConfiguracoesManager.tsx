import { useEffect, useState } from "react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatCodigoPublico } from "@/lib/codigo-publico";

type Empresa = {
  id: string;
  nome: string;
  codigo_publico: string | null;
  tipo_conta: "gerente" | "filha";
  conta_gerente_id: string | null;
  tipo_vinculo_gerente: string | null;
  telefone: string | null;
  email: string | null;
  site: string | null;
  documento: string | null;
  ativo: boolean;
};

type Form = {
  nome: string;
  telefone: string;
  email: string;
  site: string;
  documento: string;
};

export default function ConfiguracoesManager() {
  const { activeConta, reload } = useActiveAccount();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [pai, setPai] = useState<{ nome: string; codigo_publico: string | null } | null>(null);
  const [counts, setCounts] = useState({ gerentes: 0, filhas: 0 });
  const [form, setForm] = useState<Form>({ nome: "", telefone: "", email: "", site: "", documento: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isGerente = activeConta?.tipo_conta === "gerente";

  const load = async () => {
    if (!activeConta || !isGerente) return;
    setLoading(true);
    const { data } = await supabase
      .from("empresas")
      .select("id, nome, codigo_publico, tipo_conta, conta_gerente_id, tipo_vinculo_gerente, telefone, email, site, documento, ativo")
      .eq("id", activeConta.id)
      .maybeSingle();
    if (data) {
      const e = data as any as Empresa;
      setEmpresa(e);
      setForm({
        nome: e.nome ?? "",
        telefone: e.telefone ?? "",
        email: e.email ?? "",
        site: e.site ?? "",
        documento: e.documento ?? "",
      });
      if (e.conta_gerente_id) {
        const { data: p } = await supabase
          .from("empresas").select("nome, codigo_publico")
          .eq("id", e.conta_gerente_id).maybeSingle();
        setPai((p as any) ?? null);
      } else {
        setPai(null);
      }
      // Compute subtree counts by traversing
      const { data: all } = await supabase
        .from("empresas")
        .select("id, conta_gerente_id, tipo_conta");
      const list = (all as any[]) || [];
      const childrenByParent = new Map<string, any[]>();
      list.forEach((c) => {
        if (!c.conta_gerente_id) return;
        const arr = childrenByParent.get(c.conta_gerente_id) || [];
        arr.push(c);
        childrenByParent.set(c.conta_gerente_id, arr);
      });
      let gerentes = 0, filhas = 0;
      const stack = [e.id];
      const seen = new Set<string>();
      while (stack.length) {
        const cur = stack.pop()!;
        const kids = childrenByParent.get(cur) || [];
        for (const k of kids) {
          if (seen.has(k.id)) continue;
          seen.add(k.id);
          if (k.tipo_conta === "gerente") gerentes++;
          else filhas++;
          stack.push(k.id);
        }
      }
      setCounts({ gerentes, filhas });
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeConta?.id]);

  if (!activeConta) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Selecione uma conta para continuar.</p></div>;
  }
  if (!isGerente) {
    return <div className="p-6"><p className="text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Gerente.</p></div>;
  }

  const onCancel = () => {
    if (!empresa) return;
    setForm({
      nome: empresa.nome ?? "",
      telefone: empresa.telefone ?? "",
      email: empresa.email ?? "",
      site: empresa.site ?? "",
      documento: empresa.documento ?? "",
    });
  };

  const onSave = async () => {
    if (!empresa) return;
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("empresas").update({
      nome: form.nome.trim(),
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      site: form.site.trim() || null,
      documento: form.documento.trim() || null,
    }).eq("id", empresa.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Alterações salvas" });
    await load();
    await reload();
  };

  const vinculoLabel = empresa?.tipo_vinculo_gerente === "gerenciamento" ? "Gerenciamento" : "Propriedade";
  const total = counts.gerentes + counts.filhas;

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os dados básicos desta Conta Gerente.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da Conta Gerente</CardTitle>
          <CardDescription>Informações desta Conta Gerente.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código público</Label>
              <Input value={formatCodigoPublico(empresa?.codigo_publico)} disabled readOnly />
            </div>
            <div className="space-y-2">
              <Label>Tipo da conta</Label>
              <div className="flex items-center gap-2 h-10">
                <Badge variant="secondary">Conta Gerente</Badge>
                {empresa && (
                  <Badge variant={empresa.ativo ? "default" : "outline"}>
                    {empresa.ativo ? "Ativa" : "Inativa"}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={150} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} maxLength={30} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={150} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site">Site</Label>
              <Input id="site" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documento">Documento</Label>
              <Input id="documento" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} maxLength={30} />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={onSave} disabled={saving || loading}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
            <Button variant="outline" onClick={onCancel} disabled={saving}>Cancelar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hierarquia da Conta Gerente</CardTitle>
          <CardDescription>Posição desta conta na árvore de gestão.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {empresa?.conta_gerente_id ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Conta Gerente pai</Label>
                <div className="text-sm">{pai?.nome ?? "—"}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Código público</Label>
                <div className="font-mono text-sm">{formatCodigoPublico(pai?.codigo_publico)}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de vínculo</Label>
                <div><Badge variant="outline">{vinculoLabel}</Badge></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta é uma Conta Gerente raiz.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contas gerentes descendentes</Label>
              <div className="text-2xl font-semibold">{counts.gerentes}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Contas filhas descendentes</Label>
              <div className="text-2xl font-semibold">{counts.filhas}</div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Total na subárvore</Label>
              <div className="text-2xl font-semibold">{total}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escopo de gestão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>Esta conta pode gerenciar contas abaixo dela na hierarquia.</p>
          <p>Relatórios e dashboards em modo Manager consideram a subárvore da Conta Gerente ativa.</p>
          <p>Contas Filhas são as unidades operacionais onde Atendimento, Leads, Pipeline, Vendas e Conversões acontecem.</p>
        </CardContent>
      </Card>
    </div>
  );
}
