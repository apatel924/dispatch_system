"use client";

import { getStorage, ref, uploadBytes } from "firebase/storage";
import { getFirebaseApp } from "@/lib/auth/firebase-client";
import { isFirebaseClientConfigured } from "@/lib/auth/config";

function dataUrlToBlob(dataUrl: string): { blob: Blob; mimeType: string } {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("webp")) return "webp";
  return "bin";
}

export async function uploadProofBlob(
  orderId: string,
  proofType: "signature" | "exteriorPhoto",
  dataUrl: string,
): Promise<{ storagePath: string; mimeType: string; fileSizeBytes: number }> {
  if (!isFirebaseClientConfigured()) {
    throw new Error("Firebase Storage is not configured");
  }

  const { blob, mimeType } = dataUrlToBlob(dataUrl);
  const ext = extensionForMime(mimeType);
  const storagePath = `orders/${orderId}/proofs/${proofType}-${Date.now()}.${ext}`;
  const storageRef = ref(getStorage(getFirebaseApp()), storagePath);

  await uploadBytes(storageRef, blob, { contentType: mimeType });

  return { storagePath, mimeType, fileSizeBytes: blob.size };
}
