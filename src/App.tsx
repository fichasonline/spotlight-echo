import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { AgeGate } from "@/components/AgeGate";
import { ProtectedRoute, AdminRoute, StaffRoute } from "@/components/ProtectedRoute";
import { RouteSeo } from "@/components/RouteSeo";
import { SupportChatWidget } from "@/components/SupportChatWidget";
import { BottomInstagramBanner } from "@/components/BottomInstagramBanner";

const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/Auth"));
const CalendarioPage = lazy(() => import("./pages/Calendario"));
const EventoDetailPage = lazy(() => import("./pages/EventoDetail"));
const NoticiasPage = lazy(() => import("./pages/Noticias"));
const ArticleDetailPage = lazy(() => import("./pages/ArticleDetail"));
const FeedPage = lazy(() => import("./pages/Feed"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminEventos = lazy(() => import("./pages/admin/AdminEventos"));
const AdminNoticias = lazy(() => import("./pages/admin/AdminNoticias"));
const AdminModeracion = lazy(() => import("./pages/admin/AdminModeracion"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AgeGate>
        <BrowserRouter>
          <AuthProvider>
            <RouteSeo />
            <div className="pb-24 md:pb-20">
              <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/calendario" element={<CalendarioPage />} />
                  <Route path="/eventos/:id" element={<EventoDetailPage />} />
                  <Route path="/noticias" element={<NoticiasPage />} />
                  <Route path="/noticias/:slug" element={<ArticleDetailPage />} />
                  <Route
                    path="/feed"
                    element={
                      <ProtectedRoute>
                        <FeedPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <AdminRoute>
                        <AdminDashboard />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/eventos"
                    element={
                      <AdminRoute>
                        <AdminEventos />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/noticias"
                    element={
                      <AdminRoute>
                        <AdminNoticias />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/moderacion"
                    element={
                      <StaffRoute>
                        <AdminModeracion />
                      </StaffRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </div>
            <BottomInstagramBanner />
            <SupportChatWidget />
          </AuthProvider>
        </BrowserRouter>
      </AgeGate>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
