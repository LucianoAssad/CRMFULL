import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { api } from "@/integrations/supabase/client";

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [show, setShow] = useState({ atual: false, nova: false, confirmar: false });
  const [loading, setLoading] = useState(false);

  const requisitos = [
    { ok: form.novaSenha.length >= 8, label: "Mínimo 8 caracteres" },
    { ok: /[A-Z]/.test(form.novaSenha), label: "Uma letra maiúscula" },
    { ok: /[0-9]/.test(form.novaSenha), label: "Um número" },
    { ok: form.novaSenha === form.confirmar && form.confirmar.length > 0, label: "Senhas coincidem" },
  ];
  const valido = requisitos.every((r) => r.ok) && form.senhaAtual.length > 0;

  const handleSave = async () => {
    if (!valido) return;
    setLoading(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword: form.senhaAtual,
        newPassword: form.novaSenha,
      });
      toast.success("Senha alterada com sucesso! Bem-vindo(a) 🎉");
      // Remove first-access flag from stored session
      const stored = localStorage.getItem("access_token");
      if (stored) {
        // Force token refresh so primeiroAcesso=false is reflected
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
      }
      navigate("/login", { replace: true });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Senha atual incorreta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Primeiro acesso</CardTitle>
          <CardDescription>
            Por segurança, defina uma nova senha antes de continuar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Senha atual (temporária) */}
          <div className="space-y-1.5">
            <Label>Senha temporária (recebida por e-mail)</Label>
            <div className="relative">
              <Input
                type={show.atual ? "text" : "password"}
                value={form.senhaAtual}
                onChange={(e) => setForm({ ...form, senhaAtual: e.target.value })}
                placeholder="Digite a senha do e-mail"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow({ ...show, atual: !show.atual })}
              >
                {show.atual ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Nova senha */}
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={show.nova ? "text" : "password"}
                value={form.novaSenha}
                onChange={(e) => setForm({ ...form, novaSenha: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow({ ...show, nova: !show.nova })}
              >
                {show.nova ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar */}
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <div className="relative">
              <Input
                type={show.confirmar ? "text" : "password"}
                value={form.confirmar}
                onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                placeholder="Repita a nova senha"
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShow({ ...show, confirmar: !show.confirmar })}
              >
                {show.confirmar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Requisitos */}
          {form.novaSenha.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
              {requisitos.map((r) => (
                <div key={r.label} className="flex items-center gap-2 text-sm">
                  <CheckCircle
                    className={`h-4 w-4 flex-shrink-0 ${r.ok ? "text-green-500" : "text-muted-foreground"}`}
                  />
                  <span className={r.ok ? "text-foreground" : "text-muted-foreground"}>{r.label}</span>
                </div>
              ))}
            </div>
          )}

          <Button className="w-full" disabled={!valido || loading} onClick={handleSave}>
            {loading ? "Salvando..." : "Definir nova senha e entrar"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
