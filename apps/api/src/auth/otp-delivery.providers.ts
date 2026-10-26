import type { OtpDeliveryChannel, OtpDeliveryAdapter } from './otp-delivery';

export interface OtpDeliveryProviderSettings {
  resendApiKey?: string;
  resendFromEmail?: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioFromNumber?: string;
  authOtpTtlSeconds: number;
}

export interface OtpDeliveryProviderDependencies {
  fetch?: typeof fetch;
}

const PROVIDER_TIMEOUT_MS = 10_000;
const RESEND_EMAILS_URL = 'https://api.resend.com/emails';
const TWILIO_API_BASE_URL = 'https://api.twilio.com/2010-04-01/Accounts';

function formatDuration(seconds: number): { english: string; bangla: string } {
  if (seconds % 60 === 0) {
    const minutes = seconds / 60;
    const english = `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
    const banglaMinutes = String(minutes).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
    return { english, bangla: `${banglaMinutes} মিনিট` };
  }

  const banglaSeconds = String(seconds).replace(/\d/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
  return { english: `${seconds} seconds`, bangla: `${banglaSeconds} সেকেন্ড` };
}

function createOtpMessage(code: string, ttlSeconds: number): string {
  const duration = formatDuration(ttlSeconds);
  return `যাচাইকরণ কোড: ${code}। মেয়াদ: ${duration.bangla}। Verification code: ${code}. Valid for ${duration.english}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export class ProviderOtpDeliveryAdapter implements OtpDeliveryAdapter {
  private readonly httpFetch: typeof fetch;

  constructor(
    private readonly settings: OtpDeliveryProviderSettings,
    dependencies: OtpDeliveryProviderDependencies = {},
  ) {
    this.httpFetch = dependencies.fetch ?? fetch;
  }

  isConfigured(channel: OtpDeliveryChannel): boolean {
    return channel === 'email'
      ? Boolean(this.settings.resendApiKey && this.settings.resendFromEmail)
      : Boolean(
          this.settings.twilioAccountSid &&
            this.settings.twilioAuthToken &&
            this.settings.twilioFromNumber,
        );
  }

  async send(
    channel: OtpDeliveryChannel,
    destination: string,
    code: string,
  ): Promise<void> {
    if (!this.isConfigured(channel)) {
      throw new Error('OTP delivery channel is not configured');
    }

    if (channel === 'email') {
      await this.sendEmail(destination, code);
      return;
    }

    await this.sendSms(destination, code);
  }

  private async sendEmail(destination: string, code: string): Promise<void> {
    const message = createOtpMessage(code, this.settings.authOtpTtlSeconds);
    let response: Response;
    try {
      response = await this.httpFetch(RESEND_EMAILS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.settings.resendFromEmail,
          to: [destination],
          subject: 'Your verification code',
          text: message,
          html: `<p>${message}</p>`,
        }),
        signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      });
    } catch {
      throw new Error('OTP email delivery failed');
    }

    if (!response.ok) {
      throw new Error('OTP email delivery failed');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('OTP email delivery failed');
    }

    if (!isRecord(payload) || typeof payload.id !== 'string' || payload.id.length === 0) {
      throw new Error('OTP email delivery failed');
    }
  }

  private async sendSms(destination: string, code: string): Promise<void> {
    const accountSid = this.settings.twilioAccountSid;
    const authToken = this.settings.twilioAuthToken;
    const fromNumber = this.settings.twilioFromNumber;
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('OTP SMS delivery failed');
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: destination,
      From: fromNumber,
      Body: createOtpMessage(code, this.settings.authOtpTtlSeconds),
    });

    let response: Response;
    try {
      response = await this.httpFetch(
        `${TWILIO_API_BASE_URL}/${encodeURIComponent(accountSid)}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        },
      );
    } catch {
      throw new Error('OTP SMS delivery failed');
    }

    if (!response.ok) {
      throw new Error('OTP SMS delivery failed');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new Error('OTP SMS delivery failed');
    }

    if (
      !isRecord(payload) ||
      typeof payload.sid !== 'string' ||
      payload.sid.length === 0 ||
      !['queued', 'sending', 'sent', 'delivered'].includes(String(payload.status))
    ) {
      throw new Error('OTP SMS delivery failed');
    }
  }
}
