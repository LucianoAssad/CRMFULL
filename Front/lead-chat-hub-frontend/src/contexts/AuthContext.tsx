import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AppUser {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
}

export interface AppSession {
  access_token: string;
  user: AppUser;
}

interface AuthContextValue {
  session: AppSession | null;
  user: AppUser | null;
  usuarioId: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e: string, s: any) => {
      setSession(s);
    });
    supabase.auth.getSession().then(({ data }: any) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Map auth.user.email -> usuarios.id
  useEffect(() => {
    const email = session?.user?.email;
    if (!email) { setUsuarioId(null); return; }
    supabase.from("usuarios").select("id").eq("email", email).maybeSingle()
      .then(({ data }: any) => setUsuarioId(data?.id ?? null));
  }, [session?.user?.email]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data?.session) {
      setSession(data.session as AppSession);
    }
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem("active_conta_id"); } catch {}
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, usuarioId, loading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
