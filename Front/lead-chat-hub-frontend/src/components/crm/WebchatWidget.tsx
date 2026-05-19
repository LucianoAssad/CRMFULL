import { useEffect, useState } from "react";
import { MessageCircle, X, Send, Check } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { captureTrackingFromUrl, getStoredTracking } from "@/lib/tracking";

interface LocalMsg {
  id: string;
  autor: "voce" | "sistema";
  conteudo: string;
  created_at: string;
}

const formSchema = z.object({
  nome: z.string().trim().min(2, "Informe seu nome").max(100),
  contato: z
    .string()
    .trim()
    .min(5, "Informe telefone ou email")
    .max(120),
  mensagem: z.string().trim().min(1, "Digite uma mensagem").max(1000),
});

const STORAGE_KEY = "webchat_history_v1";

export function WebchatWidget() {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [nome, setNome] = useState("");
  const [contato, setContato] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [history, setHistory] = useState<LocalMsg[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
    // garante captura ao montar (caso usuário acesse direto o widget)
    captureTrackingFromUrl();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  const isEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const enviar = async () => {
    const parsed = formSchema.safeParse({ nome, contato, mensagem });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSending(true);
    try {
      // 1. Empresa padrão (Empresa Teste)
      let { data: empresa } = await supabase
        .from("empresas")
        .select("*")
        .eq("nome", "Empresa Teste")
        .maybeSingle();
      if (!empresa) {
        const { data, error } = await supabase
          .from("empresas")
          .insert({ nome: "Empresa Teste" });
        if (error) throw error;
        empresa = data;
      }

      // 2. Canal webchat
      let { data: canal } = await supabase
        .from("canais_conectados")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("tipo", "webchat")
        .maybeSingle();
      if (!canal) {
        const { data, error } = await supabase
          .from("canais_conectados")
          .insert({ empresa_id: empresa.id, tipo: "webchat", nome: "Webchat", ativo: true });
        if (error) throw error;
        canal = data;
      }

      // Captura tracking persistido (gclid/fbclid/ttclid + utms + page_url)
      const tracking = { ...getStoredTracking(), ...captureTrackingFromUrl() };
      const email = isEmail(contato) ? contato : null;
      const telefone = !isEmail(contato) ? contato : null;
      const tags = [
        "canal:webchat",
        tracking.utm_source && `utm_source:${tracking.utm_source}`,
        tracking.utm_medium && `utm_medium:${tracking.utm_medium}`,
        tracking.utm_campaign && `utm_campaign:${tracking.utm_campaign}`,
        tracking.gclid && `gclid:${tracking.gclid}`,
        tracking.fbclid && `fbclid:${tracking.fbclid}`,
        tracking.ttclid && `ttclid:${tracking.ttclid}`,
      ].filter(Boolean) as string[];

      const trackingFields = {
        gclid: tracking.gclid ?? null,
        fbclid: tracking.fbclid ?? null,
        ttclid: tracking.ttclid ?? null,
        utm_source: tracking.utm_source ?? null,
        utm_medium: tracking.utm_medium ?? null,
        utm_campaign: tracking.utm_campaign ?? null,
        utm_content: tracking.utm_content ?? null,
        utm_term: tracking.utm_term ?? null,
        page_url: tracking.page_url ?? null,
      };

      // 3. Lead — buscar existente por telefone/email da mesma empresa
      let lead: any = null;
      if (telefone || email) {
        const query = supabase
          .from("leads")
          .select("*")
          .eq("empresa_id", empresa.id)
          .limit(1);
        const { data: existingArr } = telefone
          ? await query.eq("telefone", telefone)
          : await query.eq("email", email!);
        lead = existingArr?.[0] ?? null;
      }

      if (lead) {
        // Atualizar somente campos vazios
        const patch: Record<string, any> = {};
        for (const [k, v] of Object.entries(trackingFields)) {
          if (v && !lead[k]) patch[k] = v;
        }
        // Mesclar tags sem duplicar
        const existingTags: string[] = lead.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tags]));
        if (mergedTags.length !== existingTags.length) patch.tags = mergedTags;
        if (Object.keys(patch).length > 0) {
          const { error: upErr } = await supabase.from("leads").update(patch as any).eq("id", lead.id);
          if (upErr) throw upErr;
        }
      } else {
        const { data: novo, error: lErr } = await supabase
          .from("leads")
          .insert({
            empresa_id: empresa.id,
            nome: parsed.data.nome,
            telefone,
            email,
            origem: "site",
            status: "novo",
            tags,
            ...trackingFields,
          })
          .select()
          .single();
        if (lErr) throw lErr;
        lead = novo;
      }

      // 4. Conversa
      const { data: conv, error: cErr } = await supabase
        .from("conversas")
        .insert({
          empresa_id: empresa.id,
          lead_id: lead.id,
          canal_id: canal.id,
          status: "aberta",
          ultima_mensagem: parsed.data.mensagem,
        })
        .select()
        .single();
      if (cErr) throw cErr;

      // 5. Mensagem
      const { error: mErr } = await supabase.from("mensagens").insert({
        conversa_id: conv.id,
        direcao: "inbound",
        conteudo: parsed.data.mensagem,
        autor: parsed.data.nome,
      });
      if (mErr) throw mErr;

      setHistory((h) => [
        ...h,
        { id: crypto.randomUUID(), autor: "voce", conteudo: parsed.data.mensagem, created_at: new Date().toISOString() },
        { id: crypto.randomUUID(), autor: "sistema", conteudo: "Recebemos sua mensagem! Em breve responderemos.", created_at: new Date().toISOString() },
      ]);
      setMensagem("");
      toast.success("Mensagem enviada!");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar: " + (err.message || "erro"));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition hover:scale-105",
          open && "opacity-0 pointer-events-none"
        )}
      >
        <MessageCircle className="h-5 w-5" />
        Fale conosco
      </button>

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[560px] w-[92vw] max-w-sm flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between bg-[hsl(var(--sidebar-header,var(--primary)))] px-4 py-3 text-primary-foreground">
            <div>
              <h3 className="text-sm font-semibold">Fale conosco</h3>
              <p className="text-xs opacity-80">Resposta em alguns minutos</p>
            </div>
            <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 p-3">
            {history.length === 0 && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                Olá! 👋 Preencha seus dados e envie sua mensagem.
              </p>
            )}
            {history.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                  m.autor === "voce"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-card border"
                )}
              >
                {m.conteudo}
              </div>
            ))}
          </div>

          <div className="space-y-2 border-t bg-card p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nome</Label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" maxLength={100} />
              </div>
              <div>
                <Label className="text-xs">Telefone ou email</Label>
                <Input value={contato} onChange={(e) => setContato(e.target.value)} placeholder="(00) 00000-0000" maxLength={120} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                placeholder="Como podemos ajudar?"
                rows={2}
                maxLength={1000}
              />
            </div>
            <Button onClick={enviar} disabled={sending} className="w-full">
              {sending ? <Check className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {sending ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
