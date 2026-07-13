import { createClient } from "./deps.ts";
import { createLogger } from "./logger.ts";
import { getConfig } from "./config.ts";

const logger = createLogger("audit");

export enum AuditAction {
  USER_LOGIN = "USER_LOGIN",
  USER_LOGOUT = "USER_LOGOUT",
  USER_REGISTER = "USER_REGISTER",
  THUMBNAIL_ANALYZED = "THUMBNAIL_ANALYZED",
  THUMBNAIL_COMPARED = "THUMBNAIL_COMPARED",
  THUMBNAIL_REPORT_VIEWED = "THUMBNAIL_REPORT_VIEWED",
  YOUTUBE_CONNECTED = "YOUTUBE_CONNECTED",
  YOUTUBE_DISCONNECTED = "YOUTUBE_DISCONNECTED",
  YOUTUBE_SYNCED = "YOUTUBE_SYNCED",
  SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED",
  SUBSCRIPTION_UPDATED = "SUBSCRIPTION_UPDATED",
  SUBSCRIPTION_CANCELLED = "SUBSCRIPTION_CANCELLED",
  ADMIN_ACTION = "ADMIN_ACTION",
}

export interface AuditLogEntry {
  userId?: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAuditEvent(
  entry: AuditLogEntry,
  req?: Request
): Promise<void> {
  try {
    const config = getConfig();
    const supabase = createClient(
      config.get("SUPABASE_URL"),
      config.get("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } }
    );

    const ipAddress = entry.ipAddress ||
      req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req?.headers.get("x-real-ip") ||
      null;

    const userAgent = entry.userAgent ||
      req?.headers.get("user-agent") ||
      null;

    const logData = {
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: entry.metadata || {},
    };

    const { error } = await supabase
      .from("audit_log")
      .insert(logData);

    if (error) {
      logger.error("Failed to write audit log", error, {
        action: entry.action,
        userId: entry.userId
      });
    }
  } catch (error) {
    logger.error("Audit logging failed", error as Error);
  }
}

export async function logThumbnailAnalyzed(
  userId: string | null,
  reportId: string,
  score: number,
  niche: string,
  req?: Request
): Promise<void> {
  await logAuditEvent({
    userId: userId || undefined,
    action: AuditAction.THUMBNAIL_ANALYZED,
    resourceType: "report",
    resourceId: reportId,
    metadata: { score, niche },
  }, req);
}

export async function logYouTubeConnected(
  userId: string,
  channelId: string,
  req?: Request
): Promise<void> {
  await logAuditEvent({
    userId,
    action: AuditAction.YOUTUBE_CONNECTED,
    resourceType: "youtube_connection",
    resourceId: channelId,
    metadata: { channelId },
  }, req);
}