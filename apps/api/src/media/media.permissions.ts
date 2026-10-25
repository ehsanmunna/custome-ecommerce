export const MEDIA_PERMISSION_MAP = {
  'media.read': 'media_read',
  'media.create': 'media_manage',
  'media.delete': 'media_manage',
} as const;

export type MediaContractPermission = keyof typeof MEDIA_PERMISSION_MAP;
export type MediaPersistedPermission = (typeof MEDIA_PERMISSION_MAP)[MediaContractPermission];
