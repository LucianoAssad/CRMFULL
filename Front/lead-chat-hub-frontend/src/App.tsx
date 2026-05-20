import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import Home from "./pages/Home.tsx";
import Webchat from "./pages/Webchat.tsx";
import Login from "./pages/Login.tsx";
import RecuperarSenha from "./pages/RecuperarSenha.tsx";
import Cadastro from "./pages/Cadastro.tsx";
import Onboarding from "./pages/Onboarding.tsx";
import SelecionarConta from "./pages/SelecionarConta.tsx";
import Conversoes from "./pages/Conversoes.tsx";
import Produtos from "./pages/Produtos.tsx";
import Empresas from "./pages/Empresas.tsx";
import ManagerContas from "./pages/ManagerContas.tsx";
import Usuarios from "./pages/Usuarios.tsx";
import Conexoes from "./pages/Conexoes.tsx";
import Placeholder from "./pages/Placeholder.tsx";
import Pipeline from "./pages/Pipeline.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Templates from "./pages/Templates.tsx";
import Campanhas from "./pages/Campanhas.tsx";
import ImportarContas from "./pages/ImportarContas.tsx";
import DiagnosticoRLS from "./pages/DiagnosticoRLS.tsx";
import Leads from "./pages/Leads.tsx";
import ConfiguracoesConta from "./pages/ConfiguracoesConta.tsx";
import ConfiguracoesManager from "./pages/ConfiguracoesManager.tsx";
import Vendas from "./pages/Vendas.tsx";
import ImportacoesAccount from "./pages/ImportacoesAccount.tsx";
import Agendamentos from "./pages/Agendamentos.tsx";
import ChatbotFluxos from "./pages/ChatbotFluxos.tsx";
import GruposWhatsapp from "./pages/GruposWhatsapp.tsx";
import Afiliados from "./pages/Afiliados.tsx";
import Integracoes from "./pages/Integracoes.tsx";
import BaseConhecimento from "./pages/BaseConhecimento.tsx";
import Comunidade from "./pages/Comunidade.tsx";
import AdminLayout from "./layouts/AdminLayout.tsx";
import { ModeGuard } from "./components/ModeGuard.tsx";
import { PermissionRoute } from "./components/PermissionGate.tsx";
import { LegacyRedirect } from "./components/LegacyRedirect.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";
import { RequireAuth } from "./components/RequireAuth.tsx";

const queryClient = new QueryClient();

