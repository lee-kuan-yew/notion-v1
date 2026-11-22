import { z } from 'zod';
import { requireOwner } from '@/lib/auth/owner';

const idSchema = z.uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) return new Response('Not found', { status: 404 });
    const { supabase, user } = await requireOwner();
    const result = await supabase
      .from('media_assets')
      .select('mime_type,data_base64')
      .eq('id', parsed.data)
      .eq('user_id', user.id)
      .single();
    if (result.error || !result.data) return new Response('Not found', { status: 404 });
    const bytes = Buffer.from(result.data.data_base64, 'base64');
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': result.data.mime_type,
        'Content-Length': String(bytes.byteLength),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch {
    return new Response('Unauthorized', { status: 401 });
  }
}
