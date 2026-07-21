import { useState } from 'react';
import { Crown, Copy, Check, Shield, Sparkles } from 'lucide-react';
import { Profile } from '../lib/types';

interface Props {
  profile: Profile;
}

export default function MembershipCard({ profile }: Props) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(profile.my_referral_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  const memberNumber = '#' + profile.id.slice(-6).toUpperCase();
  const isAdmin = profile.role === 'admin';

  return (
    <div className="group relative h-56 w-full max-w-sm perspective-[1200px]">
      <div className="relative h-full w-full rounded-2xl bg-vip-card p-6 shadow-card transition-transform duration-500 group-hover:scale-[1.02]">
        {/* Sheen overlay */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-40">
          <div className="absolute -top-20 -right-10 h-40 w-40 rounded-full bg-gold/20 blur-2xl" />
          <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-cyan/20 blur-2xl" />
        </div>

        {/* Top row */}
        <div className="relative flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-gold-light">
              <Crown className="h-3 w-3" />
              {isAdmin ? 'Admin Member' : 'VIP Member'}
            </div>
            <div className="mt-1 font-display text-base font-semibold text-slate-100">
              Hypershield Private Club
            </div>
          </div>
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-gold-sheen text-navy-950 shadow-gold">
            <Shield className="h-4 w-4" strokeWidth={2.5} />
          </div>
        </div>

        {/* Member info */}
        <div className="relative mt-7">
          <div className="text-[10px] uppercase tracking-widest text-slate-400">Member Name</div>
          <div className="font-display text-xl font-semibold text-slate-50">{profile.full_name}</div>
        </div>

        {/* Bottom row */}
        <div className="relative mt-5 flex items-end justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-slate-400">Member No.</div>
            <div className="font-mono text-sm font-medium text-cyan">{memberNumber}</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-slate-400">Tier</div>
            <div className={`text-sm font-semibold ${isAdmin ? 'text-gold-light' : 'text-cyan'}`}>
              {isAdmin ? 'ADMIN' : 'CLUB 50%'}
            </div>
          </div>

          {/* Referral code */}
          <div className="text-right">
            <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-widest text-slate-400">
              <Sparkles className="h-3 w-3 text-gold" /> My Referral Code
            </div>
            <button
              onClick={copyCode}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-sm font-semibold text-gold-light transition hover:bg-gold/20"
            >
              {profile.my_referral_code}
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <div className="mt-1 text-[10px] text-slate-500">
              {copied ? '복사됨!' : '클릭하여 복사'}
            </div>
          </div>
        </div>

        {/* Holographic strip */}
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gradient-to-r from-cyan via-gold to-cyan opacity-70" />
      </div>
    </div>
  );
}
