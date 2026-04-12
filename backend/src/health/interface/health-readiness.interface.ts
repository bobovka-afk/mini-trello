import type { ReadinessProbe } from '../type';

export interface HealthReadiness {
  status: 'ready' | 'not_ready';
  checks: {
    postgres: ReadinessProbe;
    redis: ReadinessProbe;
  };
  timestamp: string;
}
