import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { ConfigWarning } from "@/components/ConfigWarning";
import TeamLayout from "@/components/team/TeamLayout";
import JoinPage from "@/pages/team/JoinPage";
import TeamHomePage from "@/pages/team/TeamHomePage";
import CheckpointPage from "@/pages/team/CheckpointPage";
import MapPage from "@/pages/team/MapPage";
import RulesPage from "@/pages/team/RulesPage";
import StaffHomePage from "@/pages/staff/StaffHomePage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 15_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfigWarning />
        <Routes>
          <Route path="/" element={<JoinPage />} />
          <Route path="/regras" element={<RulesPage />} />
          <Route path="/equipa" element={<TeamLayout />}>
            <Route index element={<TeamHomePage />} />
            <Route path="posto/:seq" element={<CheckpointPage />} />
            <Route path="mapa" element={<MapPage />} />
            <Route path="regras" element={<RulesPage />} />
          </Route>
          <Route path="/prof" element={<StaffHomePage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
