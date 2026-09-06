import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error(
      "S3 is not configured. Set AWS_REGION and S3_DOCUMENTS_BUCKET.",
    );
  }

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  s3Client = new S3Client({
    region,
    ...(accessKeyId && secretAccessKey
      ? { credentials: { accessKeyId, secretAccessKey } }
      : {}),
  });

  return s3Client;
}

export function getDocumentsBucket(): string {
  const bucket = process.env.S3_DOCUMENTS_BUCKET;
  if (!bucket) {
    throw new Error(
      "S3 is not configured. Set S3_DOCUMENTS_BUCKET.",
    );
  }
  return bucket;
}

export function getDocumentsPrefix(): string {
  return (
    process.env.S3_DOCUMENTS_PREFIX ??
    process.env.S3_DOCUMENTS_FOLDER ??
    "sst-hostel-leave-documents"
  );
}

export function getPresignedUrlExpiresIn(): number {
  const raw = process.env.S3_PRESIGNED_URL_EXPIRES_IN;
  const parsed = raw ? Number.parseInt(raw, 10) : 3600;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3600;
}

export type S3UploadResult = {
  key: string;
  url: string;
  bytes: number;
};

/**
 * Canonical (non-signed) virtual-hosted URL persisted as `fileUrl`.
 * The bucket stays private — readers get a time-limited presigned URL
 * derived from the stored key at read time.
 */
export function buildCanonicalUrl(
  bucket: string,
  region: string,
  key: string,
): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

export async function uploadFromBuffer(
  buffer: Buffer,
  options: {
    key?: string;
    contentType?: string;
  } = {},
): Promise<S3UploadResult> {
  const client = getS3Client();
  const bucket = getDocumentsBucket();
  const region = process.env.AWS_REGION as string;

  const key = options.key ?? `${getDocumentsPrefix()}/${crypto.randomUUID()}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: options.contentType ?? "application/octet-stream",
      ContentLength: buffer.length,
      ServerSideEncryption: "AES256",
    }),
  );

  return {
    key,
    url: buildCanonicalUrl(bucket, region, key),
    bytes: buffer.length,
  };
}

export async function getPresignedGetUrl(
  key: string,
  expiresInSeconds: number = getPresignedUrlExpiresIn(),
): Promise<string> {
  const client = getS3Client();
  const bucket = getDocumentsBucket();

  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/**
 * S3 deletes are idempotent: deleting a missing key still returns success,
 * so `true` means "no object remains" (deleted or never existed).
 */
export async function deleteByKey(key: string): Promise<boolean> {
  const client = getS3Client();
  const bucket = getDocumentsBucket();

  await client.send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key }),
  );
  return true;
}

/**
 * Resolve the S3 object key for a document row. New rows store
 * `metadata.s3Key`; otherwise fall back to parsing `fileUrl`.
 */
export function getS3KeyFromMetadata(
  metadata: unknown,
): string | null {
  if (metadata && typeof metadata === "object" && "s3Key" in metadata) {
    const key = (metadata as { s3Key?: unknown }).s3Key;
    return typeof key === "string" && key.length > 0 ? key : null;
  }
  return null;
}

/**
 * Extract the object key from an S3 URL. Handles:
 * - s3://<bucket>/<key>
 * - https://<bucket>.s3.<region>.amazonaws.com/<key>
 * - https://s3.<region>.amazonaws.com/<bucket>/<key>
 * Returns null for non-S3 URLs (e.g. legacy Cloudinary URLs).
 */
export function extractKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    if (url.startsWith("s3://")) {
      const withoutScheme = url.slice("s3://".length);
      const slash = withoutScheme.indexOf("/");
      if (slash === -1) return null;
      return withoutScheme.slice(slash + 1) || null;
    }

    const parsed = new URL(url);
    const host = parsed.hostname;

    const virtualHosted = host.match(/^(.+)\.s3[.-][a-z0-9-]+\.amazonaws\.com$/);
    if (virtualHosted) {
      return parsed.pathname.replace(/^\/+/, "") || null;
    }

    const pathStyle = host.match(/^s3[.-][a-z0-9-]+\.amazonaws\.com$/);
    if (pathStyle) {
      // /<bucket>/<key>
      const parts = parsed.pathname.replace(/^\/+/, "").split("/");
      if (parts.length < 2) return null;
      return parts.slice(1).join("/") || null;
    }

    return null;
  } catch {
    return null;
  }
}

/** Test-only: reset the cached client between tests. */
export function __resetS3ClientForTests(): void {
  s3Client = null;
}
