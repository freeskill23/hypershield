import { useState, useCallback } from 'react';
import {
  MessageSquare, Plus, ArrowLeft, Clock, CheckCircle2, X,
} from 'lucide-react';
import { Inquiry } from '../lib/types';
import { formatDate, formatDateTime } from '../lib/format';
import { createInquiry } from '../lib/data';

interface Props {
  inquiries: Inquiry[];
  userId: string;
  onRefresh: () => void;
}

export default function MyInquiry({ inquiries, userId, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);

  const selected = inquiries.find((i) => i.id === selectedId);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    try {
      await createInquiry(userId, title.trim(), content.trim());
      setTitle('');
      setContent('');
      setShowForm(false);
      onRefresh();
    } finally {
      setBusy(false);
    }
  }, [userId, title, content, onRefresh]);

  if (selected) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedId(null)}
          className="btn-ghost px-4 py-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </button>

        <div className="card-surface p-6">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  selected.status === 'answered'
                    ? 'border-green-500/40 text-green-400 bg-green-500/5'
                    : 'border-gold/40 text-gold-light bg-gold/5'
                }`}>
                  {selected.status === 'answered'
                    ? <><CheckCircle2 className="h-3 w-3" /> 답변완료</>
                    : <><Clock className="h-3 w-3" /> 답변대기</>
                  }
                </span>
                <span className="text-xs text-slate-500">{formatDateTime(selected.created_at)}</span>
              </div>
              <h2 className="mt-3 font-gothic text-lg font-bold text-slate-800">{selected.title}</h2>
            </div>
          </div>

          <div className="rounded-lg border border-navy-700 bg-slate-50 p-4">
            <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{selected.content}</div>
          </div>

          {selected.answer ? (
            <div className="mt-4 rounded-lg border border-cyan/30 bg-cyan/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-cyan">
                <MessageSquare className="h-4 w-4" /> 관리자 답변
                <span className="ml-auto font-normal text-slate-500">{formatDateTime(selected.answered_at ?? selected.updated_at)}</span>
              </div>
              <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{selected.answer}</div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-500">답변 대기 중입니다. 관리자가 곧 답변드릴 예정입니다.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-gothic text-lg font-semibold text-slate-800">1:1 문의 작성</h2>
          <button onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm">
            <X className="h-4 w-4" /> 취소
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card-surface space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">제목</label>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="문의 제목을 입력하세요"
              className="input-field text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">내용</label>
            <textarea
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="문의 내용을 상세히 입력해주세요"
              rows={6}
              className="input-field text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary px-5 py-2.5 text-sm">
              {busy ? '전송 중...' : '문의하기'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost px-5 py-2.5 text-sm">
              취소
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-gothic text-lg font-semibold text-slate-800">1:1 문의</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary px-4 py-2 text-sm">
          <Plus className="h-4 w-4" /> 문의하기
        </button>
      </div>

      {inquiries.length === 0 ? (
        <div className="card-surface grid place-items-center py-16 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm text-slate-500">문의 내역이 없습니다.</p>
          <p className="mt-1 text-xs text-slate-400">궁금한 점이 있으면 문의해주세요.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <button
              key={inquiry.id}
              onClick={() => setSelectedId(inquiry.id)}
              className="card-surface block w-full p-5 text-left transition hover:border-cyan/40"
            >
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                  inquiry.status === 'answered'
                    ? 'border-green-500/40 text-green-400 bg-green-500/5'
                    : 'border-gold/40 text-gold-light bg-gold/5'
                }`}>
                  {inquiry.status === 'answered'
                    ? <><CheckCircle2 className="h-3 w-3" /> 답변완료</>
                    : <><Clock className="h-3 w-3" /> 답변대기</>
                  }
                </span>
                <span className="ml-auto text-xs text-slate-500">{formatDate(inquiry.created_at)}</span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-slate-800">{inquiry.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{inquiry.content}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
