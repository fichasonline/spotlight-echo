import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AgeGate } from "@/components/AgeGate";
import { ProtectedRoute, AdminRoute, StaffRoute } from "@/components/ProtectedRoute";
import { RouteSeo } from "@/components/RouteSeo";
import Footer from "@/components/Footer";

const Index = lazy(() => import("./pages/Index"));
const AuthPage = lazy(() => import("./pages/Auth"));
const CalendarioPage = lazy(() => import("./pages/Calendario"));
const EventoDetailPage = lazy(() => import("./pages/EventoDetail"));
const NoticiasPage = lazy(() => import("./pages/Noticias"));
const ArticleDetailPage = lazy(() => import("./pages/ArticleDetail"));
const FeedPage = lazy(() => import("./pages/Feed"));
const SorteoTvPage = lazy(() => import("./pages/SorteoTv"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminEventos = lazy(() => import("./pages/admin/AdminEventos"));
const AdminNoticias = lazy(() => import("./pages/admin/AdminNoticias"));
const AdminNoticiasInstagram = lazy(() => import("./pages/admin/AdminNoticiasInstagram"));
const AdminLiveblogs = lazy(() => import("./pages/admin/AdminLiveblogs"));
const AdminStoriesQueue = lazy(() => import("./pages/admin/AdminStoriesQueue"));
const AdminSorteos = lazy(() => import("./pages/admin/AdminSorteos"));
const AdminModeracion = lazy(() => import("./pages/admin/AdminModeracion"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminChatLeads = lazy(() => import("./pages/admin/AdminChatLeads"));
const AdminBanners = lazy(() => import("./pages/admin/AdminBanners"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const SalasPage = lazy(() => import("./pages/Salas"));
const SalaDetailPage = lazy(() => import("./pages/SalaDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AgeGate>
        <BrowserRouter>
          <AuthProvider>
            <RouteSeo />
            <div>
              <Suspense >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<AuthPage />} />
                  <Route path="/calendario" element={<CalendarioPage />} />
                  <Route path="/eventos/:id" element={<EventoDetailPage />} />
                  <Route path="/noticias" element={<NoticiasPage />} />
                  <Route path="/noticias/:slug" element={<ArticleDetailPage />} />
                  <Route path="/salas" element={<SalasPage />} />
                  <Route path="/salas/:slug" element={<SalaDetailPage />} />
                  <Route path="/sorteotv" element={<SorteoTvPage />} />
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
                    path="/admin/noticias/instagram"
                    element={
                      <AdminRoute>
                        <AdminNoticiasInstagram />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/liveblogs"
                    element={
                      <AdminRoute>
                        <AdminLiveblogs />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/stories"
                    element={
                      <AdminRoute>
                        <AdminStoriesQueue />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/sorteos"
                    element={
                      <AdminRoute>
                        <AdminSorteos />
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
                  <Route
                    path="/admin/leads"
                    element={
                      <AdminRoute>
                        <AdminLeads />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/chat-leads"
                    element={
                      <AdminRoute>
                        <AdminChatLeads />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/banners"
                    element={
                      <AdminRoute>
                        <AdminBanners />
                      </AdminRoute>
                    }
                  />
                  <Route
                    path="/admin/usuarios"
                    element={
                      <AdminRoute>
                        <AdminUsers />
                      </AdminRoute>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <Footer />
              </Suspense>
            </div>
          </AuthProvider>
        </BrowserRouter>
      </AgeGate>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
