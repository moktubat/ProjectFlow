/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { v2 as cloudinary } from "cloudinary";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Initialize Cloudinary
let isCloudinaryConfigured = false;
if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
  isCloudinaryConfigured = true;
  console.log("[CLOUDINARY] Configured via CLOUDINARY_URL.");
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
  isCloudinaryConfigured = true;
  console.log("[CLOUDINARY] Configured via separate API credentials.");
} else {
  console.log("[CLOUDINARY WARNING] No Cloudinary environment credentials located. File uploads will utilize memory/fallback storage.");
}

// Initialize Resend
let resendInstance: Resend | null = null;
if (process.env.RESEND_API_KEY) {
  resendInstance = new Resend(process.env.RESEND_API_KEY);
  console.log("[RESEND] API Client initialized.");
} else {
  console.log("[RESEND WARNING] RESEND_API_KEY variable is absent. Mail delivery will run in [SIMULATION MODE].");
}

/**
 * Extract Cloudinary resource public_id and type from standard URL
 */
export function extractPublicIdFromUrl(url: string): { public_id: string; resource_type: string } | null {
  try {
    if (!url || !url.includes("res.cloudinary.com")) return null;

    const parts = url.split("/");
    const uploadIndex = parts.indexOf("upload");
    if (uploadIndex === -1) return null;

    const resource_type = parts[uploadIndex - 1] || "image";
    const remainingParts = parts.slice(uploadIndex + 1);

    // Filter out version prefix e.g. "v171458925" or transformations
    if (remainingParts[0] && (/^v\d+$/.test(remainingParts[0]) || remainingParts[0].includes(","))) {
      remainingParts.shift();
    }
    // Transform options sometimes occupy multiple parts (e.g. /upload/w_400,c_limit/v1234/...)
    if (remainingParts[0] && /^v\d+$/.test(remainingParts[0])) {
      remainingParts.shift();
    }

    const pathWithExtension = remainingParts.join("/");
    const lastDotIndex = pathWithExtension.lastIndexOf(".");
    const public_id = lastDotIndex !== -1 ? pathWithExtension.substring(0, lastDotIndex) : pathWithExtension;

    return { public_id, resource_type };
  } catch (err) {
    console.error("[CLOUDINARY PARSE ERROR] Could not extract public_id:", err);
    return null;
  }
}

/**
 * Upload Base64 or binary data directly to Cloudinary
 */
export async function uploadToCloudinary(base64Data: string, filename: string, folderName: string = "projectflow"): Promise<{ url: string; public_id?: string; simulated?: boolean }> {
  if (!isCloudinaryConfigured) {
    console.log("[CLOUDINARY SIMULATION] Mock-uploading file:", filename);
    // Fall back to returning the base64 or a local placeholder
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename);
    const mockUrl = isImage 
      ? "https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&q=80&w=600" 
      : "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    return { url: mockUrl, simulated: true };
  }

  try {
    // Cloudinary uploader handles base64 directly (e.g. data:image/png;base64,iVBORw0KGgo...)
    const isRawFile = !/\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic)$/i.test(filename);
    
    const uploadOptions: any = {
      folder: folderName,
      public_id: filename.substring(0, filename.lastIndexOf(".")) || filename,
      overwrite: true,
      resource_type: isRawFile ? "raw" : "auto"
    };

    const result = await cloudinary.uploader.upload(base64Data, uploadOptions);
    console.log("[CLOUDINARY SUCCESS] File uploaded:", result.secure_url);
    return { url: result.secure_url, public_id: result.public_id };
  } catch (error: any) {
    console.error("[CLOUDINARY UPLOAD ERROR] Code failed to upload:", error.message || error);
    throw new Error(`Cloudinary upload failed: ${error.message || error}`);
  }
}

/**
 * Delete a file or asset from Cloudinary by parsing its URL
 */
export async function deleteFromCloudinary(url: string): Promise<boolean> {
  const meta = extractPublicIdFromUrl(url);
  if (!meta) {
    console.log("[CLOUDINARY BYPASS] Non-Cloudinary or invalid URL skipped:", url);
    return false;
  }

  if (!isCloudinaryConfigured) {
    console.log("[CLOUDINARY SIMULATION] Mock-deleting resource:", meta.public_id);
    return true;
  }

  try {
    const result = await cloudinary.uploader.destroy(meta.public_id, {
      resource_type: meta.resource_type
    });
    console.log(`[CLOUDINARY SUCCESS] Deleted "${meta.public_id}" (${meta.resource_type}) result:`, result);
    return result.result === "ok";
  } catch (err: any) {
    console.error(`[CLOUDINARY DELETE ERROR] Failed to clean up "${meta.public_id}":`, err.message || err);
    return false;
  }
}

/**
 * Generic email delivering handler using Resend
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }): Promise<{ success: boolean; data?: any; error?: string; simulated?: boolean }> {
  if (!resendInstance) {
    console.log(`\n========================================\n[RESEND SIMULATION] Mail to: ${to}\nSubject: ${subject}\nBody preview:\n${html.substring(0, 400)}...\n========================================\n`);
    return { success: true, simulated: true };
  }

  try {
    const data = await resendInstance.emails.send({
      from: "ProjectFlow <onboarding@resend.dev>",
      to,
      subject,
      html
    });
    console.log(`[RESEND] Email status: Delivered to ${to}. ID:`, data);
    return { success: true, data };
  } catch (error: any) {
    console.error(`[RESEND ERROR] Failed to forward email to ${to}:`, error.message || error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Generates and ships a beautiful, professional, standardized notification email
 */
export async function deliverFormattedNotification({
  recipientName,
  recipientEmail,
  subject,
  heading,
  message,
  actionLabel,
  actionUrl,
  metaDetails
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

  const metaRowsHtml = metaDetails && metaDetails.length > 0 
    ? `<div style="background-color: #f1f5f9; padding: 14px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; font-family: monospace;">
        ${metaDetails.map(item => `<div style="margin-bottom: 6px;"><strong style="color: #475569;">${item.label}:</strong> <span style="color: #0f172a;">${item.value}</span></div>`).join("")}
       </div>`
    : "";

  const actionButtonHtml = actionUrl && actionLabel
    ? `<div style="text-align: center; margin: 28px 0;">
        <a href="${actionUrl}" style="background-color: #0d9488; color: #ffffff; padding: 12px 24px; font-size: 14px; font-weight: bold; border-radius: 6px; text-decoration: none; display: inline-block;">
          ${actionLabel}
        </a>
       </div>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 24px; margin: 0;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          <!-- Corporate polished banner in deep violet -->
          <div style="background-color: #3d1a6e; padding: 32px 24px; text-align: center; color: #ffffff;">
            <div style="font-size: 24px; font-weight: bold; letter-spacing: -0.025em; margin: 0;">ProjectFlow</div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: #0d9488; font-weight: 700; margin-top: 4px;">Collaborate Professionally</div>
          </div>
          <!-- Body Content -->
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #334155; margin-top: 0;">Hello <strong>${recipientName}</strong>,</p>
            <h2 style="font-size: 18px; color: #0f172a; font-weight: 700; margin: 16px 0 12px 0;">${heading}</h2>
            <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">${message}</p>
            
            ${metaRowsHtml}
            ${actionButtonHtml}

            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 28px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center; margin: 0; line-height: 1.4;">
              You received this automated alert because you are registered under the workspace roster on ProjectFlow.<br/>
              © 2026 ProjectFlow - Hosted on secure workspace server.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  const status = await sendEmail({ to: recipientEmail, subject, html });
  return status.success;
}
