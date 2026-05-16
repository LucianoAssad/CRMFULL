/**
 * Regras de conversão por plataforma (Google Ads, Meta Ads, TikTok Ads).
 * Camada utilitária pura — não chama APIs externas, não acessa banco.
 *
 * Usada por /account/conversoes para validar destinos e gerar payload preview.
 */

// =============================================================================
// Tipos
// =============================================================================

export type ConversionPlatform = "google_ads" | "meta_ads" | "tiktok_ads";

export type SendMethod = "csv" | "google_sheets" | "api_oficial";

export type DestinationStatus =
  | "pendente"
  | "pronto_para_exportar"
  | "exportado_csv"
  | "sincronizado_google_sheets"
  | "enviado_api"
  | "erro"
  | "nao_aplicavel";

export type GoogleEventType = "offline_click_conversion" | "enhanced_conversion_lead";
export type MetaEventType = "Lead" | "Contact" | "Purchase" | "CompleteRegistration";
export type TikTokEventType = "SubmitForm" | "Contact" | "CompletePayment";
export type AnyEventType = GoogleEventType | MetaEventType | TikTokEventType;

export interface ConversaoCore {
  id?: string;
  empresa_id?: string;
  lead_id?: string | null;
  valor?: number | null;
  convertido_em?: string | null;
  data_conversao?: string | null;
  nome_conversao?: string | null;
  gclid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  email?: string | null;
  telefone?: string | null;
  // identificadores opcionais que podem ter sido capturados
  gbraid?: string | null;
  wbraid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
}

export interface LeadCore {
  id?: string;
  email?: string | null;
  telefone?: string | null;
  nome?: string | null;
}

export interface IdentidadeCore {
  tipo: string;
  valor: string;
  canal?: string | null;
}

export interface ConfiguracaoConversaoCore {
  plataforma: ConversionPlatform;
  ativo: boolean;
  metodo_padrao?: SendMethod;
  google_customer_id?: string | null;
  google_conversion_action_id?: string | null;
  meta_pixel_id?: string | null;
  meta_dataset_id?: string | null;
  tiktok_advertiser_id?: string | null;
  tiktok_event_source_id?: string | null;
  token_status?: string;
}

export interface ValidationParams {
  plataforma: ConversionPlatform;
  metodo_envio: SendMethod;
  tipo_evento_plataforma?: AnyEventType | string | null;
  conversao: ConversaoCore;
  lead?: LeadCore | null;
  identidades?: IdentidadeCore[];
  configuracao?: ConfiguracaoConversaoCore | null;
}

export interface ValidationResult {
  status: "pronto_para_exportar" | "pendente" | "nao_aplicavel" | "erro";
  pendencias: string[];
  identificadores_disponiveis: Record<string, string>;
  payload_preview: Record<string, any>;
}

// =============================================================================
// Labels
// =============================================================================

const PLATFORM_LABELS: Record<ConversionPlatform, string> = {
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
  tiktok_ads: "TikTok Ads",
};

const METHOD_LABELS: Record<SendMethod, string> = {
  csv: "CSV",
  google_sheets: "Google Sheets",
  api_oficial: "API oficial",
};

const STATUS_LABELS: Record<DestinationStatus, string> = {
  pendente: "Pendente",
  pronto_para_exportar: "Pronto para exportar",
  exportado_csv: "Exportado CSV",
  sincronizado_google_sheets: "Sincronizado Google Sheets",
  enviado_api: "Enviado via API",
  erro: "Erro",
  nao_aplicavel: "Não aplicável",
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  // Google
  offline_click_conversion: "Click conversion (offline)",
  enhanced_conversion_lead: "Enhanced conversion (lead)",
  // Meta
  Lead: "Lead",
  Contact: "Contato",
  Purchase: "Compra",
  CompleteRegistration: "Cadastro concluído",
  // TikTok
  SubmitForm: "Envio de formulário",
  CompletePayment: "Pagamento concluído",
};

export function getConversionPlatformLabel(p: string | null | undefined): string {
  if (!p) return "—";
  return PLATFORM_LABELS[p as ConversionPlatform] || p;
}

