import { requireOwner } from '@/lib/auth/owner';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function detectImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  // PNG
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  // JPEG
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // GIF
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif';
  // WEBP (RIFF....WEBP)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireOwner();
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return Response.json({ error: 'Chưa chọn tệp ảnh' }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_BYTES) {
      return Response.json({ error: 'Ảnh phải nhỏ hơn 2MB' }, { status: 400 });
    }
    const buffer = new Uint8Array(await file.arrayBuffer());
    const detected = detectImageMime(buffer);
    if (!detected || !ALLOWED_TYPES.has(detected)) {
      return Response.json({ error: 'Chỉ hỗ trợ ảnh PNG, JPG, WebP hoặc GIF hợp lệ' }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const filename = (file.name || 'image').replace(/[^\w.\- ]+/g, '_').slice(0, 180) || 'image';
    const dataBase64 = Buffer.from(buffer).toString('base64');
    const result = await supabase.from('media_assets').insert({
      id,
      user_id: user.id,
      filename,
      mime_type: detected,
      size_bytes: buffer.byteLength,
      data_base64: dataBase64,
    });
    if (result.error) {
      return Response.json({ error: result.error.message }, { status: 500 });
    }
    return Response.json({ id, url: `/api/uploads/image/${id}` }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Không thể tải ảnh lên' }, { status: 401 });
  }
}
