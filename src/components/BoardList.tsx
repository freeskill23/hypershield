import { ArrowLeft, Eye, Lock, Pin, Search } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Post } from '../lib/types';
import { formatDate } from '../lib/format';

interface Props {
  posts: Post[];
  onSelectPost: (postId: string) => void;
  onBack: () => void;
  isAuthenticated: boolean;
}

export default function BoardList({ posts, onSelectPost, onBack, isAuthenticated }: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const visible = posts.filter((p) =>
      p.visibility === 'public' || isAuthenticated,
    );
    if (!search.trim()) return visible;
    return visible.filter((p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.excerpt ?? '').toLowerCase().includes(search.toLowerCase()),
    );
  }, [posts, search, isAuthenticated]);

  const pinned = filtered.filter((p) => p.is_pinned);
  const normal = filtered.filter((p) => !p.is_pinned);

  return (
    <div className="min-h-screen bg-navy-950">
      <header className="sticky top-0 z-40 border-b border-navy-700 bg-navy-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4 md:px-8">
          <button onClick={onBack} className="btn-ghost px-3 py-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> 홈
          </button>
          <div className="font-gothic text-lg font-bold text-slate-100">하이퍼쉴드의 생각</div>
          <div className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 md:px-8">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="글 검색..."
            className="input-field pl-10"
          />
        </div>

        {/* Pinned posts */}
        {pinned.length > 0 && (
          <section className="mb-6">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gold-light">
              <Pin className="h-4 w-4" /> 고정글
            </div>
            <div className="space-y-3">
              {pinned.map((post) => (
                <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Normal posts */}
        <section>
          {pinned.length > 0 && (
            <div className="mb-3 text-sm font-medium text-slate-500">전체 글</div>
          )}
          {normal.length === 0 ? (
            <div className="card-surface grid place-items-center py-16 text-center">
              <p className="text-sm text-slate-500">등록된 글이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {normal.map((post) => (
                <PostCard key={post.id} post={post} onClick={() => onSelectPost(post.id)} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function PostCard({ post, onClick }: { post: Post; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card-surface block w-full p-5 text-left transition hover:border-cyan/40"
    >
      <div className="flex items-center gap-2">
        {post.visibility === 'public' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/5 px-2.5 py-1 text-xs text-cyan">
            <Eye className="h-3 w-3" /> 공개
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-navy-700 bg-navy-900/60 px-2.5 py-1 text-xs text-slate-400">
            <Lock className="h-3 w-3" /> 회원전용
          </span>
        )}
        {post.category && (
          <span className="rounded-full bg-navy-900/60 px-2.5 py-1 text-xs text-slate-500">{post.category}</span>
        )}
        <span className="ml-auto text-xs text-slate-500">{formatDate(post.created_at)}</span>
      </div>
      <h3 className="mt-3 font-gothic text-lg font-semibold text-slate-100 transition group-hover:text-cyan">
        {post.title}
      </h3>
      {post.excerpt && (
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{post.excerpt}</p>
      )}
    </button>
  );
}
