import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { AppLayout } from './layouts/AppLayout';
import { AuthLayout } from './layouts/AuthLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Loader2 } from 'lucide-react';

// Landing Page
const LandingPage = lazy(() => import('./pages/LandingPage'));

// Auth pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

// Dashboard pages
const ExecutiveDashboard = lazy(() => import('./pages/dashboard/ExecutiveDashboard'));
const BusinessIntelligencePage = lazy(() => import('./pages/dashboard/BusinessIntelligencePage'));
const DecisionIntelligencePage = lazy(() => import('./features/decision-intelligence/DecisionIntelligencePage'));

// AI pages
const AIChatPage = lazy(() => import('./pages/ai/AIChatPage'));
const AgentsPage = lazy(() => import('./pages/ai/AgentsPage'));
const QueryHistoryPage = lazy(() => import('./pages/ai/QueryHistoryPage'));

// Search pages (Primary Experience)
const UniversalSearchPage = lazy(() => import('./pages/search/UniversalSearchPage'));
const SearchResultsPage = lazy(() => import('./pages/search/SearchResultsPage'));
const CompanyProfilePage = lazy(() => import('./pages/companies/CompanyProfilePage'));

// Knowledge pages
const DocumentsPage = lazy(() => import('./pages/knowledge/DocumentsPage'));
const KnowledgeGraphPage = lazy(() => import('./pages/knowledge/KnowledgeGraphPage'));
const EvaluateGraphPage = lazy(() => import('./pages/knowledge/EvaluateGraphPage'));

// Analytics pages
const AnalyticsPage = lazy(() => import('./pages/analytics/AnalyticsPage'));
const ReportsPage = lazy(() => import('./pages/analytics/ReportsPage'));
const RiskDashboardPage = lazy(() => import('./pages/analytics/RiskDashboardPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="page-enter">
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Protected App Routes */}
        <Route element={<AppLayout />}>
          {/* Primary Search Experience */}
          <Route path="/search-home" element={<ProtectedRoute><UniversalSearchPage /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchResultsPage /></ProtectedRoute>} />
          <Route path="/companies/:companyId" element={<ProtectedRoute><CompanyProfilePage /></ProtectedRoute>} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><ExecutiveDashboard /></ProtectedRoute>} />
          <Route path="/business-intelligence" element={<ProtectedRoute><BusinessIntelligencePage /></ProtectedRoute>} />
          <Route path="/decision-intelligence" element={<ProtectedRoute><DecisionIntelligencePage /></ProtectedRoute>} />

          {/* AI */}
          <Route path="/chat" element={<ProtectedRoute><AIChatPage /></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute><AgentsPage /></ProtectedRoute>} />
          <Route path="/query-history" element={<ProtectedRoute><QueryHistoryPage /></ProtectedRoute>} />

          {/* Knowledge */}
          <Route path="/documents" element={<ProtectedRoute><DocumentsPage /></ProtectedRoute>} />
          <Route path="/knowledge-graph" element={<ProtectedRoute><KnowledgeGraphPage /></ProtectedRoute>} />
          <Route path="/evaluate-graph" element={<ProtectedRoute><EvaluateGraphPage /></ProtectedRoute>} />

          {/* Analytics */}
          <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/:reportId" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/reports/:reportId/preview" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
          <Route path="/risks" element={<ProtectedRoute><RiskDashboardPage /></ProtectedRoute>} />
        </Route>

        {/* Redirects */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <ScrollToTop />
            <Suspense fallback={<PageLoader />}>
              <AnimatedRoutes />
            </Suspense>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
