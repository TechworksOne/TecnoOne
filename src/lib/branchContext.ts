export const ACTIVE_BRANCH_STORAGE_KEY = 'tecnoone.sucursalActivaId';
export const BRANCH_CONTEXT_CHANGED_EVENT = 'tecnoone:branch-context-change';
export const CONSOLIDATED_BRANCH_VALUE = 'ALL';

export type BranchContextMode = 'specific' | 'consolidated';

export function notifyBranchContextChanged(detail: {
  mode: BranchContextMode;
  sucursalId: number | null;
  version: number;
}) {
  window.dispatchEvent(new CustomEvent(BRANCH_CONTEXT_CHANGED_EVENT, { detail }));
}
