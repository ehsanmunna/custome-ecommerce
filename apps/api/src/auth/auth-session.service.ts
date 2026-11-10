import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AccessTokenClaims, AuthIdentityType, AuthRuntimeConfig } from './auth-crypto.service';
import { AUTH_RUNTIME_CONFIG, AuthCryptoService } from './auth-crypto.service';
import { PrismaService } from '../platform/database/prisma.service';

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionId: string;
  subjectId: string;
}

@Injectable()
export class AuthSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: AuthCryptoService,
    @Inject(AUTH_RUNTIME_CONFIG) private readonly config: AuthRuntimeConfig,
  ) {}

  async create(identityType: AuthIdentityType, subjectId: string): Promise<AuthTokenPair> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.authRefreshTokenTtlSeconds * 1000);
    const refreshToken = this.crypto.createOpaqueToken();

    const session = await this.prisma.authSession.create({
      data: {
        identityType,
        subjectId,
        expiresAt,
        refreshTokens: {
          create: {
            tokenHash: this.crypto.hashToken('refresh', refreshToken),
            expiresAt,
          },
        },
      },
      select: { id: true, expiresAt: true },
    });
    const signedAccessToken = this.crypto.createAccessToken(
      identityType,
      subjectId,
      session.id,
      session.expiresAt,
      now,
    );

    return {
      accessToken: signedAccessToken.token,
      refreshToken,
      expiresIn: signedAccessToken.expiresIn,
      sessionId: session.id,
      subjectId,
    };
  }

  async rotate(refreshToken: string, identityType: AuthIdentityType): Promise<AuthTokenPair> {
    const tokenHash = this.crypto.hashToken('refresh', refreshToken);
    const now = new Date();
    const result = await this.prisma.$transaction(async (transaction) => {
      const stored = await transaction.authRefreshToken.findUnique({
        where: { tokenHash },
        include: { session: true },
      });

      if (!stored || stored.session.identityType !== identityType) {
        return { state: 'invalid' as const };
      }

      if (stored.consumedAt) {
        await transaction.authSession.updateMany({
          where: { id: stored.sessionId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { state: 'replay' as const };
      }

      if (
        stored.expiresAt <= now ||
        stored.session.expiresAt <= now ||
        stored.session.revokedAt !== null
      ) {
        return { state: 'invalid' as const };
      }

      const consumed = await transaction.authRefreshToken.updateMany({
        where: { id: stored.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });

      if (consumed.count !== 1) {
        await transaction.authSession.updateMany({
          where: { id: stored.sessionId, revokedAt: null },
          data: { revokedAt: now },
        });
        return { state: 'replay' as const };
      }

      const nextRefreshToken = this.crypto.createOpaqueToken();
      await transaction.authRefreshToken.create({
        data: {
          sessionId: stored.sessionId,
          tokenHash: this.crypto.hashToken('refresh', nextRefreshToken),
          expiresAt: stored.session.expiresAt,
        },
      });

      return {
        state: 'rotated' as const,
        sessionId: stored.sessionId,
        subjectId: stored.session.subjectId,
        sessionExpiresAt: stored.session.expiresAt,
        refreshToken: nextRefreshToken,
      };
    });

    if (result.state !== 'rotated') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = this.crypto.createAccessToken(
      identityType,
      result.subjectId,
      result.sessionId,
      result.sessionExpiresAt,
    );

    return {
      accessToken: accessToken.token,
      refreshToken: result.refreshToken,
      expiresIn: accessToken.expiresIn,
      sessionId: result.sessionId,
      subjectId: result.subjectId,
    };
  }

  async validateAccessToken(
    accessToken: string,
    identityType: AuthIdentityType,
  ): Promise<AccessTokenClaims> {
    const claims = this.crypto.verifyAccessToken(accessToken, identityType);
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: claims.sid,
        identityType,
        subjectId: claims.sub,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return claims;
  }

  async revoke(sessionId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
