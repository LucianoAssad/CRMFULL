// Captura e persiste parâmetros de origem (ads + UTMs) do visitante.
const STORAGE_KEY = "lovable_tracking_v1";

export interface TrackingParams {
  gclid?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  page_url?: string | null;
}

const KEYS: (keyof TrackingParams)[] = [
  "gclid",
  "fbclid",
  "ttclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export function captureTrackingFromUrl(): TrackingParams {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const fromUrl: TrackingParams = {};
  for (const k of KEYS) {
    const v = params.get(k);
    if (v) fromUrl[k] = v;
  }
  fromUrl.page_url = window.location.href;

  // Merge: nunca sobrescreve valores já salvos
  const stored = getStoredTracking();
  const merged: TrackingParams = { ...fromUrl, ...stripEmpty(stored) };
  // page_url: mantém o primeiro registrado (origem original)
  if (!stored.page_url) merged.page_url = fromUrl.page_url;
  else merged.page_url = stored.page_url;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {}
  return merged;
}

export function getStoredTracking(): TrackingParams {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TrackingParams) : {};
  } catch {
    return {};
  }
}

function stripEmpty(o: TrackingParams): TrackingParams {
  const out: TrackingParams = {};
  (Object.keys(o) as (keyof TrackingParams)[]).forEach((k) => {
    if (o[k]) out[k] = o[k];
  });
  return out;
}
