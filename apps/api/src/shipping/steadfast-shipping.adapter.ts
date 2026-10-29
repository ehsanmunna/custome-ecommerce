import { Injectable } from '@nestjs/common';
import { ShipmentStatus } from 'database';
import {
  CreateParcelInput,
  ParcelResult,
  ShippingAdapter,
  ShippingAdapterErrorImpl,
} from './shipping-adapter';

export interface SteadfastAdapterSettings {
  apiKey?: string;
  baseUrl?: string;
}

export interface SteadfastAdapterDependencies {
  fetch?: typeof fetch;
}

const STEADFAST_DEFAULT_BASE_URL = 'https://api.steadfast.com.bd';

const STEADFAST_STATUS_MAP: Record<string, ShipmentStatus> = {
  pending: 'pending',
  booked: 'booked',
  'picked_up': 'picked_up',
  'picked up': 'picked_up',
  in_transit: 'in_transit',
  'in transit': 'in_transit',
  delivered: 'delivered',
  returned: 'returned',
  cancel: 'cancelled',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  failure: 'failed',
  failed: 'failed',
};

function mapSteadfastStatus(value: unknown): ShipmentStatus {
  if (typeof value !== 'string') return 'pending';
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return STEADFAST_STATUS_MAP[normalized] ?? 'pending';
}

@Injectable()
export class SteadfastShippingAdapter implements ShippingAdapter {
  readonly name: 'steadfast' = 'steadfast';
  private readonly configured: boolean;

  constructor(
    private readonly settings: SteadfastAdapterSettings,
    dependencies: SteadfastAdapterDependencies = {},
  ) {
    this.configured = Boolean(settings.apiKey && settings.baseUrl);
    this.httpFetch = dependencies.fetch ?? fetch;
  }

  private readonly httpFetch: typeof fetch;

  isConfigured(): boolean {
    return this.configured;
  }

  async createParcel(input: CreateParcelInput): Promise<ParcelResult> {
    if (!this.configured) {
      throw new ShippingAdapterErrorImpl(
        'Steadfast shipping adapter is not configured',
        'steadfast',
      );
    }

    const body = {
      recipient_name: input.customerName,
      recipient_phone: input.customerPhone,
      recipient_address: input.customerAddress,
      recipient_city: input.customerCity,
      cod_amount: input.codAmountPoisha,
      product_name: input.itemName,
      product_quantity: input.itemQuantity,
      product_weight: input.itemWeightGram ?? 0,
      reference: input.orderId,
    };

    const httpFetch = this.httpFetch;
    let response: Response;
    try {
      response = await httpFetch(`${this.settings.baseUrl}/api/v1/shipments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new ShippingAdapterErrorImpl(
        'Steadfast create parcel request failed',
        'steadfast',
        error,
      );
    }

    if (!response.ok) {
      throw new ShippingAdapterErrorImpl(
        `Steadfast create parcel failed with HTTP ${response.status}`,
        'steadfast',
        await response.text().catch(() => ''),
      );
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      throw new ShippingAdapterErrorImpl(
        'Steadfast create parcel returned invalid JSON',
        'steadfast',
        error,
      );
    }

    return this.parseParcelResult(payload);
  }

  private parseParcelResult(payload: unknown): ParcelResult {
    const record = payload as Record<string, unknown>;

    const trackingNumber =
      typeof record.tracking_number === 'string' && record.tracking_number.length > 0
        ? record.tracking_number
        : typeof record.tracking_id === 'string' && record.tracking_id.length > 0
          ? record.tracking_id
          : typeof record.tracking === 'string' && record.tracking.length > 0
            ? record.tracking
            : '';

    const courierReference =
      typeof record.reference_id === 'string' && record.reference_id.length > 0
        ? record.reference_id
        : typeof record.id === 'string' && record.id.length > 0
          ? record.id
          : trackingNumber;

    const status = mapSteadfastStatus(record.status);

    let bookedAt: Date | null = null;
    const bookedAtRaw = record.booked_at ?? record.created_at;
    if (typeof bookedAtRaw === 'string' && bookedAtRaw.length > 0) {
      const parsed = new Date(bookedAtRaw);
      if (!Number.isNaN(parsed.getTime())) bookedAt = parsed;
    }

    if (!trackingNumber) {
      throw new ShippingAdapterErrorImpl(
        'Steadfast create parcel response did not include a tracking number',
        'steadfast',
        payload,
      );
    }

    return { trackingNumber, courierReference, status, bookedAt };
  }
}
