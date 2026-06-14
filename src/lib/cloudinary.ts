import { v2 as cloudinary } from "cloudinary";

let cloudinaryInitialized = false;

function initCloudinary(): void {
  if (cloudinaryInitialized) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
    );
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });

  cloudinaryInitialized = true;
}

export type CloudinaryUploadResult = {
  publicId: string;
  url: string;
  secureUrl: string;
  format: string;
  bytes: number;
};

export async function uploadFromBuffer(
  buffer: Buffer,
  options: {
    folder?: string;
    publicId?: string;
    resourceType?: "image" | "raw" | "auto";
  } = {},
): Promise<CloudinaryUploadResult> {
  initCloudinary();

  const base64 = buffer.toString("base64");
  const dataUri = `data:${options.resourceType ?? "auto"};base64,${base64}`;

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: options.resourceType ?? "auto",
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload returned no result"));
          return;
        }
        resolve({
          publicId: result.public_id,
          url: result.url,
          secureUrl: result.secure_url,
          format: result.format,
          bytes: result.bytes,
        });
      },
    );
  });
}

export async function deleteByPublicId(
  publicId: string,
  resourceType: "image" | "raw" = "image",
): Promise<boolean> {
  initCloudinary();

  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(
      publicId,
      { resource_type: resourceType },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result.result === "ok");
      },
    );
  });
}

/**
 * Extract the public_id from a Cloudinary URL.
 * Cloudinary URLs follow the pattern:
 * https://res.cloudinary.com/<cloud>/image/upload/v<version>/<public_id>.<ext>
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;

    // Match the pattern: /<cloud_name>/<resource_type>/upload/v<version>/<path>
    // The public_id is everything after the version segment, without the extension
    const match = pathname.match(/\/upload\/v\d+\/(.+)\.\w+$/);
    if (match) {
      return match[1]!;
    }

    // Fallback: try without version (rare)
    const matchNoVersion = pathname.match(/\/upload\/(.+)\.\w+$/);
    if (matchNoVersion) {
      return matchNoVersion[1]!;
    }

    return null;
  } catch {
    return null;
  }
}
