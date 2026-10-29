import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AuthCryptoService, AUTH_RUNTIME_CONFIG } from './auth-crypto.service';
import { AdminAuthController, CustomerAuthController } from './auth.controller';
import { AuthenticationGuard } from './authentication.guard';
import { AuthService } from './auth.service';
import { AuthSessionService } from './auth-session.service';
import { OTP_DELIVERY_ADAPTER } from './otp-delivery';
import { ProviderOtpDeliveryAdapter } from './otp-delivery.providers';
import { PasswordHashService } from './password-hash.service';
import { AppConfigService } from '../platform/config/app-config.service';
import { ProblemDetailsFilter } from '../platform/problem-details.filter';

@Module({
  controllers: [CustomerAuthController, AdminAuthController],
  providers: [
    AuthCryptoService,
    AuthSessionService,
    AuthService,
    PasswordHashService,
    AuthenticationGuard,
    ProblemDetailsFilter,
    { provide: AUTH_RUNTIME_CONFIG, useExisting: AppConfigService },
    {
      provide: OTP_DELIVERY_ADAPTER,
      useFactory: (config: AppConfigService) =>
        new ProviderOtpDeliveryAdapter({
          resendApiKey: config.resendApiKey,
          resendFromEmail: config.resendFromEmail,
          twilioAccountSid: config.twilioAccountSid,
          twilioAuthToken: config.twilioAuthToken,
          twilioFromNumber: config.twilioFromNumber,
          authOtpTtlSeconds: config.authOtpTtlSeconds,
        }),
      inject: [AppConfigService],
    },
    { provide: APP_GUARD, useExisting: AuthenticationGuard },
    { provide: APP_FILTER, useExisting: ProblemDetailsFilter },
  ],
  exports: [AuthService, AuthSessionService, AuthCryptoService],
})
export class AuthModule {}
