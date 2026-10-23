export type HealthStatus = 'ok' | 'error';

export interface HealthCheckResult {
  status: HealthStatus;
}

export interface ReadinessResponse {
  status: HealthStatus;
  checks: {
    database: HealthCheckResult;
    schema: HealthCheckResult;
  };
}

export interface LivenessResponse {
  status: HealthStatus;
}
