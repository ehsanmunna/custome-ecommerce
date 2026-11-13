import { HttpErrorResponse } from '@angular/common/http';

export const NOTIFICATION_MESSAGES = {
  product: {
    create: 'Product created',
    update: 'Product updated',
    delete: 'Product deleted',
    createFailed: 'Failed to create product',
    updateFailed: 'Failed to update product',
    deleteFailed: 'Failed to delete product',
  },
  category: {
    create: 'Category created',
    update: 'Category updated',
    delete: 'Category deleted',
    createFailed: 'Failed to create category',
    updateFailed: 'Failed to update category',
    deleteFailed: 'Failed to delete category',
  },
  brand: {
    create: 'Brand created',
    update: 'Brand updated',
    delete: 'Brand deleted',
    createFailed: 'Failed to create brand',
    updateFailed: 'Failed to update brand',
    deleteFailed: 'Failed to delete brand',
  },
  attribute: {
    create: 'Attribute created',
    createFailed: 'Failed to create attribute',
  },
  media: {
    create: 'Media uploaded',
    complete: 'Media upload completed',
    delete: 'Media deleted',
    createFailed: 'Failed to create media upload',
    completeFailed: 'Failed to complete media upload',
    deleteFailed: 'Failed to delete media',
  },
  variant: {
    create: 'Variant created',
    update: 'Variant updated',
    delete: 'Variant deleted',
    createFailed: 'Failed to create variant',
    updateFailed: 'Failed to update variant',
    deleteFailed: 'Failed to delete variant',
  },
  inventory: {
    adjust: 'Stock adjusted',
    adjustFailed: 'Failed to adjust stock',
    reservationCreate: 'Reservation created',
    reservationUpdate: 'Reservation updated',
    reservationCreateFailed: 'Failed to create reservation',
    reservationUpdateFailed: 'Failed to update reservation',
  },
  order: {
    statusUpdate: 'Order status updated',
    statusUpdateFailed: 'Failed to update order status',
  },
  returns: {
    statusUpdate: 'Return status updated',
    statusUpdateFailed: 'Failed to update return status',
  },
  page: {
    create: 'CMS page created',
    update: 'CMS page updated',
    delete: 'CMS page deleted',
    createFailed: 'Failed to create CMS page',
    updateFailed: 'Failed to update CMS page',
    deleteFailed: 'Failed to delete CMS page',
  },
  banner: {
    create: 'Banner created',
    update: 'Banner updated',
    delete: 'Banner deleted',
    createFailed: 'Failed to create banner',
    updateFailed: 'Failed to update banner',
    deleteFailed: 'Failed to delete banner',
  },
  coupon: {
    create: 'Coupon created',
    update: 'Coupon updated',
    delete: 'Coupon deleted',
    createFailed: 'Failed to create coupon',
    updateFailed: 'Failed to update coupon',
    deleteFailed: 'Failed to delete coupon',
  },
  shippingZone: {
    create: 'Shipping zone created',
    update: 'Shipping zone updated',
    delete: 'Shipping zone deleted',
    createFailed: 'Failed to create shipping zone',
    updateFailed: 'Failed to update shipping zone',
    deleteFailed: 'Failed to delete shipping zone',
  },
  adminUser: {
    create: 'Administrator created',
    update: 'Administrator updated',
    disable: 'Administrator disabled',
    enable: 'Administrator enabled',
    createFailed: 'Failed to create administrator',
    updateFailed: 'Failed to update administrator',
    disableFailed: 'Failed to disable administrator',
    enableFailed: 'Failed to enable administrator',
  },
  role: {
    create: 'Role created',
    update: 'Role updated',
    delete: 'Role deleted',
    createFailed: 'Failed to create role',
    updateFailed: 'Failed to update role',
    deleteFailed: 'Failed to delete role',
  },
} as const;

export type NotificationMessageKey = keyof typeof NOTIFICATION_MESSAGES;

export function isGlobalHttpError(status: number | undefined): boolean {
  return status === 0 || status === 401 || status === 403 || (status !== undefined && status >= 500);
}

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error;
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
  }
  return fallback;
}
