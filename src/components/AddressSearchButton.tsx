import { useRef, useState } from 'react';
import { Search, Edit3, X } from 'lucide-react';

declare global {
  interface Window {
    daum?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadDaumPostcode(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.daum?.Postcode) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = () => {
      if (window.daum?.Postcode) {
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (window.daum?.Postcode) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        setTimeout(() => {
          clearInterval(checkInterval);
          scriptPromise = null;
          reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
        }, 5000);
      }
    };
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface Props {
  onSelect: (address: string) => void;
  disabled?: boolean;
}

export default function AddressSearchButton({ onSelect, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showManual, setShowManual] = useState(false);
  const [manualAddr, setManualAddr] = useState('');

  async function handleSearch() {
    try {
      await loadDaumPostcode();
      if (!containerRef.current) return;
      containerRef.current.innerHTML = '';
      const postcode = new window.daum.Postcode({
        oncomplete: (data: any) => {
          let addr = '';
          if (data.userSelectedType === 'R') {
            addr = data.roadAddress;
          } else {
            addr = data.jibunAddress;
          }
          onSelect(addr);
          if (containerRef.current) containerRef.current.innerHTML = '';
        },
        onclose: () => {
          if (containerRef.current) containerRef.current.innerHTML = '';
        },
        width: '100%',
        height: '100%',
        maxSuggestHeight: 300,
      });
      postcode.embed({
        q: containerRef.current,
        autoClose: true,
      });
    } catch {
      setShowManual(true);
    }
  }

  function handleManualSubmit() {
    const trimmed = manualAddr.trim();
    if (trimmed) {
      onSelect(trimmed);
      setShowManual(false);
      setManualAddr('');
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSearch}
          disabled={disabled}
          className="flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/5 px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
        >
          <Search className="h-4 w-4" /> 도로명 주소 검색
        </button>
      </div>

      {showManual && (
        <div className="mt-2 rounded-lg border border-navy-600 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <Edit3 className="h-4 w-4 text-cyan" /> 주소 직접 입력
            </span>
            <button
              type="button"
              onClick={() => { setShowManual(false); setManualAddr(''); }}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualAddr}
              onChange={(e) => setManualAddr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); } }}
              placeholder="도로명 주소를 입력하세요 (예: 서울특별시 강남구 테헤란로 123)"
              className="flex-1 rounded-lg border border-navy-600 px-3 py-2 text-sm text-slate-800 focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/30"
              autoFocus
            />
            <button
              type="button"
              onClick={handleManualSubmit}
              disabled={!manualAddr.trim()}
              className="rounded-lg bg-cyan px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan/90 disabled:opacity-50"
            >
              확인
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            주소 검색이 불가능한 경우 직접 입력하실 수 있습니다.
          </p>
        </div>
      )}

      <div ref={containerRef} className="w-full" />
    </>
  );
}
