// Storage quotas per plan (in bytes)
export const PLAN_STORAGE_QUOTAS: Record<string, number> = {
  starter: 2 * 1024 * 1024 * 1024,    // 2 GB
  pro: 5 * 1024 * 1024 * 1024,        // 5 GB
  enterprise: 10 * 1024 * 1024 * 1024, // 10 GB
};

export const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const getStorageQuota = (plan: string | null | undefined): number => {
  return PLAN_STORAGE_QUOTAS[plan ?? "starter"] ?? PLAN_STORAGE_QUOTAS.starter;
};

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(i >= 3 ? 2 : 1)} ${sizes[i]}`;
};
