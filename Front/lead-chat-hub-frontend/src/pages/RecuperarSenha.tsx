import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const redirectTo = `${window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Se o e-mail existir, enviaremos um link de redefinição.");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-xl">Recuperar senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Informe seu e-mail. Este fluxo só funciona para e-mails reais que recebem mensagens.
          </p>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-sm">
              <p>Se houver uma conta com esse e-mail, um link de redefinição foi enviado.</p>
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">Voltar para o login</Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <div className="pt-2 text-center text-sm">
                <Link to="/login" className="text-primary underline-offset-4 hover:underline">Voltar para o login</Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
