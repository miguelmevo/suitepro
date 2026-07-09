import { supabase } from "@/integrations/supabase/client";

/**
 * Generate a short-lived signed URL for a programa PDF.
 * The `programas-pdf` bucket is private — never share `pdf_url` directly.
 */
export async function getProgramaPdfSignedUrl(
  pdfPath: string,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (!pdfPath) return null;
  const { data, error } = await supabase.storage
    .from("programas-pdf")
    .createSignedUrl(pdfPath, expiresInSeconds);
  if (error) {
    console.error("Error creating signed URL for PDF:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
