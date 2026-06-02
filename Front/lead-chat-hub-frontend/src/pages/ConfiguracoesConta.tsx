import { useEffect, useRef, useState } from "react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatCodigoPublico } from "@/lib/codigo-publico";
import PerfilComercialConta from "@/components/PerfilComercialConta";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2 } from "lucide-react";

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

// Brazilian phone mask: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
function maskPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
  return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
}

export default function ConfiguracoesConta() {
  const { activeConta, reload } = useActiveAccount();
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [gerente, setGerente] = useState<{ nome: string; codigo_publico: string | null } | null>(null);
  const [form, setForm] = useState<Form>({ nome: "", telefone: "", email: "", site: "", documento: "" });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const emailCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFilha = activeConta?.tipo_conta === "filha";

  const load = async () => {
    if (!activeConta || !isFilha) return;
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
        const { data: g } = await supabase
          .from("empresas")
          .select("nome, codigo_publico")
          .eq("id", e.conta_gerente_id)
          .maybeSingle();
        setGerente((g as any) ?? null);
      } else {
        setGerente(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [activeConta?.id]);

  if (!activeConta) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Selecione uma conta para continuar.</p>
      </div>
    );
  }

  if (!isFilha) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Este módulo está disponível apenas para Contas Filhas.</p>
      </div>
    );
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

  const checkEmailUnique = async (email: string) => {
    if (!email.trim() || !empresa) { setEmailError(null); return; }
    const { data } = await supabase
      .from("empresas")
      .select("id")
      .eq("email", email.trim().toLowerCase())
      .neq("id", empresa.id)
      .maybeSingle();
    setEmailError(data ? "Este e-mail já está cadastrado em outra empresa." : null);
  };

  const onEmailChange = (value: string) => {
    setForm({ ...form, email: value });
    setEmailError(null);
    if (emailCheckTimer.current) clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(() => checkEmailUnique(value), 600);
  };

  const onSave = async () => {
    if (!empresa) return;
    if (!form.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    if (emailError) {
      toast({ title: "E-mail inválido", description: emailError, variant: "destructive" });
      return;
    }
    // Final email check before save
    if (form.email.trim()) {
      const { data } = await supabase
        .from("empresas")
        .select("id")
        .eq("email", form.email.trim().toLowerCase())
        .neq("id", empresa.id)
        .maybeSingle();
      if (data) {
        setEmailError("Este e-mail já está cadastrado em outra empresa.");
        toast({ title: "E-mail já cadastrado", description: "Use outro e-mail.", variant: "destructive" });
        return;
      }
    }
    setSaving(true);
    const { error } = await supabase
      .from("empresas")
      .update({
        nome: form.nome.trim(),
        telefone: form.telefone.trim() || null,
        email: form.email.trim() || null,
        site: form.site.trim() || null,
        documento: form.documento.trim() || null,
      })
      .eq("id", empresa.id);
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

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Gerencie os dados básicos desta conta operacional.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
          <CardDescription>Informações desta Conta Filha.</CardDescription>
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
                <Badge variant="secondary">Conta Filha</Badge>
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
              <Input
                id="telefone"
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: maskPhone(e.target.value) })}
                placeholder="(11) 99999-9999"
                maxLength={15}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => onEmailChange(e.target.value)}
                maxLength={150}
                className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {emailError && <p className="text-xs text-destructive">{emailError}</p>}
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
          <CardTitle>Conta Gerente responsável</CardTitle>
          <CardDescription>
            Esta informação é apenas consultiva. Para alterar vínculo ou propriedade, acesse Acesso e segurança em uma Conta Gerente autorizada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {empresa?.conta_gerente_id ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nome</Label>
                <div className="text-sm">{gerente?.nome ?? "—"}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Código público</Label>
                <div className="font-mono text-sm">{formatCodigoPublico(gerente?.codigo_publico)}</div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de vínculo</Label>
                <div><Badge variant="outline">{vinculoLabel}</Badge></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Esta conta não possui Conta Gerente vinculada.</p>
          )}
        </CardContent>
      </Card>

      <PerfilComercialConta />
      {activeConta?.id && <SaudacoesAutomaticasPanel empresaId={activeConta.id} />}
    </div>
  );
}

