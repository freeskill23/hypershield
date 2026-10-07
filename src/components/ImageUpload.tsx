import { useRef, useState } from 'react';
import { Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { adminSupabase, isAdminSupabaseConfigured } from '../lib/adminSupabase';

interface Props {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  bucket?: string;
  folder?: string;
  className?: string;
}

export default function ImageUpload({ value, onChange, label, bucket = 'product-images', folder = 'products', className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('이미지 크기는 5MB 이하여야 합니다.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const client = isAdminSupabaseConfigured ? adminSupabase : supabase;
      if (!client) throw new Error('업로드를 위한 연결이 없습니다.');
      const { error: uploadError } = await client.storage.from(bucket).upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = client.storage.from(bucket).getPublicUrl(fileName);
      if (urlData?.publicUrl) {
        onChange(urlData.publicUrl);
      }
    } catch (err: any) {
      setError(err.message || '이미지 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className={className}>
      {label && <label className="mb-1.5 block text-xs font-medium text-slate-400">{label}</label>}
      <div className="flex items-start gap-3">
        <div
          onClick={() => inputRef.current?.click()}
          className="relative grid h-24 w-24 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-navy-700 transition hover:border-cyan"
        >
          {value ? (
            <>
              <img src={value} alt="" className="h-full w-full object-cover" />
              <div className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition hover:opacity-100">
                <Upload className="h-5 w-5 text-white" />
              </div>
            </>
          ) : (
            <div className="grid place-items-center text-slate-600">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImageIcon className="h-6 w-6" />}
            </div>
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn-ghost px-3 py-2 text-xs"
            >
              {uploading ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> 업로드 중...</>
              ) : (
                <><Upload className="h-3.5 w-3.5" /> 이미지 선택</>
              )}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-slate-500 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {value && (
            <input
              type="url"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="이미지 URL (또는 업로드)"
              className="input-field text-xs"
            />
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      </div>
    </div>
  );
}
