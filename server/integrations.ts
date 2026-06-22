/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { v2 as cloudinary } from "cloudinary";
import { Resend } from "resend";


// ─── Startup environment validation 
const missingEnvWarnings: string[] = [];
if (!process.env.CLOUDINARY_URL && !(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)) {
  missingEnvWarnings.push("CLOUDINARY_URL or (CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET)");
}
if (!process.env.RESEND_API_KEY) {
  missingEnvWarnings.push("RESEND_API_KEY");
}
if (missingEnvWarnings.length > 0) {
  console.warn(
    "[ENV WARNING] The following optional environment variables are not set — " +
    "affected features will run in simulation mode:\n  • " +
    missingEnvWarnings.join("\n  • ")
  );
}

// ─── Cloudinary ───────────────────────────────────────────────────────────────
let isCloudinaryConfigured = false;

if (process.env.CLOUDINARY_URL) {
  // Single-URL form: cloudinary://api_key:api_secret@cloud_name
  cloudinary.config();
  isCloudinaryConfigured = true;
  console.log("[CLOUDINARY] Configured via CLOUDINARY_URL.");
} else if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  isCloudinaryConfigured = true;
  console.log("[CLOUDINARY] Configured via individual credential variables.");
}

// ─── Resend ───────────────────────────────────────────────────────────────────
let resendInstance: Resend | null = null;

if (process.env.RESEND_API_KEY) {
  resendInstance = new Resend(process.env.RESEND_API_KEY);
  console.log("[RESEND] API client initialised.");
}

// ─── Allowed MIME types for upload validation ─────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  // Documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
]);

