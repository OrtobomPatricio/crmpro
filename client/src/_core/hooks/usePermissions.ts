import { trpc } from "@/lib/trpc";

export type PermissionKey = string;

export function usePermissions() {
  const query = trpc.settings.myPermissions.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const data = query.data;

  const role = data?.role ?? "agent";
  const permissions = data?.permissions ?? [];

  const can = (perm: PermissionKey) => {
    if (permissions.includes("*")) return true;
    if (permissions.includes(perm)) return true;

    // wildcard match: module.*
    const requiredBase = perm.split(".")[0];
    if (permissions.includes(`${requiredBase}.*`)) return true;

    return false;
  };

  return { role, permissions, can, isLoading: query.isLoading };
}
