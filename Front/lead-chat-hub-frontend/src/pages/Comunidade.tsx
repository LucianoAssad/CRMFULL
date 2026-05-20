import React from "react";
import { Users, BookOpen, Video, MessageCircle, Award, ExternalLink, Rocket, Star } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const RECURSOS = [
  {
    icon: Video, titulo: "Treinamentos em vídeo", desc: "Tutoriais completos de todas as funcionalidades do CRM, do básico ao avançado.",
    badge: "Em breve", cor: "text-primary", action: null,
  },
  {
    icon: BookOpen, titulo: "Documentação completa", desc: "Guias detalhados, referência da API e manuais de configuração.",
    badge: "Em breve", cor: "text-info", action: null,
  },
  {
    icon: MessageCircle, titulo: "Fórum de discussão", desc: "Tire dúvidas, compartilhe estratégias e aprenda com outros usuários.",
    badge: "Em breve", cor: "text-success", action: null,
  },
  {
    icon: Award, titulo: "Certificação Krescer", desc: "Torne-se um especialista certificado e mostre sua competência na plataforma.",
    badge: "Em breve", cor: "text-warning", action: null,
  },
];

const LINKS_UTEIS = [
  { titulo: "Suporte via WhatsApp", desc: "Fale direto com nosso time de suporte", icon: MessageCircle, url: "https://wa.me/5521999999999" },
  { titulo: "Canal no YouTube", desc: "Tutoriais e novidades em vídeo", icon: Video, url: "https://youtube.com" },
  { titulo: "Grupo de usuários", desc: "Comunidade no WhatsApp com usuários da plataforma", icon: Users, url: "#" },
  { titulo: "Roadmap público", desc: "Veja o que estamos desenvolvendo", icon: Rocket, url: "#" },
];

const NOVIDADES = [
  { titulo: "P1 features lançadas", desc: "Quick replies, variáveis, PTT, mensagens programadas e muito mais.", data: "Mai 2026", tag: "Novo" },
  { titulo: "P2: Agendamentos e Chatbot", desc: "Calendário completo, chatbot IA, catálogo no chat e grupos WhatsApp.", data: "Mai 2026", tag: "Novo" },
  { titulo: "P3: Afiliados e Integrações", desc: "Programa de afiliados, Zapier, RD Station, HubSpot e base de conhecimento.", data: "Mai 2026", tag: "Novo" },
  { titulo: "UTM Dashboard tabs", desc: "Analise campanhas por Source, Medium, Conjunto e Anúncio.", data: "Mai 2026", tag: "Melhoria" },
  { titulo: "Pipeline inline edit", desc: "Renomeie colunas do Pipeline com um clique direto no nome.", data: "Mai 2026", tag: "Melhoria" },
];

export default function Comunidade() {
  return (
    <div className="p-6 space-y-8">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border p-8 text-center space-y-3">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 mx-auto">
          <Users className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Comunidade Krescer</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">
          Um espaço para aprender, crescer e se conectar com outros usuários da plataforma.
          Treinamentos, certificações e suporte especializado.
        </p>
        <Badge variant="outline" className="text-sm px-4 py-1">🚀 Em construção — em breve disponível</Badge>
      </div>

      {/* Recursos */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">O que vai ter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RECURSOS.map((r) => (
            <Card key={r.titulo} className="text-center border-dashed">
              <CardContent className="pt-6 space-y-3">
                <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-muted mx-auto ${r.cor}`}>
                  <r.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-sm">{r.titulo}</p>
                  <p className="text-xs text-muted-foreground mt-1">{r.desc}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">{r.badge}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Links úteis */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Enquanto isso, use:</h2>
          <div className="space-y-2">
            {LINKS_UTEIS.map((l) => (
              <Card key={l.titulo} className="hover:border-primary/40 transition-colors">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <l.icon className="h-5 w-5 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{l.titulo}</p>
                        <p className="text-xs text-muted-foreground">{l.desc}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" asChild>
                      <a href={l.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Novidades */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Últimas atualizações</h2>
          <div className="space-y-2">
            {NOVIDADES.map((n) => (
              <div key={n.titulo} className="flex items-start gap-3 rounded-md border p-3">
                <Star className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium">{n.titulo}</p>
                    <Badge variant={n.tag === "Novo" ? "default" : "secondary"} className="text-[9px] px-1.5">
                      {n.tag}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{n.data}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-xl border bg-muted/30 p-6 text-center space-y-3">
        <h3 className="font-semibold">Quer receber novidades em primeira mão?</h3>
        <p className="text-sm text-muted-foreground">Entre no grupo de usuários beta e ajude a moldar o futuro da plataforma.</p>
        <Button>
          <MessageCircle className="mr-2 h-4 w-4" /> Entrar no grupo WhatsApp
        </Button>
      </div>
    </div>
  );
}