// ── Saudações automáticas ────────────────────────────────────────────────────
interface SaudacaoMsg { conteudo: string; delay_s: number }

function SaudacoesAutomaticasPanel({ empresaId }: { empresaId: string }) {
  const [ativo, setAtivo] = useState(false);
  const [msgs, setMsgs] = useState<SaudacaoMsg[]>([{ conteudo: "", delay_s: 0 }]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const configId = `saudacao_automatica_${empresaId}`;

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("configuracoes_conversao" as any)
        .select("configuracao")
        .eq("empresa_id", empresaId)
        .eq("tipo", "saudacao_automatica")
        .maybeSingle();
      if (data) {
        try {
          const cfg = JSON.parse((data as any).configuracao || "{}");
          setAtivo(cfg.ativo ?? false);
          setMsgs(cfg.mensagens?.length ? cfg.mensagens : [{ conteudo: "", delay_s: 0 }]);
        } catch { /* ignore */ }
      }
      setLoading(false);
    })();
  }, [empresaId]);

  const save = async () => {
    setSaving(true);
    const cfg = JSON.stringify({ ativo, mensagens: msgs.filter((m) => m.conteudo.trim()) });
    // Upsert via check first
    const { data: existing } = await supabase
      .from("configuracoes_conversao" as any)
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("tipo", "saudacao_automatica")
      .maybeSingle();
    if (existing) {
      await supabase.from("configuracoes_conversao" as any).update({ configuracao: cfg } as any).eq("id", (existing as any).id);
    } else {
      await supabase.from("configuracoes_conversao" as any).insert({ empresa_id: empresaId, tipo: "saudacao_automatica", nome: "Saudação automática", configuracao: cfg } as any);
    }
    setSaving(false);
    toast({ title: "Saudações automáticas salvas" });
  };

  const addMsg = () => {
    if (msgs.length >= 5) return;
    setMsgs([...msgs, { conteudo: "", delay_s: 5 }]);
  };

  const removeMsg = (i: number) => setMsgs(msgs.filter((_, idx) => idx !== i));

  const updateMsg = (i: number, field: keyof SaudacaoMsg, val: string | number) =>
    setMsgs(msgs.map((m, idx) => idx === i ? { ...m, [field]: val } : m));

  if (loading) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Saudação automática</CardTitle>
            <CardDescription className="text-sm">
              Envie até 5 mensagens automáticas quando um novo contato iniciar uma conversa.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{ativo ? "Ativo" : "Inativo"}</span>
            <Switch checked={ativo} onCheckedChange={setAtivo} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {msgs.map((msg, i) => (
          <div key={i} className="rounded-md border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Mensagem {i + 1}</span>
              {msgs.length > 1 && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeMsg(i)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
            <Textarea
              value={msg.conteudo}
              onChange={(e) => updateMsg(i, "conteudo", e.target.value)}
              placeholder="Olá {{nome}}, como posso ajudar?"
              rows={2}
              className="text-sm"
            />
            <div className="flex items-center gap-2 text-sm">
              <Label className="whitespace-nowrap text-xs">Delay (segundos)</Label>
              <Input
                type="number"
                min={0}
                max={300}
                value={msg.delay_s}
                onChange={(e) => updateMsg(i, "delay_s", Number(e.target.value))}
                className="w-24 h-7 text-xs"
              />
              <span className="text-xs text-muted-foreground">após mensagem anterior</span>
            </div>
          </div>
        ))}
        <div className="flex items-center gap-2">
          {msgs.length < 5 && (
            <Button size="sm" variant="outline" onClick={addMsg}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Adicionar mensagem
            </Button>
          )}
          <span className="text-xs text-muted-foreground">{msgs.length}/5 mensagens</span>
          <Button size="sm" className="ml-auto" onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Use <code>{"{{nome}}"}</code> para o nome do contato, <code>{"{{telefone}}"}</code> para o telefone.
          As mensagens só serão enviadas se o canal suportar mensagens automáticas.
        </p>
      </CardContent>
    </Card>
  );
}
