import { useEffect } from "react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { CloudUpload, Home, Loader2, Map, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrivacyGate } from "@/components/team/PrivacyGate";
import { TeamProvider, useMembership, useOnline, useQueue, useSession, useTeam } from "@/hooks/useTeam";
import { errorMessage } from "@/lib/errors";
import { pruneOtherTeams, startQueueWorker } from "@/lib/offlineQueue";
import { cn } from "@/lib/utils";

export function FullScreenMessage({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center text-lg">
      {children}
    </main>
  );
}

export function Loading({ label = "A carregar…" }: { label?: string }) {
  return (
    <FullScreenMessage>
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p role="status">{label}</p>
    </FullScreenMessage>
  );
}

/** Área da equipa: exige sessão + equipa; carrega os dados e mostra a navegação. */
export default function TeamLayout() {
  const session = useSession();
  const membership = useMembership(session?.user.id);

  useEffect(() => {
    startQueueWorker();
  }, []);
  useEffect(() => {
    if (membership.data) void pruneOtherTeams(membership.data);
  }, [membership.data]);

  if (session === undefined || (session && membership.isLoading)) return <Loading />;
  if (!session) return <Navigate to="/" replace />;
  if (membership.isError)
    return (
      <FullScreenMessage>
        <p>{errorMessage(membership.error)}</p>
        <Button onClick={() => membership.refetch()}>Tentar de novo</Button>
      </FullScreenMessage>
    );
  if (!membership.data) return <Navigate to="/" replace />;

  return (
    <PrivacyGate>
      <TeamProvider
        teamId={membership.data}
        fallback={({ error, retry }) =>
          error ? (
            <FullScreenMessage>
              <p>{errorMessage(error)}</p>
              <Button onClick={retry}>Tentar de novo</Button>
            </FullScreenMessage>
          ) : (
            <Loading label="A carregar a equipa…" />
          )
        }
      >
        <Shell />
      </TeamProvider>
    </PrivacyGate>
  );
}

function Shell() {
  const { team } = useTeam();
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-[500] border-b-2 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold leading-tight">{team.name}</p>
            {team.class_name && <p className="truncate text-sm opacity-90">{team.class_name}</p>}
          </div>
          <img src="/favicon.svg" alt="" className="h-9 w-9 rounded-md border border-white/40" />
        </div>
        <ConnectionBanner />
      </header>
      <main className="flex-1 px-4 pb-28 pt-4">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function ConnectionBanner() {
  const online = useOnline();
  const queue = useQueue();
  const waiting = queue.filter((q) => !q.failed).length;
  if (online && waiting === 0) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground">
      {!online ? <WifiOff className="h-5 w-5" aria-hidden /> : <CloudUpload className="h-5 w-5" aria-hidden />}
      {!online ? "Sem rede." : ""}
      {waiting > 0
        ? ` ${waiting} ${waiting === 1 ? "fotografia" : "fotografias"} a aguardar envio — será enviada automaticamente.`
        : " As respostas ao quiz precisam de rede."}
    </div>
  );
}

function BottomNav() {
  const items = [
    { to: "/equipa", label: "Início", Icon: Home, end: true },
    { to: "/equipa/mapa", label: "Mapa", Icon: Map, end: false },
    { to: "/equipa/regras", label: "Regras", Icon: ShieldAlert, end: false },
  ];
  return (
    <nav aria-label="Navegação principal" className="safe-bottom fixed inset-x-0 bottom-0 z-[500] border-t-2 bg-background">
      <ul className="mx-auto grid max-w-xl grid-cols-3">
        {items.map(({ to, label, Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn("h-6 w-6", isActive && "stroke-[2.5]")} aria-hidden />
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
