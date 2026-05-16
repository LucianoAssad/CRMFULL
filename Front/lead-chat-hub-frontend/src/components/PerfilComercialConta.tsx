import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "@/contexts/ActiveAccountContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { AlertCircle } from "lucide-react";

type Form = {
  nome_unidade: string;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  whatsapp: string;
  telefone: string;
  email: string;
  site: string;
  endereco_logradouro: string;
  endereco_numero: string;
  endereco_complemento: string;
  endereco_bairro: string;
  endereco_cidade: string;
  endereco_uf: string;
  endereco_cep: string;
  cor_primaria: string;
  logo_url: string;
  termos_orcamento_padrao: string;
  observacao_orcamento_padrao: string;
  validade_orcamento_padrao_dias: number;
  formas_pagamento_padrao: string;
  parcelamento_padrao: string;
};

const EMPTY: Form = {
  nome_unidade: "",
  nome_fantasia: "",
  razao_social: "",
  cnpj: "",
  whatsapp: "",
  telefone: "",
  email: "",
  site: "",
  endereco_logradouro: "",
  endereco_numero: "",
  endereco_complemento: "",
  endereco_bairro: "",
  endereco_cidade: "",
  endereco_uf: "",
  endereco_cep: "",
  cor_primaria: "",
  logo_url: "",
  termos_orcamento_padrao: "",
  observacao_orcamento_padrao: "",
  validade_orcamento_padrao_dias: 7,
  formas_pagamento_padrao: "",
  parcelamento_padrao: "",
};

