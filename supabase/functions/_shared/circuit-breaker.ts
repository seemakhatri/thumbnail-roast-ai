// _shared/circuit-breaker.ts
import { createLogger } from "./logger.ts";

const logger = createLogger("circuit-breaker");

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  total: number;
  failureRate: number;
}

export class CircuitBreaker {
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private state: CircuitState = CircuitState.CLOSED;
  private metrics: CircuitBreakerMetrics = {
    failures: 0,
    successes: 0,
    total: 0,
    failureRate: 0,
  };

  constructor(
    private name: string,
    private failureThreshold: number = 5,
    private timeoutSeconds: number = 60,
    private halfOpenMaxAttempts: number = 3
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.updateMetrics();

    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = (Date.now() - this.lastFailureTime) / 1000;
      if (timeSinceLastFailure < this.timeoutSeconds) {
        const remaining = Math.ceil(this.timeoutSeconds - timeSinceLastFailure);
        logger.warn(`Circuit ${this.name} is OPEN`, { remainingSeconds: remaining });
        throw new Error(`Circuit ${this.name} is open - try again in ${remaining}s`);
      }
      
      logger.info(`Circuit ${this.name} moving to HALF_OPEN`);
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      
      if (this.state === CircuitState.HALF_OPEN) {
        // Only close if we're below threshold
        if (this.failures < this.failureThreshold) {
          logger.info(`Circuit ${this.name} CLOSED after successful half-open attempt`);
          this.state = CircuitState.CLOSED;
          this.failures = 0;
        } else {
          // Back to open
          logger.warn(`Circuit ${this.name} reopening after half-open failure`);
          this.state = CircuitState.OPEN;
          this.lastFailureTime = Date.now();
        }
      }
      
      this.successes++;
      this.metrics.successes++;
      this.metrics.total++;
      
      return result;
    } catch (error) {
      this.failures++;
      this.metrics.failures++;
      this.metrics.total++;
      this.lastFailureTime = Date.now();

      if (this.failures >= this.failureThreshold) {
        logger.warn(`Circuit ${this.name} OPENED after ${this.failures} failures`);
        this.state = CircuitState.OPEN;
      }

      throw error;
    }
  }

  private updateMetrics(): void {
    const total = this.metrics.failures + this.metrics.successes;
    if (total > 0) {
      this.metrics.failureRate = this.metrics.failures / total;
    }
    
    // Log metrics periodically
    if (total % 100 === 0) {
      logger.info(`Circuit ${this.name} metrics`, { metrics: this.metrics });
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  reset(): void {
    logger.info(`Circuit ${this.name} reset`);
    this.failures = 0;
    this.successes = 0;
    this.state = CircuitState.CLOSED;
    this.lastFailureTime = 0;
    this.metrics = {
      failures: 0,
      successes: 0,
      total: 0,
      failureRate: 0,
    };
  }
}

// Create shared instances
export const geminiCircuitBreaker = new CircuitBreaker(
  "gemini-api",
  3, // Failure threshold
  120, // Timeout seconds
  2 // Half-open attempts
);

export const youtubeCircuitBreaker = new CircuitBreaker(
  "youtube-api",
  5,
  60,
  3
);

export const stripeCircuitBreaker = new CircuitBreaker(
  "stripe-api",
  3,
  300,
  2
);