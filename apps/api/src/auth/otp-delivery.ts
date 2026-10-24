import { ServiceUnavailableException } from '@nestjs/common';

export const OTP_DELIVERY_ADAPTER = Symbol('OTP_DELIVERY_ADAPTER');

export interface OtpDeliveryAdapter {
  readonly configured: boolean;
  send(channel: 'sms' | 'email', destination: string, code: string): Promise<void>;
}

export class UnavailableOtpDeliveryAdapter implements OtpDeliveryAdapter {
  readonly configured = false;

  async send(): Promise<void> {
    throw new ServiceUnavailableException('One-time code delivery is not configured');
  }
}
