import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { criarContaCompleta } from "@/lib/signup";

export default function Cadastro() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    empresa_nome: "",
    tipo_conta: "filha" as "gerente" | "filha",
    empresa_email: "",
    empresa_telefone: "",
    admin_nome: "",
    admin_email: "",
    admin_senha: "",
    admin_senha2: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((s) => ({ ...s, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.empresa_nome.trim()) return toast.error("Informe o nome da empresa.");
    if (!form.admin_nome.trim()) return toast.error("Informe o nome do administrador.");
    if (!/^\S+@\S+\.\S+$/.test(form.admin_email)) return toast.error("E-mail de acesso inválido.");
    if (form.admin_senha.length < 6) return toast.error("Senha deve ter ao menos 6 caracteres.");
    if (form.admin_senha !== form.admin_senha2) return toast.error("As senhas não coincidem.");

    setBusy(true);
    try {
      const res = await criarContaCompleta({
        empresa_nome: form.empresa_nome.trim(),
        tipo_conta: form.tipo_conta,
        empresa_email: form.empresa_email.trim() || undefined,
        empresa_telefone: form.empresa_telefone.trim() || undefined,
        admin_nome: form.admin_nome.trim(),
        admin_email: form.admin_email.trim().toLowerCase(),
        admin_senha: form.admin_senha,
      });
      try {
        localStorage.setItem("active_conta_id", res.empresa_id);
        localStorage.setItem(
          "active_role",
          res.tipo_conta === "gerente" ? "admin_gerente" : "admin_filha",
        );
        localStorage.setItem("modo_sistema", res.tipo_conta === "gerente" ? "manager" : "account");
      } catch {}
      toast.success("Conta criada com sucesso!");
      navigate(res.tipo_conta === "gerente" ? "/manager/contas" : "/account/onboarding", {
        replace: true,
      });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao criar conta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Criar sua conta</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comece criando sua empresa e seu acesso administrador.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Dados da empresa
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="empresa_nome">Nome da empresa *</Label>
                  <Input id="empresa_nome" value={form.empresa_nome} onChange={set("empresa_nome")} required />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de conta *</Label>
                  <RadioGroup
                    value={form.tipo_conta}
                    onValueChange={(v) => setForm((s) => ({ ...s, tipo_conta: v as any }))}
                    className="flex gap-4"
                  >
                    <label className="flex items-center gap-2 rounded-md border p-2 px-3 cursor-pointer">
                      <RadioGroupItem value="filha" /> Conta filha
                    </label>
                    <label className="flex items-center gap-2 rounded-md border p-2 px-3 cursor-pointer">
                      <RadioGroupItem value="gerente" /> Conta gerente
                    </label>
                  </RadioGroup>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="empresa_email">E-mail comercial</Label>
                    <Input id="empresa_email" type="email" value={form.empresa_email} onChange={set("empresa_email")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="empresa_telefone">WhatsApp / Telefone</Label>
                    <Input id="empresa_telefone" value={form.empresa_telefone} onChange={set("empresa_telefone")} />
                  </div>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Administrador da conta
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="admin_nome">Nome *</Label>
                  <Input id="admin_nome" value={form.admin_nome} onChange={set("admin_nome")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin_email">E-mail de acesso *</Label>
                  <Input id="admin_email" type="email" autoComplete="email" value={form.admin_email} onChange={set("admin_email")} required />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin_senha">Senha *</Label>
                    <Input id="admin_senha" type="password" autoComplete="new-password" value={form.admin_senha} onChange={set("admin_senha")} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin_senha2">Confirmar senha *</Label>
                    <Input id="admin_senha2" type="password" autoComplete="new-password" value={form.admin_senha2} onChange={set("admin_senha2")} required />
                  </div>
                </div>
              </section>

              <div className="flex items-center justify-between gap-3">
                <Link to="/login" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
                  Já tenho conta — entrar
                </Link>
                <Button type="submit" disabled={busy}>
                  {busy ? "Criando..." : "Criar conta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">O que será criado automaticamente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { icon: Building2, t: "Empresa" },
              { icon: ShieldCheck, t: "Usuário administrador" },
              { icon: CheckCircle2, t: "Vínculo de acesso" },
              { icon: CheckCircle2, t: "Pipeline padrão" },
              { icon: CheckCircle2, t: "Perfil comercial inicial" },
            ].map(({ icon: Icon, t }) => (
              <div key={t} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" /> {t}
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Você poderá completar produtos, canais e equipe depois, no checklist de onboarding.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
