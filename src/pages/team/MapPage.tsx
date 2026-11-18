import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { StatusBadge } from "@/components/team/StatusBadge";
import { useTeam } from "@/hooks/useTeam";

// Versão provisória (Fase 2): lista dos postos com ligação ao OpenStreetMap.
// O mapa interativo (Leaflet) chega na Fase 3.
export default function MapPage() {
  const { states, nextSeq } = useTeam();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold">Mapa</h1>
      <p className="text-muted-foreground">O mapa interativo fica disponível na próxima versão. Por agora, abram cada posto no mapa:</p>
      <ol className="space-y-2">
        {states.map((s) => (
          <li key={s.checkpoint.id} className="rounded-xl border-2 bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={`/equipa/posto/${s.checkpoint.seq}`} className="font-semibold underline-offset-4 hover:underline">
                {s.checkpoint.seq}. {s.checkpoint.name} {nextSeq === s.checkpoint.seq && "· próximo"}
              </Link>
              <StatusBadge status={s.status} />
            </div>
            <a
              className="mt-2 inline-flex items-center gap-1 font-semibold text-primary underline underline-offset-4"
              href={`https://www.openstreetmap.org/?mlat=${s.checkpoint.lat}&mlon=${s.checkpoint.lng}#map=18/${s.checkpoint.lat}/${s.checkpoint.lng}`}
              target="_blank"
              rel="noreferrer"
            >
              Abrir no mapa <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}
