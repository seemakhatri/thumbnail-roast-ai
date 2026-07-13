// _shared/encryption.ts
import { createLogger } from "./logger.ts";

const logger = createLogger("encryption");

export class EncryptionService {
  private key: CryptoKey | null = null;
  private initialized = false;

  constructor(private secretKey: string) {}

  private async getKey(): Promise<CryptoKey> {
    if (this.key) return this.key;

    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(this.secretKey),
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    const salt = encoder.encode("thumbnail-roast-salt-v1");
    
    this.key = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      {
        name: "AES-GCM",
        length: 256,
      },
      false,
      ["encrypt", "decrypt"]
    );

    this.initialized = true;
    return this.key;
  }

  async encrypt(text: string): Promise<string> {
    try {
      const key = await this.getKey();
      const encoder = new TextEncoder();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        {
          name: "AES-GCM",
          iv,
        },
        key,
        encoder.encode(text)
      );

      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Return as base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      logger.error("Encryption failed", error as Error);
      throw new Error("Failed to encrypt data");
    }
  }

  async decrypt(encryptedText: string): Promise<string> {
    try {
      const key = await this.getKey();
      const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
        },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      logger.error("Decryption failed", error as Error);
      throw new Error("Failed to decrypt data");
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

// Singleton instance
let encryptionInstance: EncryptionService | null = null;

export function getEncryptionService(): EncryptionService {
  if (!encryptionInstance) {
    const secretKey = Deno.env.get("ENCRYPTION_KEY");
    if (!secretKey || secretKey.length < 32) {
      throw new Error("ENCRYPTION_KEY must be set and at least 32 characters");
    }
    encryptionInstance = new EncryptionService(secretKey);
  }
  return encryptionInstance;
}