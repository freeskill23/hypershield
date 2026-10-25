import { supabase } from './supabase';

const SESSION_KEY = 'analytics_session_id';
const LAST_LOG_KEY = 'analytics_last_log';
const LOG_INTERVAL_MS = 30_000;

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

function extractSearchKeyword(referrer: string): string | null {
  try {
    const url = new URL(referrer);
    const host = url.hostname;
    const params = url.searchParams;

    const searchEngines: Record<string, string[]> = {
      'google.': ['q', 'query'],
      'naver.': ['query'],
      'daum.': ['q'],
      'bing.': ['q'],
      'yahoo.': ['p'],
      'baidu.': ['wd', 'word'],
      'duckduckgo.': ['q'],
    };

    for (const [domain, keys] of Object.entries(searchEngines)) {
      if (host.includes(domain)) {
        for (const key of keys) {
          const val = params.get(key);
          if (val) return val;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

let lastLoggedPath = '';
let lastLoggedTime = 0;

export async function logPageView(path: string): Promise<void> {
  const now = Date.now();
  if (path === lastLoggedPath && now - lastLoggedTime < LOG_INTERVAL_MS) return;
  lastLoggedPath = path;
  lastLoggedTime = now;

  try {
    let referrer = '';
    try {
      referrer = document.referrer || '';
    } catch {
      referrer = '';
    }

    const searchKeyword = referrer ? extractSearchKeyword(referrer) : null;

    let userAgent = '';
    try {
      userAgent = navigator.userAgent || '';
    } catch {
      userAgent = '';
    }

    await supabase.from('visitor_logs').insert({
      session_id: getSessionId(),
      path,
      referrer: referrer || null,
      search_keyword: searchKeyword,
      user_agent: userAgent || null,
      is_mobile: isMobile(),
    });
  } catch {
  }
}
