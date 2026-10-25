export const INVENTORY_PERMISSION_MAP = {
  'inventory.read': 'inventory_read',
  'inventory.adjust': 'inventory_manage',
} as const;

export type InventoryContractPermission = keyof typeof INVENTORY_PERMISSION_MAP;
export type InventoryPersistedPermission =
  (typeof INVENTORY_PERMISSION_MAP)[InventoryContractPermission];