export function getSendMethodLabel(m: string | null | undefined): string {
  if (!m) return "—";
  return METHOD_LABELS[m as SendMethod] || m;
}

export function getDestinationStatusLabel(s: string | null | undefined): string {
  if (!s) return "—";
  return STATUS_LABELS[s as DestinationStatus] || s;
}

export function getEventTypeLabel(_plataforma: string, tipoEvento: string | null | undefined): string {
  if (!tipoEvento) return "—";
  return EVENT_TYPE_LABELS[tipoEvento] || tipoEvento;
}

// =============================================================================
// Métodos e eventos disponíveis por plataforma
// =============================================================================

export function getAvailableMethods(plataforma: ConversionPlatform): SendMethod[] {
  switch (plataforma) {
    case "google_ads":
      return ["csv", "google_sheets", "api_oficial"];
    case "meta_ads":
      return ["csv", "api_oficial"];
    case "tiktok_ads":
      return ["csv", "api_oficial"];
  }
}

export function getEventTypes(plataforma: ConversionPlatform): AnyEventType[] {
  switch (plataforma) {
    case "google_ads":
      return ["offline_click_conversion", "enhanced_conversion_lead"];
    case "meta_ads":
      return ["Lead", "Contact", "Purchase", "CompleteRegistration"];
    case "tiktok_ads":
      return ["SubmitForm", "Contact", "CompletePayment"];
  }
}

export function getRequiredIdentifiers(
  plataforma: ConversionPlatform,
  tipoEvento?: AnyEventType | string | null
): string[] {
  if (plataforma === "google_ads") {
    if (tipoEvento === "enhanced_conversion_lead") return ["email", "telefone"];
    // default offline_click_conversion
    return ["gclid", "gbraid", "wbraid"];
  }
  if (plataforma === "meta_ads") {
    return ["fbclid", "fbc", "fbp", "email", "telefone"];
  }
  // tiktok
  return ["ttclid", "email", "telefone"];
}

// =============================================================================
// Normalização (sem hash real nesta etapa, mas estruturado para isso)
// =============================================================================

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const v = email.trim().toLowerCase();
  return v || null;
}

export function normalizePhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D+/g, "");
  return digits || null;
}

export function maskIdentifier(value?: string | null): string {
  if (!value) return "—";
  const v = String(value);
  if (v.includes("@")) {
    const [user, domain] = v.split("@");
    const head = user.slice(0, 2);
    return `${head}***@${domain}`;
  }
  if (v.length <= 4) return "***";
  return `${v.slice(0, 2)}***${v.slice(-2)}`;
}

// Placeholder para futura implementação de hash (SHA-256 lowercase)
export function hashIdentifierPlaceholder(value: string): string {
  return value; // será substituído quando enviar via API oficial
}

// =============================================================================
// Coletar identificadores disponíveis
// =============================================================================

function pickFromIdentidades(
  identidades: IdentidadeCore[] | undefined,
  tipos: string[]
): string | null {
  if (!identidades || identidades.length === 0) return null;
  for (const t of tipos) {
    const found = identidades.find((i) => i.tipo === t && i.valor);
    if (found) return found.valor;
  }
  return null;
}

function coletarIdentificadores(p: ValidationParams): Record<string, string> {
  const { conversao, lead, identidades } = p;
  const ids: Record<string, string> = {};

  // Click IDs (na conversão)
  if (conversao.gclid) ids.gclid = conversao.gclid;
  if (conversao.gbraid) ids.gbraid = conversao.gbraid;
  if (conversao.wbraid) ids.wbraid = conversao.wbraid;
  if (conversao.fbclid) ids.fbclid = conversao.fbclid;
  if (conversao.fbc) ids.fbc = conversao.fbc;
  if (conversao.fbp) ids.fbp = conversao.fbp;
  if (conversao.ttclid) ids.ttclid = conversao.ttclid;

  // Email/telefone: conversão > lead > identidades
  const email =
    normalizeEmail(conversao.email) ||
    normalizeEmail(lead?.email) ||
    normalizeEmail(pickFromIdentidades(identidades, ["email"]));
  if (email) ids.email = email;

  const tel =
    normalizePhone(conversao.telefone) ||
    normalizePhone(lead?.telefone) ||
    normalizePhone(pickFromIdentidades(identidades, ["whatsapp", "telefone"]));
  if (tel) ids.telefone = tel;

  return ids;
}

