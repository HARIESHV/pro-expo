import { AccessLevel } from '../types';

/**
 * Single source of truth for role -> accessible document access levels.
 *
 * This is shared by Universal Search, the AI Assistant, and any other
 * consumer so RBAC stays consistent across the platform. Previously this map
 * was duplicated in `routes/ai.ts`, `controllers/chatController.ts` and
 * `services/searchService.ts`, which risked the mappings drifting apart.
 */
export const ROLE_ACCESS_LEVELS: Record<string, AccessLevel[]> = {
  super_admin: ['public', 'internal', 'confidential', 'restricted', 'top_secret'],
  ceo: ['public', 'internal', 'confidential', 'restricted'],
  manager: ['public', 'internal', 'confidential'],
  analyst: ['public', 'internal', 'confidential'],
  employee: ['public', 'internal'],
  hr: ['public', 'internal'],
  finance: ['public', 'internal', 'confidential'],
  sales: ['public', 'internal'],
};

/** Default document access when a role is not explicitly mapped. */
export const DEFAULT_ACCESS_LEVELS: AccessLevel[] = ['public', 'internal'];

/**
 * Return the deduplicated set of document access levels a set of roles can see.
 * Falls back to the default when a role has no explicit mapping.
 */
export function getAccessLevelsForRoles(roles: string[] | undefined | null): AccessLevel[] {
  if (!roles || !Array.isArray(roles) || roles.length === 0) return DEFAULT_ACCESS_LEVELS;
  return [
    ...new Set(
      roles.flatMap((role) => ROLE_ACCESS_LEVELS[role.toLowerCase().trim()] || DEFAULT_ACCESS_LEVELS)
    ),
  ];
}
