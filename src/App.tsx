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
import StationsList from "./pages/StationsList";
import Conversations from "./pages/Conversations";
import StationPortal from "./pages/StationPortal";
import StationsMap from "./pages/StationsMap";
import Login from "./pages/Login";
import OwnerAccess from "./pages/OwnerAccess";
import NotFound from "./pages/NotFound";
import AdminLayout from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminStations from "./pages/admin/AdminStations";
import AdminServices from "./pages/admin/AdminServices";
import AdminBookings from "./pages/admin/AdminBookings";
import AdminOwners from "./pages/admin/AdminOwners";
import AdminEditRequests from "./pages/admin/AdminEditRequests";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminEmployees from "./pages/admin/AdminEmployees";
import AdminBroadcast from "./pages/admin/AdminBroadcast";
import AdminRatings from "./pages/admin/AdminRatings";
import EmployeeLayout from "./components/EmployeeLayout";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import CustomerLogin from "./pages/CustomerLogin";
import { getCustomerSession } from "@/lib/customerSession";

const queryClient = new QueryClient();

const ProtectedRoutes = () => (
  <AuthGuard>
    <Routes>
      <Route path="/" element={<Navigate to="/app/admin/dashboard" replace />} />
      <Route path="/conversations" element={<Conversations />} />
      <Route path="/admin" element={<RoleGuard allowedRoles={["admin"]} fallbackPath="/app/station-portal"><AdminLayout /></RoleGuard>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="stations" element={<AdminStations />} />
        <Route path="services" element={<AdminServices />} />
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
      </Route>
      <Route path="/station-portal" element={<RoleGuard allowedRoles={["station_owner"]} fallbackPath="/app/admin/stations"><StationPortal /></RoleGuard>} />
      <Route path="/employee" element={<RoleGuard allowedRoles={["employee"]} fallbackPath="/login"><EmployeeLayout /></RoleGuard>}>
        <Route index element={<EmployeeDashboard />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthGuard>
);

const CustomerMapGuard = ({ children }: { children: JSX.Element }) => {
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
          <Routes>
            {/* Public pages with mobile bottom nav */}
            <Route element={<MobileLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/stations-list" element={<StationsList />} />
              <Route path="/map" element={<CustomerMapGuard><StationsMap /></CustomerMapGuard>} />
            </Route>
            <Route path="/customer-login" element={<CustomerLogin />} />
            <Route path="/login" element={<Login />} />
            <Route path="/owner" element={<OwnerAccess />} />
            <Route path="/app/*" element={<ProtectedRoutes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AppLanguageProvider>
  </QueryClientProvider>
);

export default App;
