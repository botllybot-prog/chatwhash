import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import AuthGuard from "@/components/AuthGuard";
import RoleGuard from "@/components/RoleGuard";
import MobileLayout from "@/components/MobileLayout";
import { AppLanguageProvider } from "@/lib/language";
import LandingPage from "./pages/LandingPage";
import NotFound from "./pages/NotFound";
import { getCustomerSession } from "@/lib/customerSession";

const StationsList = lazy(() => import("./pages/StationsList"));
const Conversations = lazy(() => import("./pages/Conversations"));
const StationPortal = lazy(() => import("./pages/StationPortal"));
const StationsMap = lazy(() => import("./pages/StationsMap"));
const TopPicks = lazy(() => import("./pages/TopPicks"));
const Login = lazy(() => import("./pages/Login"));
const OwnerAccess = lazy(() => import("./pages/OwnerAccess"));
const More = lazy(() => import("./pages/More"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminStations = lazy(() => import("./pages/admin/AdminStations"));
const AdminStationTypes = lazy(() => import("./pages/admin/AdminStationTypes"));
const AdminServices = lazy(() => import("./pages/admin/AdminServices"));
const AdminServiceTypes = lazy(() => import("./pages/admin/AdminServiceTypes"));
const AdminOffers = lazy(() => import("./pages/admin/AdminOffers"));
const AdminOfferTypes = lazy(() => import("./pages/admin/AdminOfferTypes"));
const AdminBookings = lazy(() => import("./pages/admin/AdminBookings"));
const AdminOwners = lazy(() => import("./pages/admin/AdminOwners"));
const AdminEditRequests = lazy(() => import("./pages/admin/AdminEditRequests"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminEmployees = lazy(() => import("./pages/admin/AdminEmployees"));
const AdminBroadcast = lazy(() => import("./pages/admin/AdminBroadcast"));
const AdminRatings = lazy(() => import("./pages/admin/AdminRatings"));
const AdminChatGroups = lazy(() => import("./pages/admin/AdminChatGroups"));
const EmployeeLayout = lazy(() => import("./components/EmployeeLayout"));
const EmployeeDashboard = lazy(() => import("./pages/employee/EmployeeDashboard"));
const CustomerLogin = lazy(() => import("./pages/CustomerLogin"));
const CustomerChat = lazy(() => import("./pages/CustomerChat"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

const ProtectedRoutes = () => (
  <AuthGuard>
    <Routes>
      <Route path="/" element={<Navigate to="/app/admin/dashboard" replace />} />
      <Route path="/conversations" element={<Conversations />} />
      <Route path="/admin" element={<RoleGuard allowedRoles={["admin"]} fallbackPath="/app/station-portal"><AdminLayout /></RoleGuard>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="stations" element={<AdminStations />} />
        <Route path="station-types" element={<AdminStationTypes />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="service-types" element={<AdminServiceTypes />} />
        <Route path="offers" element={<AdminOffers />} />
        <Route path="offer-types" element={<AdminOfferTypes />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="owners" element={<AdminOwners />} />
        <Route path="edit-requests" element={<AdminEditRequests />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="ratings" element={<AdminRatings />} />
        <Route path="employees" element={<AdminEmployees />} />
        <Route path="broadcast" element={<AdminBroadcast />} />
        <Route path="chat-groups" element={<AdminChatGroups />} />
      </Route>
      <Route path="/station-portal" element={<RoleGuard allowedRoles={["station_owner"]} fallbackPath="/app/admin/stations"><StationPortal /></RoleGuard>} />
      <Route path="/employee" element={<RoleGuard allowedRoles={["employee"]} fallbackPath="/login"><EmployeeLayout /></RoleGuard>}>
        <Route index element={<EmployeeDashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthGuard>
);

// Guards any customer-facing route that needs a signed-in phone session
// (used by both the map and the chat page).
const CustomerAuthGuard = ({ children }: { children: JSX.Element }) => {
  const session = typeof window !== "undefined" ? getCustomerSession() : null;
  if (!session) return <Navigate to="/customer-login" replace />;
  return children;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppLanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <LanguageSwitcher />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public pages with mobile bottom nav */}
            <Route element={<MobileLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/stations-list" element={<StationsList />} />
              <Route path="/top-picks" element={<TopPicks />} />
              <Route path="/map" element={<CustomerAuthGuard><StationsMap /></CustomerAuthGuard>} />
              <Route path="/chat" element={<CustomerAuthGuard><CustomerChat /></CustomerAuthGuard>} />
              <Route path="/more" element={<More />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            </Route>
            <Route path="/customer-login" element={<CustomerLogin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/owner" element={<OwnerAccess />} />
            <Route path="/app/*" element={<ProtectedRoutes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AppLanguageProvider>
  </QueryClientProvider>
);

export default App;
