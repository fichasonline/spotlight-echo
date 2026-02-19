import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AgeGate } from "@/components/AgeGate";
import { ProtectedRoute, AdminRoute } from "@/components/ProtectedRoute";

import Index from "./pages/Index";
import AuthPage from "./pages/Auth";
import CalendarioPage from "./pages/Calendario";
import EventoDetailPage from "./pages/EventoDetail";
import NoticiasPage from "./pages/Noticias";
import ArticleDetailPage from "./pages/ArticleDetail";
import FeedPage from "./pages/Feed";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminEventos from "./pages/admin/AdminEventos";
import AdminNoticias from "./pages/admin/AdminNoticias";
import AdminModeracion from "./pages/admin/AdminModeracion";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AgeGate>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/calendario" element={<CalendarioPage />} />
              <Route path="/eventos/:id" element={<EventoDetailPage />} />
              <Route path="/noticias" element={<NoticiasPage />} />
              <Route path="/noticias/:slug" element={<ArticleDetailPage />} />
              <Route path="/feed" element={<ProtectedRoute><FeedPage /></ProtectedRoute>} />
              <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
              <Route path="/admin/eventos" element={<AdminRoute><AdminEventos /></AdminRoute>} />
              <Route path="/admin/noticias" element={<AdminRoute><AdminNoticias /></AdminRoute>} />
              <Route path="/admin/moderacion" element={<AdminRoute><AdminModeracion /></AdminRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </AgeGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
