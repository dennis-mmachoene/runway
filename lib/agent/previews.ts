import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtractionProposal } from '@/lib/db/types';

export interface DocPreview {
  url: string;
  mime: string | null;
  name: string | null;
  isImage: boolean;
}

/**
 * Build short-lived signed URLs for the documents behind a set of proposals.
 * The 'documents' bucket is private, so the inbox can only show a thumbnail via
 * a signed URL. Returns a map keyed by proposal id; missing/expired/unstored
 * docs are simply absent (the UI falls back to no preview).
 */
export async function signedPreviews(
  supabase: SupabaseClient,
  proposals: ExtractionProposal[],
): Promise<Record<string, DocPreview>> {
  const withDoc = proposals.filter((p) => p.document_id);
  if (!withDoc.length) return {};

  const docIds = Array.from(new Set(withDoc.map((p) => p.document_id as string)));
  const { data } = await supabase
    .from('documents')
    .select('id, storage_path, mime, original_name')
    .in('id', docIds);
  const docs =
    (data as { id: string; storage_path: string | null; mime: string | null; original_name: string | null }[]) ?? [];
  const byId = new Map(docs.map((d) => [d.id, d]));

  const out: Record<string, DocPreview> = {};
  await Promise.all(
    withDoc.map(async (p) => {
      const d = byId.get(p.document_id as string);
      if (!d?.storage_path) return;
      const { data: signed } = await supabase.storage
        .from('documents')
        .createSignedUrl(d.storage_path, 600); // 10 minutes
      if (signed?.signedUrl) {
        out[p.id] = {
          url: signed.signedUrl,
          mime: d.mime,
          name: d.original_name,
          isImage: !!d.mime && d.mime.startsWith('image/'),
        };
      }
    }),
  );
  return out;
}
