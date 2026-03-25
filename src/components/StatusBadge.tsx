import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: 'online' | 'offline' | 'idle' | 'active' | 'draft' | 'scheduled' | 'trial' | 'suspended' | 'starter' | 'professional' | 'enterprise' | 'normal' | 'high' | 'emergency';
}

const statusStyles: Record<string, string> = {
  online: "bg-success/15 text-success",
  active: "bg-success/15 text-success",
  offline: "bg-destructive/15 text-destructive",
  suspended: "bg-destructive/15 text-destructive",
  idle: "bg-warning/15 text-warning",
  trial: "bg-warning/15 text-warning",
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/15 text-info",
  starter: "bg-muted text-muted-foreground",
  professional: "bg-primary/15 text-primary",
  enterprise: "bg-info/15 text-info",
  normal: "bg-muted text-muted-foreground",
  high: "bg-warning/15 text-warning",
  emergency: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize",
      statusStyles[status] || "bg-muted text-muted-foreground"
    )}>
      {(status === 'online' || status === 'active') && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse-glow" />
      )}
      {status}
    </span>
  );
}
