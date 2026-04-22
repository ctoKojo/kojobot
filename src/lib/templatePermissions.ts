/**
 * Permission levels for template management.
 * Mapped from the existing app_role enum in user_roles table.
 *
 * - viewer:  read-only access (browse, preview, see linked events)
 * - editor:  edit + duplicate + toggle active + send test
 * - admin:   editor permissions + delete + import/export + restore versions + bulk
 */

export type TemplatePermissionLevel = 'viewer' | 'editor' | 'admin';

export interface TemplatePermissions {
  level: TemplatePermissionLevel;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  canDuplicate: boolean;
  canToggleActive: boolean;
  canSendTest: boolean;
  canRestoreVersion: boolean;
  canImport: boolean;
  canExport: boolean;
  canBulkAction: boolean;
}

export function permissionsForRole(role: string | null | undefined): TemplatePermissions {
  const r = (role ?? '').toLowerCase();
  if (r === 'admin') return permissionsForLevel('admin');
  if (r === 'reception') return permissionsForLevel('editor');
  return permissionsForLevel('viewer');
}

export function permissionsForLevel(level: TemplatePermissionLevel): TemplatePermissions {
  switch (level) {
    case 'admin':
      return {
        level,
        canEdit: true,
        canDelete: true,
        canCreate: true,
        canDuplicate: true,
        canToggleActive: true,
        canSendTest: true,
        canRestoreVersion: true,
        canImport: true,
        canExport: true,
        canBulkAction: true,
      };
    case 'editor':
      return {
        level,
        canEdit: true,
        canDelete: false,
        canCreate: true,
        canDuplicate: true,
        canToggleActive: true,
        canSendTest: true,
        canRestoreVersion: false,
        canImport: false,
        canExport: true,
        canBulkAction: false,
      };
    case 'viewer':
    default:
      return {
        level: 'viewer',
        canEdit: false,
        canDelete: false,
        canCreate: false,
        canDuplicate: false,
        canToggleActive: false,
        canSendTest: false,
        canRestoreVersion: false,
        canImport: false,
        canExport: true, // viewing/exporting JSON is fine
        canBulkAction: false,
      };
  }
}

export function permissionLabel(level: TemplatePermissionLevel, isRTL: boolean): string {
  if (isRTL) {
    return level === 'admin' ? 'مسؤول' : level === 'editor' ? 'محرر' : 'قارئ';
  }
  return level.charAt(0).toUpperCase() + level.slice(1);
}