// =============================================================================
// Validação por plataforma
// =============================================================================

function validarConfiguracao(
  plataforma: ConversionPlatform,
  cfg?: ConfiguracaoConversaoCore | null
): string[] {
  const pendencias: string[] = [];
  if (!cfg) {
    pendencias.push("Configuração da plataforma não encontrada para esta conta.");
    return pendencias;
  }
  if (!cfg.ativo) pendencias.push("Plataforma desativada na configuração da conta.");

  if (plataforma === "google_ads") {
    if (!cfg.google_customer_id) pendencias.push("Configurar Google Customer ID.");
    if (!cfg.google_conversion_action_id) pendencias.push("Configurar Google Conversion Action ID.");
  } else if (plataforma === "meta_ads") {
    if (!cfg.meta_pixel_id && !cfg.meta_dataset_id) {
      pendencias.push("Configurar Meta Pixel ID ou Dataset ID.");
    }
  } else if (plataforma === "tiktok_ads") {
    if (!cfg.tiktok_advertiser_id && !cfg.tiktok_event_source_id) {
      pendencias.push("Configurar TikTok Advertiser ID ou Event Source ID.");
    }
  }
  return pendencias;
}

function validarGoogle(p: ValidationParams, ids: Record<string, string>): string[] {
  const pend: string[] = [];
  const evento = (p.tipo_evento_plataforma as GoogleEventType) || "offline_click_conversion";
  if (evento === "offline_click_conversion") {
    const clicks = ["gclid", "gbraid", "wbraid"].filter((k) => ids[k]);
    if (clicks.length === 0) {
      pend.push("É necessário um identificador de clique: gclid, gbraid ou wbraid.");
    } else if (clicks.length > 1) {
      pend.push("Use apenas um identificador de clique (gclid, gbraid ou wbraid).");
    }
  } else if (evento === "enhanced_conversion_lead") {
    if (!ids.email && !ids.telefone) {
      pend.push("Enhanced conversion (lead) exige email ou telefone do cliente.");
    }
  }
  return pend;
}

function validarMeta(_p: ValidationParams, ids: Record<string, string>): string[] {
  const pend: string[] = [];
  const tem = ["fbclid", "fbc", "fbp", "email", "telefone"].some((k) => ids[k]);
  if (!tem) {
    pend.push("Meta Ads exige pelo menos um entre fbclid, fbc, fbp, email ou telefone.");
  }
  return pend;
}

function validarTikTok(_p: ValidationParams, ids: Record<string, string>): string[] {
  const pend: string[] = [];
  const tem = ["ttclid", "email", "telefone"].some((k) => ids[k]);
  if (!tem) {
    pend.push("TikTok Ads exige pelo menos um entre ttclid, email ou telefone.");
  }
  return pend;
}

// =============================================================================
// Payload preview
// =============================================================================

function isoDate(p: ValidationParams): string {
  return (
    p.conversao.data_conversao ||
    p.conversao.convertido_em ||
    new Date().toISOString()
  );
}

function epochSeconds(p: ValidationParams): number {
  const d = new Date(isoDate(p));
  return Math.floor(d.getTime() / 1000);
}