export default function PerfilComercialConta() {
  const { activeConta } = useActiveAccount();
  const [perfilId, setPerfilId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const empresaId = activeConta?.id;

  const SEED_PRODUTOS = [
    { nome: "Higienização de sofá", descricao: "Higienização profissional de sofá", tipo: "servico", valor_padrao: 380 },
    { nome: "Higienização de poltrona", descricao: "Higienização profissional de poltrona", tipo: "servico", valor_padrao: 120 },
    { nome: "Higienização de colchão", descricao: "Higienização profissional de colchão", tipo: "servico", valor_padrao: 220 },
    { nome: "Higienização de tapete", descricao: "Higienização profissional de tapete", tipo: "servico", valor_padrao: 150 },
    { nome: "Impermeabilização", descricao: "Serviço adicional de impermeabilização", tipo: "servico", valor_padrao: 100 },
    { nome: "Taxa de deslocamento", descricao: "Taxa de deslocamento para atendimento", tipo: "servico", valor_padrao: 40 },
  ];

  const onSeedProdutos = async () => {
    if (!empresaId) return;
    setSeeding(true);
    try {
      const { data: existentes, error: errSel } = await supabase
        .from("produtos_servicos")
        .select("id, nome")
        .eq("empresa_id", empresaId)
        .eq("ativo", true);
      if (errSel) throw errSel;
      if ((existentes?.length ?? 0) > 0) {
        toast({ title: "Esta conta já possui produtos/serviços cadastrados." });
        setSeeding(false);
        return;
      }
      const payload = SEED_PRODUTOS.map((p) => ({ ...p, empresa_id: empresaId, ativo: true }));
      const { error: errIns } = await supabase.from("produtos_servicos").insert(payload);
      if (errIns) throw errIns;
      toast({ title: `${payload.length} produtos/serviços iniciais criados` });
    } catch (e: any) {
      toast({ title: "Erro ao criar produtos/serviços", description: e?.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const load = async () => {
    if (!empresaId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("empresa_perfil_comercial")
      .select("*")
      .eq("empresa_id", empresaId)
      .maybeSingle();
    if (error) {
      toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    }
    if (data) {
      setPerfilId(data.id);
      const formas = Array.isArray(data.formas_pagamento_padrao)
        ? (data.formas_pagamento_padrao as any[]).map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ")
        : "";
      setForm({
        nome_unidade: data.nome_unidade ?? "",
        nome_fantasia: data.nome_fantasia ?? "",
        razao_social: data.razao_social ?? "",
        cnpj: data.cnpj ?? "",
        whatsapp: data.whatsapp ?? "",
        telefone: data.telefone ?? "",
        email: data.email ?? "",
        site: data.site ?? "",
        endereco_logradouro: data.endereco_logradouro ?? "",
        endereco_numero: data.endereco_numero ?? "",
        endereco_complemento: data.endereco_complemento ?? "",
        endereco_bairro: data.endereco_bairro ?? "",
        endereco_cidade: data.endereco_cidade ?? "",
        endereco_uf: data.endereco_uf ?? "",
        endereco_cep: data.endereco_cep ?? "",
        cor_primaria: data.cor_primaria ?? "",
        logo_url: data.logo_url ?? "",
        termos_orcamento_padrao: data.termos_orcamento_padrao ?? "",
        observacao_orcamento_padrao: data.observacao_orcamento_padrao ?? "",
        validade_orcamento_padrao_dias: data.validade_orcamento_padrao_dias ?? 7,
        formas_pagamento_padrao: formas,
        parcelamento_padrao: data.parcelamento_padrao ?? "",
      });
    } else {
      setPerfilId(null);
      setForm(EMPTY);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, [empresaId]);

  const incompletos = useMemo(() => {
    const faltam: string[] = [];
    if (!form.nome_unidade.trim()) faltam.push("Nome da unidade");
    if (!form.razao_social.trim()) faltam.push("Razão social");
    if (!form.cnpj.trim()) faltam.push("CNPJ");
    if (!form.whatsapp.trim() && !form.telefone.trim()) faltam.push("WhatsApp ou telefone");
    if (!form.email.trim()) faltam.push("E-mail");
    if (!form.endereco_logradouro.trim() || !form.endereco_cidade.trim() || !form.endereco_uf.trim()) faltam.push("Endereço");
    return faltam;
  }, [form]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    if (!empresaId) return;
    if (!form.validade_orcamento_padrao_dias || form.validade_orcamento_padrao_dias <= 0) {
      toast({ title: "Validade inválida", description: "Validade padrão deve ser maior que zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const formas = form.formas_pagamento_padrao
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: any = {
      empresa_id: empresaId,
      nome_unidade: form.nome_unidade.trim() || null,
      nome_fantasia: form.nome_fantasia.trim() || null,
      razao_social: form.razao_social.trim() || null,
      cnpj: form.cnpj.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      telefone: form.telefone.trim() || null,
      email: form.email.trim() || null,
      site: form.site.trim() || null,
      endereco_logradouro: form.endereco_logradouro.trim() || null,
      endereco_numero: form.endereco_numero.trim() || null,
      endereco_complemento: form.endereco_complemento.trim() || null,
      endereco_bairro: form.endereco_bairro.trim() || null,
      endereco_cidade: form.endereco_cidade.trim() || null,
      endereco_uf: form.endereco_uf.trim() || null,
      endereco_cep: form.endereco_cep.trim() || null,
      cor_primaria: form.cor_primaria.trim() || null,
      logo_url: form.logo_url.trim() || null,
      termos_orcamento_padrao: form.termos_orcamento_padrao.trim() || null,
      observacao_orcamento_padrao: form.observacao_orcamento_padrao.trim() || null,
      validade_orcamento_padrao_dias: form.validade_orcamento_padrao_dias,
      formas_pagamento_padrao: formas,
      parcelamento_padrao: form.parcelamento_padrao.trim() || null,
    };
    if (perfilId) payload.id = perfilId;

    const { error } = await supabase
      .from("empresa_perfil_comercial")
      .upsert(payload, { onConflict: "empresa_id" });
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Perfil comercial salvo" });
    await load();
  };

  if (!empresaId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil comercial da conta</CardTitle>
        <CardDescription>
          Dados que serão usados futuramente em orçamentos e PDFs desta conta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {incompletos.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              Dados incompletos podem impedir a geração de PDF em etapa futura.
              <div className="text-xs opacity-80 mt-1">Pendentes: {incompletos.join(", ")}.</div>
            </div>
          </div>
        )}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Identificação</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome da unidade"><Input value={form.nome_unidade} onChange={(e) => set("nome_unidade", e.target.value)} /></Field>
            <Field label="Nome fantasia"><Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} /></Field>
            <Field label="Razão social"><Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></Field>
            <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Contato</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="WhatsApp"><Input value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Field>
            <Field label="Telefone"><Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} /></Field>
            <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
            <Field label="Site"><Input value={form.site} onChange={(e) => set("site", e.target.value)} /></Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Endereço</h3>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="md:col-span-4"><Field label="Logradouro"><Input value={form.endereco_logradouro} onChange={(e) => set("endereco_logradouro", e.target.value)} /></Field></div>
            <div className="md:col-span-1"><Field label="Número"><Input value={form.endereco_numero} onChange={(e) => set("endereco_numero", e.target.value)} /></Field></div>
            <div className="md:col-span-1"><Field label="UF"><Input maxLength={2} value={form.endereco_uf} onChange={(e) => set("endereco_uf", e.target.value.toUpperCase())} /></Field></div>
            <div className="md:col-span-2"><Field label="Complemento"><Input value={form.endereco_complemento} onChange={(e) => set("endereco_complemento", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Bairro"><Input value={form.endereco_bairro} onChange={(e) => set("endereco_bairro", e.target.value)} /></Field></div>
            <div className="md:col-span-1"><Field label="Cidade"><Input value={form.endereco_cidade} onChange={(e) => set("endereco_cidade", e.target.value)} /></Field></div>
            <div className="md:col-span-1"><Field label="CEP"><Input value={form.endereco_cep} onChange={(e) => set("endereco_cep", e.target.value)} /></Field></div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Identidade visual</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Cor primária" hint="Ex.: #2563eb">
              <div className="flex gap-2 items-center">
                <Input value={form.cor_primaria} onChange={(e) => set("cor_primaria", e.target.value)} placeholder="#000000" />
                {form.cor_primaria && <span className="h-9 w-9 rounded border" style={{ background: form.cor_primaria }} />}
              </div>
            </Field>
            <Field label="URL da logo" hint="Upload de logo será implementado em etapa futura.">
              <Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." />
            </Field>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-semibold">Padrões de orçamento</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Validade padrão (dias)">
              <Input
                type="number"
                min={1}
                value={form.validade_orcamento_padrao_dias}
                onChange={(e) => set("validade_orcamento_padrao_dias", Number(e.target.value) || 0)}
              />
            </Field>
            <Field label="Parcelamento padrão" hint="Ex.: até 3x sem juros">
              <Input value={form.parcelamento_padrao} onChange={(e) => set("parcelamento_padrao", e.target.value)} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Formas de pagamento padrão" hint="Separe por vírgula. Ex.: Pix, Cartão, Dinheiro">
                <Input value={form.formas_pagamento_padrao} onChange={(e) => set("formas_pagamento_padrao", e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Termos padrão de orçamento">
                <Textarea rows={3} value={form.termos_orcamento_padrao} onChange={(e) => set("termos_orcamento_padrao", e.target.value)} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Observação padrão de orçamento">
                <Textarea rows={3} value={form.observacao_orcamento_padrao} onChange={(e) => set("observacao_orcamento_padrao", e.target.value)} />
              </Field>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 pt-2">
          <Button onClick={onSave} disabled={saving || loading}>
            {saving ? "Salvando..." : perfilId ? "Salvar alterações" : "Criar perfil comercial"}
          </Button>
          <Button variant="outline" onClick={onSeedProdutos} disabled={seeding}>
            {seeding ? "Criando..." : "Criar produtos/serviços iniciais"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
