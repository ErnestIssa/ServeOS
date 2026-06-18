/** Workspace-level billing — owners only; staff never see subscription UI. */
export function canManageBilling(userRole?: string | null): boolean {
  return userRole === "OWNER";
}
