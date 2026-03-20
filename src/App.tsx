import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthGuard from "@/components/AuthGuard";
import Index from "./pages/Index";
import Conversations from "./pages/Conversations";
import Settings from "./pages/Settings";
import BotAdmin from "./pages/BotAdmin";
import StationPortal from "./pages/StationPortal";
import StationsMap from "./pages/StationsMap";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoutes = () => (
  <AuthGuard>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/conversations" element={<Conversations />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/bot-admin" element={<BotAdmin />} />
      <Route path="/station-portal" element={<StationPortal />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </AuthGuard>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/map" element={<StationsMap />} />
          <Route path="/*" element={<ProtectedRoutes />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
