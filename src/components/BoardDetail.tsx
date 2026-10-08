import { ArrowLeft, Eye, Lock, Pin, ArrowRight } from 'lucide-react';
import { Post } from '../lib/types';
import { formatDateTime } from '../lib/format';

interface Props {
  post: Post | null;
  onBack: () => void;
  onEnter?: () => void;
  isAuthenticated: boolean;
}

export default function BoardDetail({ post, onBack, onEnter, isAuthenticated }: Props) {
  if (!post) {
    return (
      <div className="min-h-screen bg-navy-950">
        <header className="border-b border-navy-700 bg-navy-950/80">
          <div className="mx-auto flex max-w-3xl items-center px-5 py-4 md:px-8">
            <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
              <ArrowLeft className="h-4 w-4" /> 목록
            </button>
          </div>
        </header>
        <div className="grid place-items-center py-20 text-slate-500">
          <p>글을 찾을 수 없습니다.</p>
        </div>
      </div>
    );
  }

  const isLocked = post.visibility === 'members' && !isAuthenticated;

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> 목록
          </button>
          <div className="font-gothic text-sm font-medium text-slate-400">하이퍼쉴드의 생각</div>
          <div className="w-20" />
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-5 py-8 md:px-8">
        {/* Meta */}
        <div className="flex flex-wrap items-center gap-2">
          {post.visibility === 'public' ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/5 px-2.5 py-1 text-xs text-cyan">
              <Eye className="h-3 w-3" /> 공개
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-slate-100 px-2.5 py-1 text-xs text-slate-400">
              <Lock className="h-3 w-3" /> 회원전용
            </span>
          )}
          {post.is_pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2.5 py-1 text-xs text-gold-light">
              <Pin className="h-3 w-3" /> 고정
            </span>
          )}
          {post.category && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{post.category}</span>
          )}
          <span className="ml-auto text-xs text-slate-500">{formatDateTime(post.created_at)}</span>
        </div>

        {/* Title */}
        <h1 className="mt-4 font-gothic text-3xl font-bold leading-tight text-slate-800">{post.title}</h1>

        {/* Content */}
        {isLocked ? (
          <div className="mt-8 card-surface grid place-items-center py-16 text-center">
            <Lock className="mb-4 h-12 w-12 text-slate-600" />
            <p className="text-sm text-slate-400">이 글은 회원 전용입니다.</p>
            <p className="mt-1 text-xs text-slate-500">로그인 후 구독 결제 시 모든 글을 볼 수 있습니다.</p>
            {onEnter && (
              <button onClick={onEnter} className="btn-primary mt-5 px-5 py-2.5 text-sm">
                로그인하기 <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div
            className="rich-editor mt-6 text-base leading-relaxed text-slate-600"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        )}
      </article>
    </div>
  );
}
