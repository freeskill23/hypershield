import { Megaphone, TrendingDown, Sparkles, Shield, ArrowRight, Eye, Users, Flame, Ban } from 'lucide-react';
import { usePosts, useSettings, getSettingValue } from '../lib/data';
import { formatDate } from '../lib/format';

interface Props {
  onEnter: () => void;
  onViewBoard: () => void;
  onViewPost: (postId: string) => void;
}

export default function LandingPage({ onEnter, onViewBoard, onViewPost }: Props) {
  const { items: posts } = usePosts(true);
  const { items: settings } = useSettings(true);

  const recruitmentOpen = getSettingValue(settings, 'recruitment_open') !== 'false';
  const recruitmentLimit = parseInt(getSettingValue(settings, 'recruitment_limit') ?? '500', 10);
  const recruitmentBatch = getSettingValue(settings, 'recruitment_batch') ?? '1';

  const publicPosts = posts
    .filter((p) => p.visibility === 'public')
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-navy-950">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-cyan/10 blur-3xl" />
          <div className="absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-28">
          {/* Brand */}
          <div className="mb-8 text-center">
            <div className="mb-2 text-sm font-medium uppercase tracking-[0.3em] text-slate-500">
              HYPERSHIELD
            </div>
            <h2 className="font-gothic text-3xl font-bold text-slate-600 md:text-4xl">
              하이퍼쉴드 멤버쉽
            </h2>
          </div>

          {/* Catchphrase badge */}
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-cyan/30 bg-cyan/5 px-5 py-2 text-sm font-medium text-cyan">
            <Megaphone className="h-4 w-4" />
            온라인 광고 보이콧 선언!
          </div>

          {/* Main title */}
          <h1 className="text-center font-gothic text-3xl font-bold leading-tight text-slate-800 md:text-5xl">
            제품에 광고비와 마진을 뺐습니다.
            <br />
            <span className="text-cyan">멤버쉽 회원은 기본 50% 할인 혜택</span>
          </h1>

          {/* Description */}
          <p className="mx-auto mt-6 max-w-2xl text-center text-base leading-relaxed text-slate-400 md:text-lg">
            하이퍼쉴드는 제품가격에서 불필요하게 높은 광고비를 빼고 더 저렴한 판매가로 공급하기 위해 멤버쉽몰을 운영하게 되었습니다.
            <br />
            멤버쉽몰은 회원제 구독몰로 기존 판매가 대비 최소 50% 이상 저렴하게 구매할 수 있습니다.
          </p>

          {/* Early bird recruitment */}
          <div className="mx-auto mt-8 max-w-md">
            {recruitmentOpen ? (
              <div className="relative overflow-hidden rounded-xl border border-gold/40 bg-gold/10 p-5 text-center">
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-gold/20 blur-2xl" />
                <div className="relative">
                  <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-gold-light">
                    <Flame className="h-4 w-4" />
                    {recruitmentBatch}차 구독자 모집
                  </div>
                  <div className="font-gothic text-2xl font-bold text-slate-800">
                    선착순 {recruitmentLimit}명
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    제품 공급량 조절을 위해 구독자를 제한합니다
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center">
                <div className="relative">
                  <div className="mb-2 flex items-center justify-center gap-2 text-sm font-bold text-red-400">
                    <Ban className="h-4 w-4" />
                    모집 마감
                  </div>
                  <div className="font-gothic text-xl font-bold text-slate-600">
                    {recruitmentBatch}차 구독자 모집이 마감되었습니다
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    다음 모집 시작 전까지 대기해 주세요
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <button onClick={onEnter} className="btn-primary px-6 py-3 text-base">
              입장하기 <ArrowRight className="h-5 w-5" />
            </button>
            <button onClick={onViewBoard} className="btn-ghost px-6 py-3 text-base">
              하이퍼쉴드의 생각
            </button>
          </div>
        </div>
      </div>

      {/* Value props */}
      <div className="mx-auto max-w-5xl px-6 py-16 md:px-8">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="card-surface p-6">
            <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-cyan/10">
              <TrendingDown className="h-6 w-6 text-cyan" />
            </div>
            <h3 className="font-gothic text-lg font-semibold text-slate-800">최소 50% 할인</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              제품가격에 높은 광고비를 빼고, 그 비용을 멤버쉽 혜택에 반영합니다. 회원제 구독으로 기존 판매가 대비 최소 50% 이상 저렴하게 구매할 수 있습니다.
            </p>
          </div>

          <div className="card-surface p-6">
            <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-gold/10">
              <Sparkles className="h-6 w-6 text-gold" />
            </div>
            <h3 className="font-gothic text-lg font-semibold text-slate-800">더 좋은 품질</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              과도하게 높은 광고비용을 빼고 더 좋은 품질을 만드는 연구비용으로 활용하고 더 좋은 제품을 더 저렴하게 공급하겠습니다.
            </p>
          </div>

          <div className="card-surface p-6">
            <div className="mb-4 inline-grid h-12 w-12 place-items-center rounded-xl bg-cyan/10">
              <Shield className="h-6 w-6 text-cyan" />
            </div>
            <h3 className="font-gothic text-lg font-semibold text-slate-800">회원제 쇼핑몰</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              구독 결제가 완료된 회원만 쇼핑몰을 이용할 수 있습니다.
              정기결제로 매월 자동 갱신됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Early bird banner */}
      {recruitmentOpen && (
        <div className="mx-auto max-w-5xl px-6 pb-8 md:px-8">
          <div className="relative overflow-hidden rounded-xl border border-gold/30 bg-gradient-to-r from-navy-900 via-navy-850 to-navy-900 p-6 md:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4 text-center md:flex-row md:justify-between md:text-left">
              <div className="flex items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gold/20">
                  <Users className="h-7 w-7 text-gold" />
                </div>
                <div>
                  <div className="font-gothic text-lg font-bold text-slate-800">
                    {recruitmentBatch}차 구독자 선착순 {recruitmentLimit}명 모집
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    제품 공급량 조절을 위해 구독자를 제한합니다. 한정 인원으로 조기 마감될 수 있습니다.
                  </p>
                </div>
              </div>
              <button onClick={onEnter} className="btn-gold px-6 py-3 text-sm whitespace-nowrap">
                지금 가입하기 <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Public posts preview */}
      {publicPosts.length > 0 && (
        <div className="mx-auto max-w-5xl px-6 py-16 md:px-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-gothic text-2xl font-bold text-slate-800">하이퍼쉴드의 생각</h2>
              <p className="mt-1 text-sm text-slate-500">광고비 zero, 품질 up</p>
            </div>
            <button onClick={onViewBoard} className="btn-ghost px-4 py-2 text-sm">
              전체 보기 <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {publicPosts.map((post) => (
              <button
                key={post.id}
                onClick={() => onViewPost(post.id)}
                className="card-surface block w-full p-5 text-left transition hover:border-cyan/40"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan/30 bg-cyan/5 px-2.5 py-1 text-xs text-cyan">
                    <Eye className="h-3 w-3" /> 공개
                  </div>
                  {post.is_pinned && (
                    <span className="rounded-full bg-gold/20 px-2 py-1 text-xs text-gold-light">고정</span>
                  )}
                  <span className="text-xs text-slate-500">{formatDate(post.created_at)}</span>
                </div>
                <h3 className="mt-3 font-gothic text-lg font-semibold text-slate-800">{post.title}</h3>
                {post.excerpt && (
                  <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-400">{post.excerpt}</p>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="mx-auto max-w-5xl px-6 py-20 md:px-8">
        <div className="card-surface relative overflow-hidden p-10 text-center">
          <div className="pointer-events-none absolute -top-16 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-cyan/10 blur-3xl" />
          <div className="relative">
            <h2 className="font-gothic text-2xl font-bold text-slate-800 md:text-3xl">
              하이퍼쉴드 멤버쉽
            </h2>
            <p className="mt-3 text-sm text-slate-400 md:text-base">
              제품에 광고비와 마진을 뺐습니다. 멤버쉽 회원은 기본 50% 할인 혜택.
            </p>
            <button onClick={onEnter} className="btn-primary mt-6 px-8 py-3 text-base">
              입장하기 <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <footer className="border-t border-navy-700 px-6 py-6 text-center text-xs text-slate-600 md:px-8">
        <div className="flex items-center justify-center gap-4">
          <span>© {new Date().getFullYear()} Hypershield · 하이퍼쉴드 멤버쉽</span>
          <a href="#admin" className="text-slate-700 transition hover:text-slate-500">관리자</a>
        </div>
      </footer>
    </div>
  );
}
