import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, ShipmentStatus } from 'database';
import { PrismaService } from '../platform/database/prisma.service';
import { AppConfigService } from '../platform/config/app-config.service';
import { StructuredLogger } from '../platform/logging/structured-logger';
import {
  CreateParcelInput,
  ParcelResult,
  ShippingAdapter,
  ShippingAdapterErrorImpl,
  isShippingAdapterError,
  SHIPPING_ADAPTER,
} from './shipping-adapter';
import { parseCreateParcelInput, parseSteadfastWebhook } from './shipping.schemas';

export type VerifyWebhookSignature = (
  payload: string | Buffer,
  signature: string | undefined,
) => boolean | Promise<boolean>;

export const VERIFY_WEBHOOK_SIGNATURE = Symbol('VERIFY_WEBHOOK_SIGNATURE');

export interface ShipmentView {
  id: string;
  orderId: string;
  trackingNumber: string | null;
  courier: string;
  status: ShipmentStatus;
  codAmountPoisha: number;
  bookedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

@Injectable()
export class ShippingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SHIPPING_ADAPTER) private readonly adapter: ShippingAdapter,
    @Inject(AppConfigService) private readonly config: AppConfigService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
    @Inject(VERIFY_WEBHOOK_SIGNATURE)
    private readonly verifyWebhookSignature: VerifyWebhookSignature,
  ) {}

  async createParcel(input: unknown): Promise<ShipmentView> {
    const parcelInput = parseCreateParcelInput(input);

    const order = await this.prisma.order.findUnique({
      where: { id: parcelInput.orderId },
      select: {
        id: true,
        status: true,
        shipments: { select: { id: true, trackingNumber: true } },
        contactName: true,
        contactPhone: true,
        deliveryAddressLine1: true,
        deliveryDistrict: true,
        totalPoisha: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.shipments.length > 0) {
      throw new ConflictException('Order already has a shipment');
    }

    if (!this.adapter.isConfigured()) {
      throw new ServiceUnavailableException('Shipping adapter is not configured');
    }

    const adapterInput: CreateParcelInput = {
      orderId: order.id,
      customerName: order.contactName,
      customerPhone: order.contactPhone,
      customerAddress: order.deliveryAddressLine1,
      customerCity: order.deliveryDistrict,
      codAmountPoisha: parcelInput.codAmountPoisha,
      itemName: parcelInput.itemName,
      itemQuantity: parcelInput.itemQuantity,
      itemWeightGram: parcelInput.itemWeightGram,
    };

    let result: ParcelResult;
    try {
      result = await this.adapter.createParcel(adapterInput);
    } catch (error) {
      this.logAdapterError(error);
      if (isShippingAdapterError(error)) {
        throw new ServiceUnavailableException(
          `Shipping adapter (${error.adapter}) is unavailable`,
        );
      }
      throw error;
    }

    let shipment: Prisma.ShipmentGetPayload<{}>;
    try {
      shipment = await this.prisma.shipment.create({
        data: {
          orderId: order.id,
          courier: 'steadfast',
          status: result.status,
          trackingNumber: result.trackingNumber,
          codAmountPoisha: parcelInput.codAmountPoisha,
          bookedAt: result.bookedAt,
        },
      });
    } catch (error) {
      this.mapWriteError(error);
      throw error;
    }

    this.logger.log({
      event: 'shipping.parcel.created',
      shipmentId: shipment.id,
      orderId: order.id,
      trackingNumber: shipment.trackingNumber,
      courier: shipment.courier,
      status: shipment.status,
    });

    return this.mapShipment(shipment);
  }

  async handleSteadfastWebhook(
    rawPayload: string | Buffer,
    signature: string | undefined,
  ): Promise<ShipmentView> {
    const isValid = await this.verifyWebhookSignature(rawPayload, signature);
    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = parseSteadfastWebhook(
      typeof rawPayload === 'string' ? rawPayload : rawPayload.toString('utf8'),
    );

    const shipment = await this.prisma.shipment.findFirst({
      where: { trackingNumber: payload.tracking_number },
      select: { id: true, orderId: true, status: true, trackingNumber: true },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');

    const nextStatus = mapWebhookStatus(payload.status);
    if (nextStatus === shipment.status) {
      const current = await this.prisma.shipment.findUnique({
        where: { id: shipment.id },
      });
      if (!current) throw new NotFoundException('Shipment not found');
      return this.mapShipment(current);
    }

    let updated: Prisma.ShipmentGetPayload<{}>;
    try {
      updated = await this.prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: nextStatus,
          ...timestampForStatus(nextStatus),
        },
      });
    } catch (error) {
      this.mapWriteError(error);
      throw error;
    }

    this.logger.log({
      event: 'shipping.webhook.status_updated',
      shipmentId: updated.id,
      orderId: updated.orderId,
      trackingNumber: updated.trackingNumber,
      from: shipment.status,
      to: updated.status,
    });

    return this.mapShipment(updated);
  }

  private logAdapterError(error: unknown): void {
    this.logger.error(
      {
        event: 'shipping.adapter.failed',
        adapter: this.adapter.name,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      },
      error instanceof Error ? error.stack : undefined,
      ShippingService.name,
    );
  }

  private mapWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') throw new NotFoundException('Shipment not found');
      if (error.code === 'P2002') throw new ConflictException('Shipment already exists');
      if (error.code === 'P2003') throw new BadRequestException('Invalid order reference');
    }
    throw error;
  }

  private mapShipment(record: Prisma.ShipmentGetPayload<{}>): ShipmentView {
    return {
      id: record.id,
      orderId: record.orderId,
      trackingNumber: record.trackingNumber,
      courier: record.courier,
      status: record.status,
      codAmountPoisha: record.codAmountPoisha,
      bookedAt: record.bookedAt?.toISOString() ?? null,
      deliveredAt: record.deliveredAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    };
  }
}

function mapWebhookStatus(value: string): ShipmentStatus {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const map: Record<string, ShipmentStatus> = {
    pending: 'pending',
    booked: 'booked',
    picked_up: 'picked_up',
    in_transit: 'in_transit',
    delivered: 'delivered',
    returned: 'returned',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    failed: 'failed',
  };
  return map[normalized] ?? 'pending';
}

function timestampForStatus(status: ShipmentStatus) {
  const now = new Date();
  switch (status) {
    case 'booked':
      return { bookedAt: now };
    case 'picked_up':
      return { pickedUpAt: now };
    case 'delivered':
      return { deliveredAt: now };
    case 'returned':
      return { returnedAt: now };
    case 'cancelled':
      return { cancelledAt: now };
    case 'failed':
      return { failedAt: now };
    default:
      return {};
  }
}
