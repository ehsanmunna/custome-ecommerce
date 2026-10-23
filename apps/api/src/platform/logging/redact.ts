const SECRET_KEY_PATTERN =
  /(secret|password|passwd|token|credential|api[_-]?key|private[_-]?key|database[_-]?url|connection[_-]?string)/i;

export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

export function redactText(text: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((current, secret) => current.split(secret).join('[REDACTED]'), text);
}

export function redactValue(value: unknown, secrets: string[]): unknown {
  if (typeof value === 'string') {
    return redactText(value, secrets);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, secrets));
  }

  if (value instanceof Date || value instanceof Error) {
    return redactText(value instanceof Error ? value.message : value.toISOString(), secrets);
  }

  if (value !== null && typeof value === 'object') {
    return redactRecord(value as Record<string, unknown>, secrets);
  }

  return value;
}

export function redactRecord(
  record: Record<string, unknown>,
  secrets: string[],
): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record)) {
    redacted[key] = isSecretKey(key) ? '[REDACTED]' : redactValue(value, secrets);
  }

  return redacted;
}
