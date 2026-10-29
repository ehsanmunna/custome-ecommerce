import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';

export type AuthIdentityType = 'customer' | 'admin';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  typ: AuthIdentityType;
  iat: number;
  exp: number;
}

export interface AuthRuntimeConfig {
  authTokenSigningSecret: string;
  authTokenHashSecret: string;
  authAccessTokenTtlSeconds: number;
  authRefreshTokenTtlSeconds: number;
  authOtpTtlSeconds: number;
  authOtpMaxAttempts: number;
  authOtpRateLimitCount: number;
  authOtpRateLimitWindowSeconds: number;
}

export const AUTH_RUNTIME_CONFIG = Symbol('AUTH_RUNTIME_CONFIG');
const TOKEN_ISSUER = 'custome-ecommerce';

@Injectable()
export class AuthCryptoService {
  constructor(@Inject(AUTH_RUNTIME_CONFIG) private readonly config: AuthRuntimeConfig) {}

  createAccessToken(
    identityType: AuthIdentityType,
    subjectId: string,
    sessionId: string,
    sessionExpiresAt: Date,
    now = new Date(),
  ): { token: string; expiresIn: number } {
    const issuedAt = Math.floor(now.getTime() / 1000);
    const expiresAt = Math.min(
      issuedAt + this.config.authAccessTokenTtlSeconds,
      Math.floor(sessionExpiresAt.getTime() / 1000),
    );
    const expiresIn = expiresAt - issuedAt;

    if (expiresIn <= 0) {
      throw new UnauthorizedException('Authentication session has expired');
    }

    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const payload = this.encode({
      iss: TOKEN_ISSUER,
      aud: identityType,
      sub: subjectId,
      sid: sessionId,
      typ: identityType,
      iat: issuedAt,
      exp: expiresAt,
      jti: randomBytes(16).toString('base64url'),
    });
    const signingInput = `${header}.${payload}`;
    const signature = this.sign(signingInput);

    return { token: `${signingInput}.${signature}`, expiresIn };
  }

  verifyAccessToken(
    token: string,
    expectedIdentity: AuthIdentityType,
    now = new Date(),
  ): AccessTokenClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Invalid access token');
    }

    const [encodedHeader, encodedPayload, signature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.sign(signingInput);

    if (!this.constantTimeEquals(signature, expectedSignature)) {
      throw new UnauthorizedException('Invalid access token');
    }

    try {
      const header: unknown = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
      const payload: unknown = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );

      if (
        !this.isRecord(header) ||
        header.alg !== 'HS256' ||
        header.typ !== 'JWT' ||
        !this.isRecord(payload) ||
        payload.iss !== TOKEN_ISSUER ||
        payload.aud !== expectedIdentity ||
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        payload.typ !== expectedIdentity ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        payload.exp <= payload.iat ||
        payload.exp <= Math.floor(now.getTime() / 1000) ||
        payload.iat > Math.floor(now.getTime() / 1000)
      ) {
        throw new UnauthorizedException('Invalid or expired access token');
      }

      return {
        sub: payload.sub,
        sid: payload.sid,
        typ: expectedIdentity,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Invalid access token');
    }
  }

  createOpaqueToken(): string {
    return randomBytes(48).toString('base64url');
  }

  createOtpCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  hashToken(purpose: 'refresh' | 'otp', token: string): string {
    return createHmac('sha256', this.config.authTokenHashSecret)
      .update(`${purpose}:${token}`)
      .digest('hex');
  }

  private sign(value: string): string {
    return createHmac('sha256', this.config.authTokenSigningSecret)
      .update(value)
      .digest('base64url');
  }

  private encode(value: unknown): string {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private constantTimeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
