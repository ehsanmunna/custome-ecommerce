import { ServiceUnavailableException } from '@nestjs/common';

export const OTP_DELIVERY_ADAPTER = Symbol('OTP_DELIVERY_ADAPTER');

export type OtpDeliveryChannel = 'sms' | 'email';

export interface OtpDeliveryAdapter {
  isConfigured(channel: OtpDeliveryChannel): boolean;
  send(channel: OtpDeliveryChannel, destination: string, code: string): Promise<void>;
}

export class UnavailableOtpDeliveryAdapter implements OtpDeliveryAdapter {
  isConfigured(): boolean {
    return false;
  }

  async send(): Promise<void> {
    throw new ServiceUnavailableException('One-time code delivery is not configured');
  }
}
