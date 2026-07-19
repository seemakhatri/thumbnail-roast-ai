import { z } from "zod";
import { errorResponse } from "./cors.ts";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

// Request schemas
export const AnalyzeRequestSchema = z.object({
  imageUrl: z.string()
    .min(1, "Image URL is required")
    .url("Invalid image URL format")
    .max(500, "URL exceeds maximum length")
    .regex(
      /^https:\/\/[a-zA-Z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/thumbnails\//,
      "Image must be from Supabase Storage"
    ),
});

export const ComparisonRequestSchema = z.object({
  thumbnailA: z.string().uuid("Invalid thumbnail A ID"),
  thumbnailB: z.string().uuid("Invalid thumbnail B ID"),
  thumbnailC: z.string().uuid("Invalid thumbnail C ID").optional(),
}).refine((data) => data.thumbnailA !== data.thumbnailB, {
  message: "Thumbnail A and B must be different",
}).refine(
  (data) => !data.thumbnailC || (data.thumbnailC !== data.thumbnailA && data.thumbnailC !== data.thumbnailB),
  {
    message: "Thumbnail C must be different from A and B",
  }
);

export const YouTubeConnectRequestSchema = z.object({
  providerRefreshToken: z.string()
    .min(20, "Token too short")
    .max(500, "Token too long")
    .regex(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/, "Invalid token format"),
});

export const ResearchRequestSchema = z.object({
  mode: z.enum(["channel", "niche", "keyword"]),
  input: z.string()
    .min(2, "Input is too short")
    .max(200, "Input exceeds maximum length"),
});

export const ChannelAuditRequestSchema = z.object({
  force: z.boolean().optional(),
});

export const CreateCheckoutSchema = z.object({
  plan: z.enum(["creator", "business", "agency"]),
  userId: z.string().uuid("Invalid user ID"),
});

// Validation function
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => 
        `${e.path.join(".")}: ${e.message}`
      );
      throw new ValidationError(errors.join("; "));
    }
    throw error;
  }
}

// Middleware wrapper
export async function withValidation<T>(
  req: Request,
  schema: z.ZodSchema<T>,
  handler: (validatedData: T) => Promise<Response>
): Promise<Response> {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    const validated = validateRequest(schema, body);
    return await handler(validated);
  } catch (error) {
    if (error instanceof ValidationError) {
      return errorResponse(error.message, 400);
    }
    throw error;
  }
}