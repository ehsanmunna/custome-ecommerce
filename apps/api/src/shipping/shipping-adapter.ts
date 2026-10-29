import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from 'database';

export const SHIPPING_ADAPTER = Symbol('SHIPPING_ADAPTER');

export type CourierName = 'steadfast';

export interface CreateParcelInput {
  orderId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity: string;
  codAmountPoisha: number;
  itemName: string;
  itemQuantity: number;
  itemWeightGram?: number;
}

export interface ParcelResult {
  trackingNumber: string;
  courierReference: string;
  status: ShipmentStatus;
  bookedAt: Date | null;
}

export interface ShippingAdapterError extends Error {
  readonly name: 'ShippingAdapterError';
  readonly adapter: CourierName;
  readonly cause?: unknown;
}

export class ShippingAdapterErrorImpl extends Error implements ShippingAdapterError {
  override readonly name = 'ShippingAdapterError';
  readonly adapter: CourierName;
  override readonly cause?: unknown;

  constructor(message: string, adapter: CourierName, cause?: unknown) {
    super(message);
    this.adapter = adapter;
    this.cause = cause;
  }
}

export interface ShippingAdapter {
  readonly name: CourierName;
  isConfigured(): boolean;
  createParcel(input: CreateParcelInput): Promise<ParcelResult>;
}

export const isShippingAdapterError = (error: unknown): error is ShippingAdapterError =>
  error instanceof ShippingAdapterErrorImpl;

@Injectable()
export abstract class BaseShippingAdapter implements ShippingAdapter {
  abstract readonly name: CourierName;
  abstract isConfigured(): boolean;
  abstract createParcel(input: CreateParcelInput): Promise<ParcelResult>;
}
