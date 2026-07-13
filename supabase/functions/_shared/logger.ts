export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
  FATAL = "fatal"
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  correlationId?: string;
  userId?: string;
  timestamp: string;
  service: string;
  metadata?: Record<string, unknown>;
}

class LoggerService {
  private service: string;
  private env: string;

  constructor(service: string) {
    this.service = service;
    this.env = Deno.env.get("ENV") || "production";
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.env === "production") {
      return [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL].includes(level);
    }
    return true;
  }

  private format(entry: LogEntry): string {
    return JSON.stringify({
      ...entry,
      timestamp: entry.timestamp || new Date().toISOString(),
      service: this.service,
      environment: this.env,
    });
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      metadata: meta,
    };

    const formatted = this.format(entry);
    console.log(formatted);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.INFO, message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.log(LogLevel.WARN, message, meta);
  }

  // ✅ FIXED: Accept Error or any object, convert to string
  error(message: string, errorOrMeta?: Error | Record<string, unknown> | unknown, meta?: Record<string, unknown>) {
    let errorMeta: Record<string, unknown> = {};
    
    if (errorOrMeta instanceof Error) {
      // Handle Error object - convert to plain object
      errorMeta = {
        errorName: errorOrMeta.name,
        errorMessage: errorOrMeta.message,
        errorStack: this.env === "production" ? undefined : errorOrMeta.stack,
        ...meta,
      };
    } else if (errorOrMeta && typeof errorOrMeta === "object") {
      // Handle other objects - try to convert to Record
      try {
        errorMeta = { ...(errorOrMeta as Record<string, unknown>), ...meta };
      } catch {
        errorMeta = { errorValue: String(errorOrMeta), ...meta };
      }
    } else if (errorOrMeta !== undefined && errorOrMeta !== null) {
      errorMeta = { errorValue: String(errorOrMeta), ...meta };
    } else {
      errorMeta = meta || {};
    }
    
    this.log(LogLevel.ERROR, message, errorMeta);
  }

  fatal(message: string, error?: Error, meta?: Record<string, unknown>) {
    const sanitizedMeta = {
      ...meta,
      errorName: error?.name,
      errorMessage: error?.message,
    };
    this.log(LogLevel.FATAL, message, sanitizedMeta);
  }

  withCorrelationId(correlationId: string): LoggerService {
    return new LoggerService(this.service);
  }
}

export const createLogger = (service: string) => new LoggerService(service);