const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export function parseMimeFromDataUri(dataUri: string): string | null {
  const match = dataUri.match(/^data:([a-zA-Z0-9][a-zA-Z0-9!#$&\-^_]+\/[a-zA-Z0-9][a-zA-Z0-9!#$&\-^_.+]+);base64,/);
  return match ? match[1].toLowerCase() : null;
}

export function validateUpload(
  base64Data: string,
  filename: string,
  kind?: string
): { ok: true } | { ok: false; error: string } {
  const ALLOWED_IMAGE_EXT = /\.(jpe?g|png|gif|webp)$/i;
  const ALLOWED_DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|csv|txt)$/i;

  const isImageExt = ALLOWED_IMAGE_EXT.test(filename);
  const isDocExt = ALLOWED_DOC_EXT.test(filename);

  if (!isImageExt && !isDocExt) {
    return { ok: false, error: "Unsupported file type." };
  }
  if (kind === "cover" && !isImageExt) {
    return { ok: false, error: "Cover images must be JPG, PNG, GIF, or WEBP." };
  }

  const mime = parseMimeFromDataUri(base64Data);
  if (mime) {
    if (!ALLOWED_MIME_TYPES.has(mime)) {
      return { ok: false, error: `File MIME type "${mime}" is not permitted.` };
    }
    if (kind === "cover" && !IMAGE_MIME_TYPES.has(mime)) {
      return { ok: false, error: "Cover images must be an image MIME type." };
    }
    // Cross-check: extension says image but MIME says document (or vice-versa)
    if (isImageExt && !IMAGE_MIME_TYPES.has(mime)) {
      return { ok: false, error: "File extension and content type do not match." };
    }
    if (isDocExt && IMAGE_MIME_TYPES.has(mime)) {
      return { ok: false, error: "File extension and content type do not match." };
    }
  }

  return { ok: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function extractPublicIdFromUrl(
  url: string
): { public_id: string; resource_type: string } | null {
  try {
    if (!url || !url.includes("res.cloudinary.com")) return null;

    const parts = url.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;

    // resource_type sits one segment before "upload"  e.g. /image/upload/...
    const resource_type = parts[uploadIdx - 1] || "image";

    // Everything after "upload"
    const rest = parts.slice(uploadIdx + 1);

    // Strip optional version segment (v1234567890)
    const filtered = rest[0] && /^v\d+$/.test(rest[0]) ? rest.slice(1) : rest;

    // Strip transformation segment (contains commas, e.g. "w_400,c_limit")
    const clean =
      filtered[0] && filtered[0].includes(",") ? filtered.slice(1) : filtered;

    const pathWithExt = clean.join("/");
    const dotIdx = pathWithExt.lastIndexOf(".");
    const public_id = dotIdx !== -1 ? pathWithExt.substring(0, dotIdx) : pathWithExt;

    return { public_id, resource_type };
  } catch (err) {
    console.error("[CLOUDINARY] Could not extract public_id from URL:", url, err);
    return null;
  }
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadToCloudinary(
  base64Data: string,
  filename: string,
  folderName: string = "projectflow"
): Promise<{ url: string; public_id?: string; simulated?: boolean }> {

  if (!isCloudinaryConfigured) {
    console.log("[CLOUDINARY SIMULATION] Skipping real upload for:", filename);
    const isImage = /\.(jpe?g|png|gif|webp|svg|bmp|tiff|heic)$/i.test(filename);
    const mockUrl = isImage
      ? "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=600"
      : "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    return { url: mockUrl, simulated: true };
  }

  try {
    const isRawFile = !/\.(jpe?g|png|gif|webp|bmp|tiff|heic)$/i.test(filename);

    const sanitized = filename.replace(/[,/\\]/g, "_");

    const lastDot = sanitized.lastIndexOf(".");
    const publicId = isRawFile && lastDot > 0 ? sanitized.slice(0, lastDot) : sanitized;
    const ext = isRawFile && lastDot > 0 ? sanitized.slice(lastDot + 1).toLowerCase() : undefined;

    const result = await cloudinary.uploader.upload(base64Data, {
      folder: folderName,
      public_id: publicId,
      overwrite: true,
      resource_type: isRawFile ? "raw" : "auto",
      ...(ext ? { format: ext } : {}),
    });

    console.log("[CLOUDINARY] Upload successful:", result.secure_url);
    return { url: result.secure_url, public_id: result.public_id };

  } catch (error: any) {
    console.error("[CLOUDINARY] Upload failed:", error.message ?? error);
    throw new Error(`Cloudinary upload failed: ${error.message ?? error}`);
  }
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteFromCloudinary(url: string): Promise<boolean> {
  const meta = extractPublicIdFromUrl(url);
  if (!meta) {
    console.log("[CLOUDINARY] Skipping non-Cloudinary URL:", url);
    return false;
  }

  if (!isCloudinaryConfigured) {
    console.log("[CLOUDINARY SIMULATION] Would delete:", meta.public_id);
    return true;
  }

  try {
    const result = await cloudinary.uploader.destroy(meta.public_id, {
      resource_type: meta.resource_type as any,
    });
    const ok = result.result === "ok";
    console.log(`[CLOUDINARY] Delete "${meta.public_id}" → ${result.result}`);
    return ok;
  } catch (err: any) {
    console.error(`[CLOUDINARY] Delete failed for "${meta.public_id}":`, err.message ?? err);
    return false;
  }
}

// ─── Email ────────────────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; data?: any; error?: string; simulated?: boolean }> {

  if (!resendInstance) {
    console.log(
      `\n${"─".repeat(60)}\n` +
      `[RESEND SIMULATION] To: ${to}\nSubject: ${subject}\n` +
      `Preview:\n${html.substring(0, 400)}…\n` +
      `${"─".repeat(60)}\n`
    );
    return { success: true, simulated: true };
  }

  try {
    const fromAddress =
      process.env.RESEND_FROM_EMAIL ?? "ProjectFlow <onboarding@resend.dev>";

    const { data, error } = await resendInstance.emails.send({
      from: fromAddress,
      to,
      subject,
      html,
    });

    if (error) {
      console.error(`[RESEND] Rejected for ${to}:`, error.message ?? error);
      return { success: false, error: error.message ?? String(error) };
    }

    console.log(`[RESEND] Email delivered to ${to}. ID:`, data?.id);
    return { success: true, data };
  } catch (error: any) {
    console.error(`[RESEND] Failed to send to ${to}:`, error.message ?? error);
    return { success: false, error: error.message ?? String(error) };
  }
}

// ─── Formatted notification email ─────────────────────────────────────────────

export async function deliverFormattedNotification({
  recipientName,
  recipientEmail,
  subject,
  heading,
  message,
  actionLabel,
  actionUrl,
  metaDetails,
}: {
  recipientName: string;
  recipientEmail: string;
  subject: string;
  heading: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
  metaDetails?: { label: string; value: string }[];
}): Promise<boolean> {
  if (!recipientEmail) return false;

  const esc = (s: string) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const metaRowsHtml =
    metaDetails && metaDetails.length > 0
      ? `<div style="background:#f1f5f9;padding:14px;border-radius:8px;margin-bottom:24px;font-size:13px;font-family:monospace;">
          ${metaDetails
        .map(
          (item) =>
            `<div style="margin-bottom:6px;">
                  <strong style="color:#475569;">${esc(item.label)}:</strong>
                  <span style="color:#0f172a;"> ${esc(item.value)}</span>
                </div>`
        )
        .join("")}
        </div>`
      : "";

  const actionButtonHtml =
    actionUrl && actionLabel
      ? `<div style="text-align:center;margin:28px 0;">
          <a href="${esc(actionUrl)}"
             style="background:#0d9488;color:#fff;padding:12px 24px;font-size:14px;
                    font-weight:bold;border-radius:6px;text-decoration:none;display:inline-block;">
            ${esc(actionLabel)}
          </a>
        </div>`
      : "";

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${esc(subject)}</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
             background:#f8fafc;padding:24px;margin:0;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:12px;
              border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.05);">

    <!-- Header banner -->
    <div style="background:#3d1a6e;padding:32px 24px;text-align:center;color:#fff;">
      <div style="font-size:24px;font-weight:bold;letter-spacing:-.025em;margin:0;">ProjectFlow</div>
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.1em;
                  color:#0d9488;font-weight:700;margin-top:4px;">Collaborate Professionally</div>
    </div>

    <!-- Body -->
    <div style="padding:32px 24px;">
      <p style="font-size:15px;color:#334155;margin-top:0;">
        Hello <strong>${esc(recipientName)}</strong>,
      </p>
      <h2 style="font-size:18px;color:#0f172a;font-weight:700;margin:16px 0 12px;">${esc(heading)}</h2>
      <p style="font-size:14px;color:#475569;line-height:1.6;margin-bottom:24px;">${esc(message)}</p>

      ${metaRowsHtml}
      ${actionButtonHtml}

      <hr style="border:none;border-top:1px solid #f1f5f9;margin:28px 0;" />
      <p style="font-size:11px;color:#94a3b8;text-align:center;margin:0;line-height:1.4;">
        You received this automated alert because you are registered on ProjectFlow.<br/>
        &copy; ${new Date().getFullYear()} ProjectFlow &mdash; Hosted on secure workspace server.
      </p>
    </div>
  </div>
</body>
</html>`;

  const result = await sendEmail({ to: recipientEmail, subject, html });
  return result.success;
}