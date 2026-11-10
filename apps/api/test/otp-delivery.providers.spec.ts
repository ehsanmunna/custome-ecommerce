import { describe, expect, it, vi } from 'vitest';
import {
  ProviderOtpDeliveryAdapter,
  type OtpDeliveryProviderSettings,
} from '../src/auth/otp-delivery.providers';

const settings: OtpDeliveryProviderSettings = {
  resendApiKey: 'resend-secret',
  resendFromEmail: 'otp@example.com',
  twilioAccountSid: 'AC123',
  twilioAuthToken: 'twilio-secret',
  twilioFromNumber: '+15005550006',
  authOtpTtlSeconds: 300,
};

function createFetchMock(payload: unknown, status = 200) {
  return vi.fn<typeof fetch>().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

describe('provider OTP delivery adapter', () => {
  it('sends email OTPs through Resend with a bounded request and bilingual message', async () => {
    const httpFetch = createFetchMock({ id: 'email-id' });
    const adapter = new ProviderOtpDeliveryAdapter(settings, { fetch: httpFetch });

    await adapter.send('email', 'customer@example.com', '123456');

    expect(httpFetch).toHaveBeenCalledOnce();
    const [url, options] = httpFetch.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(options?.method).toBe('POST');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(options?.headers).get('Authorization')).toBe('Bearer resend-secret');
    const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: 'otp@example.com',
      to: ['customer@example.com'],
      subject: 'Your verification code',
    });
    expect(body.text).toContain('123456');
    expect(body.text).toContain('৫ মিনিট');
    expect(body.text).toContain('5 minutes');
  });

  it('sends SMS OTPs through Twilio with encoded form fields and a bounded request', async () => {
    const httpFetch = createFetchMock({ sid: 'SM123', status: 'queued' });
    const adapter = new ProviderOtpDeliveryAdapter(settings, { fetch: httpFetch });

    await adapter.send('sms', '+8801712345678', '654321');

    expect(httpFetch).toHaveBeenCalledOnce();
    const [url, options] = httpFetch.mock.calls[0]!;
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json');
    expect(options?.method).toBe('POST');
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(options?.headers).get('Content-Type')).toBe(
      'application/x-www-form-urlencoded',
    );
    expect(new Headers(options?.headers).get('Authorization')).toBe(
      `Basic ${Buffer.from('AC123:twilio-secret').toString('base64')}`,
    );
    const body = options?.body as URLSearchParams;
    expect(body.get('To')).toBe('+8801712345678');
    expect(body.get('From')).toBe('+15005550006');
    expect(body.get('Body')).toContain('654321');
    expect(body.get('Body')).toContain('৫ মিনিট');
    expect(body.get('Body')).toContain('5 minutes');
  });

  it.each(['email', 'sms'] as const)(
    'rejects provider errors without leaking response data for %s',
    async (channel) => {
    const httpFetch = createFetchMock(
      { error: 'private provider detail resend-secret 123456' },
      401,
    );
    const adapter = new ProviderOtpDeliveryAdapter(settings, { fetch: httpFetch });

      await expect(adapter.send(channel, 'private-destination', '123456')).rejects.toMatchObject({
        message: channel === 'email' ? 'OTP email delivery failed' : 'OTP SMS delivery failed',
      });
    },
  );

  it.each([
    ['email', {}, 'OTP email delivery failed'],
    ['sms', { sid: 'SM123', status: 'failed' }, 'OTP SMS delivery failed'],
  ] as const)('rejects malformed success responses for %s', async (channel, payload, message) => {
    const httpFetch = createFetchMock(payload);
    const adapter = new ProviderOtpDeliveryAdapter(settings, { fetch: httpFetch });

    await expect(adapter.send(channel, 'customer@example.com', '123456')).rejects.toThrow(message);
  });

  it.each(['email', 'sms'] as const)('sanitizes transport timeouts for %s', async (channel) => {
    const httpFetch = vi.fn<typeof fetch>().mockRejectedValue(
      new DOMException('request timed out with resend-secret and OTP 123456', 'TimeoutError'),
    );
    const adapter = new ProviderOtpDeliveryAdapter(settings, { fetch: httpFetch });

    await expect(adapter.send(channel, 'customer@example.com', '123456')).rejects.toMatchObject({
      message: channel === 'email' ? 'OTP email delivery failed' : 'OTP SMS delivery failed',
    });
  });
});