function buildGooglePayload(p: ValidationParams, ids: Record<string, string>): Record<string, any> {
  const evento = (p.tipo_evento_plataforma as GoogleEventType) || "offline_click_conversion";
  const cfg = p.configuracao;
  const base: Record<string, any> = {
    customer_id: cfg?.google_customer_id || null,
    conversion_action_id: cfg?.google_conversion_action_id || null,
    conversion_date_time: isoDate(p),
    conversion_value: p.conversao.valor ?? 0,
    currency_code: "BRL",
    event_type: evento,
  };
  if (evento === "offline_click_conversion") {
    if (ids.gclid) base.gclid = ids.gclid;
    else if (ids.gbraid) base.gbraid = ids.gbraid;
    else if (ids.wbraid) base.wbraid = ids.wbraid;
  } else {
    base.user_identifiers = {
      hashed_email: ids.email ? hashIdentifierPlaceholder(ids.email) : undefined,
      hashed_phone_number: ids.telefone ? hashIdentifierPlaceholder(ids.telefone) : undefined,
    };
  }
  return base;
}

function buildMetaPayload(p: ValidationParams, ids: Record<string, string>): Record<string, any> {
  const evento = (p.tipo_evento_plataforma as MetaEventType) || "Lead";
  const cfg = p.configuracao;
  return {
    pixel_id: cfg?.meta_pixel_id || null,
    dataset_id: cfg?.meta_dataset_id || null,
    event_name: evento,
    event_time: epochSeconds(p),
    action_source: "system_generated",
    user_data: {
      em: ids.email ? hashIdentifierPlaceholder(ids.email) : undefined,
      ph: ids.telefone ? hashIdentifierPlaceholder(ids.telefone) : undefined,
      fbc: ids.fbc || undefined,
      fbp: ids.fbp || undefined,
      fbclid: ids.fbclid || undefined,
    },
    custom_data: {
      currency: "BRL",
      value: p.conversao.valor ?? 0,
      conversion_name: p.conversao.nome_conversao || undefined,
    },
  };
}

function buildTikTokPayload(p: ValidationParams, ids: Record<string, string>): Record<string, any> {
  const evento = (p.tipo_evento_plataforma as TikTokEventType) || "SubmitForm";
  const cfg = p.configuracao;
  return {
    advertiser_id: cfg?.tiktok_advertiser_id || null,
    event_source_id: cfg?.tiktok_event_source_id || null,
    event: evento,
    event_time: epochSeconds(p),
    context: {
      user: {
        email: ids.email ? hashIdentifierPlaceholder(ids.email) : undefined,
        phone: ids.telefone ? hashIdentifierPlaceholder(ids.telefone) : undefined,
        ttclid: ids.ttclid || undefined,
      },
    },
    properties: {
      currency: "BRL",
      value: p.conversao.valor ?? 0,
      content_name: p.conversao.nome_conversao || undefined,
    },
  };
}

export function buildPayloadPreview(p: ValidationParams): Record<string, any> {
  const ids = coletarIdentificadores(p);
  switch (p.plataforma) {
    case "google_ads":
      return buildGooglePayload(p, ids);
    case "meta_ads":
      return buildMetaPayload(p, ids);
    case "tiktok_ads":
      return buildTikTokPayload(p, ids);
  }
}

// =============================================================================
// Validação pública
// =============================================================================

export function validateConversionDestination(p: ValidationParams): ValidationResult {
  const ids = coletarIdentificadores(p);
  const pendencias: string[] = [];

  // Método válido?
  if (!getAvailableMethods(p.plataforma).includes(p.metodo_envio)) {
    pendencias.push(
      `Método ${getSendMethodLabel(p.metodo_envio)} não é suportado por ${getConversionPlatformLabel(p.plataforma)}.`
    );
  }

  // Configuração
  pendencias.push(...validarConfiguracao(p.plataforma, p.configuracao));

  // Identificadores específicos por plataforma
  if (p.plataforma === "google_ads") pendencias.push(...validarGoogle(p, ids));
  else if (p.plataforma === "meta_ads") pendencias.push(...validarMeta(p, ids));
  else if (p.plataforma === "tiktok_ads") pendencias.push(...validarTikTok(p, ids));

  const payload_preview = buildPayloadPreview(p);

  let status: ValidationResult["status"] = "pronto_para_exportar";
  if (pendencias.length > 0) status = "pendente";

  return {
    status,
    pendencias,
    identificadores_disponiveis: ids,
    payload_preview,
  };
}
