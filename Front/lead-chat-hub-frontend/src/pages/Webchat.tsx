import { useEffect } from "react";
import { WebchatWidget } from "@/components/crm/WebchatWidget";
import { captureTrackingFromUrl } from "@/lib/tracking";

export default function Webchat() {
  useEffect(() => { captureTrackingFromUrl(); }, []);
  return (
    <main className="relative min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Bem-vindo</h1>
        <p className="mt-3 text-muted-foreground">
          Esta é uma página pública de demonstração do widget de chat. Clique em "Fale conosco" no canto inferior direito.
        </p>
      </div>
      <WebchatWidget />
    </main>
  );
}
