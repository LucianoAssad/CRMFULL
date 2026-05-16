// Respostas rápidas internas — apenas frontend, sem persistência.
// Não confundir com templates oficiais do WhatsApp.

export interface QuickReply {
  id: string;
  titulo: string;
  texto: string;
}

export const QUICK_REPLIES: QuickReply[] = [
  {
    id: "saudacao",
    titulo: "Saudação inicial",
    texto: "Olá! Tudo bem? Aqui é da equipe de atendimento. Como posso te ajudar hoje?",
  },
  {
    id: "cidade_bairro",
    titulo: "Pedir cidade/bairro",
    texto: "Para te atender melhor, pode me informar sua cidade e bairro?",
  },
  {
    id: "fotos",
    titulo: "Pedir fotos do estofado",
    texto: "Para te passar um orçamento mais preciso, pode me enviar algumas fotos do estofado, por favor?",
  },
  {
    id: "orcamento",
    titulo: "Enviar orientação de orçamento",
    texto: "O orçamento é gratuito e leva poucos minutos. Posso te passar o valor agora com base nas informações do estofado.",
  },
  {
    id: "follow_up",
    titulo: "Follow-up de orçamento",
    texto: "Oi! Passando para saber se conseguiu avaliar o orçamento que enviamos. Posso esclarecer alguma dúvida?",
  },
  {
    id: "agendamento",
    titulo: "Confirmação de agendamento",
    texto: "Perfeito! Seu atendimento está agendado. Vou te enviar uma confirmação próximo ao horário combinado.",
  },
];

export const MOTIVOS_FECHAMENTO: { id: string; label: string }[] = [
  { id: "venda_realizada", label: "Venda realizada" },
  { id: "orcamento_enviado", label: "Orçamento enviado" },
  { id: "sem_resposta", label: "Sem resposta" },
  { id: "sem_interesse", label: "Sem interesse" },
  { id: "fora_de_area", label: "Fora de área" },
  { id: "duplicado", label: "Duplicado" },
  { id: "atendimento_resolvido", label: "Atendimento resolvido" },
];
