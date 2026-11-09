describe('app configuration service', () => {
  it('exposes media settings and includes configured credentials in log redaction', () => {
    const config = {
      DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app',
      AUTH_TOKEN_SIGNING_SECRET: 'signing-secret-at-least-32-chars',
      AUTH_TOKEN_HASH_SECRET: 'hash-secret-at-least-32-chars',
    } as unknown;

    expect((config as { secretValues: () => string[] }).secretValues()).toEqual([
      'postgresql://app_runtime:secret@localhost:5432/app',
      'signing-secret-at-least-32-chars',
      'hash-secret-at-least-32-chars',
    ]);
  });

  it('describes effective configuration without exposing credentials', () => {
    const described = {
      DATABASE_URL: '[REDACTED]',
      AUTH_TOKEN_SIGNING_SECRET: '[REDACTED]',
      AUTH_TOKEN_HASH_SECRET: '[REDACTED]',
    };

    expect(JSON.stringify(described)).not.toContain('secret-key');
  });

  it('omits absent credentials from log redaction', () => {
    const config = {
      DATABASE_URL: 'postgresql://app_runtime:secret@localhost:5432/app',
      AUTH_TOKEN_SIGNING_SECRET: 'signing-secret-at-least-32-chars',
      AUTH_TOKEN_HASH_SECRET: 'hash-secret-at-least-32-chars',
    } as unknown;

    expect((config as { secretValues: () => string[] }).secretValues()).toEqual([
      'postgresql://app_runtime:secret@localhost:5432/app',
      'signing-secret-at-least-32-chars',
      'hash-secret-at-least-32-chars',
    ]);
  });
});
