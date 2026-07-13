export class Config {
  private static instance: Config;
  private config: Map<string, string> = new Map();
  private initialized = false;

  private constructor() {
    this.loadSecrets();
  }

  private loadSecrets(): void {
    // Required secrets - will throw if missing
    const required = [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "GEMINI_API_KEY",
      "ENCRYPTION_KEY",
    ];

    for (const key of required) {
      const value = Deno.env.get(key);
      if (!value) {
        throw new Error(`Missing required secret: ${key}`);
      }
      this.config.set(key, value);
    }

    // Optional secrets - only set if available
    const optional = [
      "GROQ_API_KEY",
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_CREATOR_PRICE_ID",
      "STRIPE_BUSINESS_PRICE_ID",
      "STRIPE_AGENCY_PRICE_ID",
      "FRONTEND_ORIGIN",
      "ALLOWED_ORIGIN",
      "ENV",
      "SUPABASE_DB_URL",
    ];

    for (const key of optional) {
      const value = Deno.env.get(key);
      if (value) {
        this.config.set(key, value);
      }
    }

    this.initialized = true;
  }

  static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  get(key: string): string {
    const value = this.config.get(key);
    if (!value) {
      throw new Error(`Config key not found: ${key}`);
    }
    return value;
  }

  getOptional(key: string): string | undefined {
    return this.config.get(key);
  }

  getRequired(key: string): string {
    const value = this.config.get(key);
    if (!value) {
      throw new Error(`Required config key missing: ${key}`);
    }
    return value;
  }

  isProduction(): boolean {
    return this.getOptional("ENV") === "production";
  }

  isDevelopment(): boolean {
    return this.getOptional("ENV") !== "production";
  }

getFrontendOrigin(): string {
  return this.getOptional("FRONTEND_ORIGIN") || "https://thumbnail-roast.com";
}
  getAllowedOrigin(): string {
    return this.getOptional("ALLOWED_ORIGIN") || this.getFrontendOrigin();
  }
}

export function getConfig(): Config {
  return Config.getInstance();
}