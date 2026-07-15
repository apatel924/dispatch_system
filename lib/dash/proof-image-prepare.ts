/**
 * Client-side proof image preparation before upload.
 * Resizes, corrects orientation, and compresses photographic proofs.
 * Signatures are lightly bounded but not aggressively compressed.
 */

export type ClientProofType = "signature" | "exteriorPhoto" | "idVerification";

export interface ProofPrepareSettings {
  maxDimension: number;
  quality: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
}

/** Separate tuning per proof category. */
export const PROOF_PREPARE_SETTINGS: Record<ClientProofType, ProofPrepareSettings> = {
  idVerification: {
    maxDimension: 2048,
    quality: 0.85,
    mimeType: "image/jpeg",
  },
  exteriorPhoto: {
    maxDimension: 1920,
    quality: 0.82,
    mimeType: "image/jpeg",
  },
  signature: {
    maxDimension: 1600,
    quality: 0.92,
    mimeType: "image/png",
  },
};

/** Client soft ceiling aligned with server type limits (decoded-byte estimate). */
export const CLIENT_PROOF_MAX_BYTES: Record<ClientProofType, number> = {
  signature: 1_048_576,
  exteriorPhoto: 2_621_440,
  idVerification: 2_621_440,
};

/** Alias for house/location/drop-off photos (same as exterior). */
export const LOCATION_PHOTO_SETTINGS = PROOF_PREPARE_SETTINGS.exteriorPhoto;
export const DROP_OFF_PHOTO_SETTINGS = PROOF_PREPARE_SETTINGS.exteriorPhoto;

export interface PreparedProofImage {
  dataUrl: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}

export function formatProofByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const base64 = dataUrl.slice(comma + 1);
  return Math.floor((base64.length * 3) / 4);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    img.src = url;
  });
}

function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = dataUrl;
  });
}

async function loadBitmapFromFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to Image element (browser may still apply EXIF on decode).
    }
  }
  return loadImageFromFile(file);
}

function scaledDimensions(
  width: number,
  height: number,
  maxDimension: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension) return { width, height };
  const scale = maxDimension / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function drawToCanvas(
  source: CanvasImageSource & { width: number; height: number },
  settings: ProofPrepareSettings,
): PreparedProofImage {
  const { width, height } = scaledDimensions(
    source.width,
    source.height,
    settings.maxDimension,
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(source, 0, 0, width, height);

  const dataUrl =
    settings.mimeType === "image/png"
      ? canvas.toDataURL(settings.mimeType)
      : canvas.toDataURL(settings.mimeType, settings.quality);

  const prepared: PreparedProofImage = {
    dataUrl,
    mimeType: settings.mimeType,
    byteSize: estimateDataUrlBytes(dataUrl),
    width,
    height,
  };

  return prepared;
}

function assertPreparedWithinClientLimit(
  prepared: PreparedProofImage,
  proofType: ClientProofType,
): PreparedProofImage {
  const maxBytes = CLIENT_PROOF_MAX_BYTES[proofType];
  if (prepared.byteSize > maxBytes) {
    throw new Error(
      proofType === "signature"
        ? "Signature image is too large. Please clear and sign again."
        : "Photo is still too large after compression. Please retake closer or at lower resolution.",
    );
  }
  return prepared;
}

/** Prepare a camera/gallery file for upload. Applies EXIF orientation and resize. */
export async function prepareProofPhoto(
  file: File,
  proofType: Exclude<ClientProofType, "signature">,
): Promise<PreparedProofImage> {
  const settings = PROOF_PREPARE_SETTINGS[proofType];
  const source = await loadBitmapFromFile(file);
  try {
    return assertPreparedWithinClientLimit(drawToCanvas(source, settings), proofType);
  } finally {
    if ("close" in source && typeof source.close === "function") {
      source.close();
    }
  }
}

/** Prepare a signature canvas export (light resize only; keeps PNG). */
export async function prepareProofSignature(dataUrl: string): Promise<PreparedProofImage> {
  const settings = PROOF_PREPARE_SETTINGS.signature;
  const img = await loadImageFromDataUrl(dataUrl);
  return assertPreparedWithinClientLimit(drawToCanvas(img, settings), "signature");
}

/** Unified entry point for proof preparation. */
export async function prepareProofImage(
  source: File | string,
  proofType: ClientProofType,
): Promise<PreparedProofImage> {
  if (proofType === "signature") {
    if (typeof source !== "string") {
      throw new Error("Signature preparation requires a data URL");
    }
    return prepareProofSignature(source);
  }
  if (typeof source === "string") {
    throw new Error("Photo preparation requires a File");
  }
  return prepareProofPhoto(source, proofType);
}