const wrap = (action: Parameters<typeof PermissionRoute>[0]["action"], node: React.ReactNode) => (
  <PermissionRoute action={action}>{node as any}</PermissionRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/webchat" element={<Webchat />} />
            <Route path="/login" element={<Login />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/cadastro" element={<Cadastro />} />
            <Route path="/selecionar-conta" element={<RequireAuth><SelecionarConta /></RequireAuth>} />

            <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
              <Route path="/account/onboarding" element={<ModeGuard required="account"><Onboarding /></ModeGuard>} />

              {/* Modo Manager */}
              <Route path="/manager/dashboard" element={<ModeGuard required="manager">{wrap("view_dashboard", <Dashboard />)}</ModeGuard>} />
              <Route path="/manager/contas" element={<ModeGuard required="manager">{wrap("manage_accounts", <ManagerContas />)}</ModeGuard>} />
              <Route path="/manager/contas/avancado" element={<ModeGuard required="manager">{wrap("manage_accounts", <Empresas />)}</ModeGuard>} />
              <Route path="/manager/usuarios" element={<ModeGuard required="manager">{wrap("manage_users", <Usuarios />)}</ModeGuard>} />
              <Route path="/manager/conversoes" element={<ModeGuard required="manager">{wrap("manage_conversions", <Conversoes />)}</ModeGuard>} />
              <Route path="/manager/templates" element={<ModeGuard required="manager">{wrap("manage_templates", <Templates />)}</ModeGuard>} />
              <Route path="/manager/campanhas" element={<ModeGuard required="manager">{wrap("manage_campaigns", <Campanhas />)}</ModeGuard>} />
              <Route path="/manager/importacoes" element={<ModeGuard required="manager">{wrap("manage_accounts", <ImportarContas />)}</ModeGuard>} />
              <Route path="/manager/importar-contas" element={<Navigate to="/manager/importacoes" replace />} />
              <Route path="/manager/configuracoes" element={<ModeGuard required="manager">{wrap("view_dashboard", <ConfiguracoesManager />)}</ModeGuard>} />
              <Route path="/manager/diagnostico-rls" element={<ModeGuard required="manager">{wrap("manage_accounts", <DiagnosticoRLS />)}</ModeGuard>} />

              {/* Modo Account */}
              <Route path="/account/dashboard" element={<ModeGuard required="account">{wrap("view_dashboard", <Dashboard />)}</ModeGuard>} />
              <Route path="/account/atendimento" element={<ModeGuard required="account">{wrap("view_crm", <Index />)}</ModeGuard>} />
              <Route path="/account/usuarios" element={<ModeGuard required="account">{wrap("manage_users", <Usuarios />)}</ModeGuard>} />
              <Route path="/account/conexoes" element={<ModeGuard required="account">{wrap("manage_connections", <Conexoes />)}</ModeGuard>} />
              <Route path="/account/produtos" element={<ModeGuard required="account">{wrap("manage_products", <Produtos />)}</ModeGuard>} />
              <Route path="/account/pipeline" element={<ModeGuard required="account">{wrap("manage_pipeline", <Pipeline />)}</ModeGuard>} />
              <Route path="/account/conversoes" element={<ModeGuard required="account">{wrap("manage_conversions", <Conversoes />)}</ModeGuard>} />
              <Route path="/account/templates" element={<ModeGuard required="account">{wrap("manage_templates", <Templates />)}</ModeGuard>} />
              <Route path="/account/campanhas" element={<ModeGuard required="account">{wrap("manage_campaigns", <Campanhas />)}</ModeGuard>} />
              <Route path="/account/vendas" element={<ModeGuard required="account">{wrap("manage_sales", <Vendas />)}</ModeGuard>} />
              <Route path="/account/leads" element={<ModeGuard required="account">{wrap("view_crm", <Leads />)}</ModeGuard>} />
              <Route path="/account/importacoes" element={<ModeGuard required="account">{wrap("manage_imports", <ImportacoesAccount />)}</ModeGuard>} />
              <Route path="/account/agendamentos" element={<ModeGuard required="account">{wrap("view_crm", <Agendamentos />)}</ModeGuard>} />
              <Route path="/account/chatbot" element={<ModeGuard required="account">{wrap("manage_crm", <ChatbotFluxos />)}</ModeGuard>} />
              <Route path="/account/grupos-whatsapp" element={<ModeGuard required="account">{wrap("manage_connections", <GruposWhatsapp />)}</ModeGuard>} />
              <Route path="/account/afiliados" element={<ModeGuard required="account">{wrap("manage_crm", <Afiliados />)}</ModeGuard>} />
              <Route path="/account/integracoes" element={<ModeGuard required="account">{wrap("manage_crm", <Integracoes />)}</ModeGuard>} />
              <Route path="/account/base-conhecimento" element={<ModeGuard required="account">{wrap("view_crm", <BaseConhecimento />)}</ModeGuard>} />
              <Route path="/account/comunidade" element={<ModeGuard required="account">{wrap("view_crm", <Comunidade />)}</ModeGuard>} />
              <Route path="/account/configuracoes" element={<ModeGuard required="account">{wrap("view_dashboard", <ConfiguracoesConta />)}</ModeGuard>} />
            </Route>

            {/* Fallback global: rotas legadas/desconhecidas redirecionam conforme o modo da conta ativa */}
            <Route path="*" element={<LegacyRedirect />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
