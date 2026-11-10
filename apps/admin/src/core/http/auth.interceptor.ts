import { inject } from '@angular/core';
import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, defer, finalize, from, type Observable, shareReplay, switchMap, throwError } from 'rxjs';
import { AuthService, type AuthSession } from '../../auth/auth.service';
import { ADMIN_AUTH_CONFIG } from '../../auth/auth.config';
import { NotificationService } from '../notifications/notification.service';
import { isGlobalHttpError, extractErrorMessage } from '../notifications/notification-messages';

let refreshInFlight: Observable<AuthSession> | null = null;

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notification = inject(NotificationService);
  const config = inject(ADMIN_AUTH_CONFIG);

  const isApiRequest = request.url.startsWith(config.apiBaseUrl);
  const isPublicAuthRequest =
    request.url.startsWith(`${config.apiBaseUrl}${config.loginPath}`) ||
    request.url.startsWith(`${config.apiBaseUrl}${config.refreshPath}`) ||
    request.url.startsWith(`${config.apiBaseUrl}${config.mePath}`);
  const token = auth.token;
  const authorizedRequest =
    isApiRequest && !isPublicAuthRequest && token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isPublicAuthRequest
      ) {
        if (!auth.refreshTokenValue) {
          return failSession(auth, router, notification, error);
        }

        return refreshSession(auth).pipe(
          switchMap((session) =>
            next(request.clone({ setHeaders: { Authorization: `Bearer ${session.accessToken}` } })),
          ),
          catchError((refreshError: unknown) =>
            failSession(auth, router, notification, refreshError),
          ),
        );
      }

      if (error instanceof HttpErrorResponse && isGlobalHttpError(error.status)) {
        notification.error(
          extractErrorMessage(error, 'An unexpected error occurred.'),
        );
      }

      return throwError(() => error);
    }),
  );
};

function refreshSession(auth: AuthService): Observable<AuthSession> {
  if (!refreshInFlight) {
    refreshInFlight = defer(() => from(auth.refresh())).pipe(
      finalize(() => {
        refreshInFlight = null;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
  }

  return refreshInFlight;
}

function failSession(
  auth: AuthService,
  router: Router,
  notification: NotificationService,
  error: unknown,
): Observable<never> {
  auth.clear();
  void router.navigate(['/login'], {
    queryParams: { returnUrl: router.url },
  });
  notification.error('Session expired. Please log in again.');
  return throwError(() => error);
}
