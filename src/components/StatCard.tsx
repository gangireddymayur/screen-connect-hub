import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  iconColor?: string;
}

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ title, value, change, changeType = 'neutral', icon: Icon, iconColor }, ref) => {
    return (
      <div ref={ref} className="stat-card animate-slide-in">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1 tracking-tight">{value}</p>
            {change && (
              <p className={cn(
                "text-xs mt-2 font-medium",
                changeType === 'positive' && "text-success",
                changeType === 'negative' && "text-destructive",
                changeType === 'neutral' && "text-muted-foreground"
              )}>
                {change}
              </p>
            )}
          </div>
          <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", iconColor || "bg-primary/10")}>
            <Icon className={cn("h-5 w-5", iconColor ? "text-card-foreground" : "text-primary")} />
          </div>
        </div>
      </div>
    );
  }
);

StatCard.displayName = "StatCard";
