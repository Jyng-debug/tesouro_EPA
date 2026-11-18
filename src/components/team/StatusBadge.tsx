import { AlertTriangle, CheckCircle2, Circle, CloudUpload, Send, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CheckpointStatus } from "@/hooks/useTeam";

const MAP: Record<CheckpointStatus, { label: string; variant: "secondary" | "warning" | "default" | "success" | "destructive"; Icon: typeof Circle }> = {
  todo: { label: "Por fazer", variant: "secondary", Icon: Circle },
  queued: { label: "A aguardar envio", variant: "warning", Icon: CloudUpload },
  queue_error: { label: "Erro no envio", variant: "destructive", Icon: AlertTriangle },
  pending: { label: "Enviado", variant: "default", Icon: Send },
  approved: { label: "Validado", variant: "success", Icon: CheckCircle2 },
  rejected: { label: "Rejeitado", variant: "destructive", Icon: XCircle },
};

export function StatusBadge({ status }: { status: CheckpointStatus }) {
  const { label, variant, Icon } = MAP[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </Badge>
  );
}
