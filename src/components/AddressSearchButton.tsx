import { useRef } from 'react';
import { Search } from 'lucide-react';

declare global {
  interface Window {
    daum?: any;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadDaumPostcode(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.daum?.Postcode) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://t1.daumcdn.net/map/jsapi/postcode/v2/postcode.v2.js';
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('주소 검색 스크립트를 불러오지 못했습니다.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

let containerIdCounter = 0;

interface Props {
  onSelect: (address: string) => void;
  disabled?: boolean;
}

export default function AddressSearchButton({ onSelect, disabled }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerIdRef = useRef<string>(`addr-search-${++containerIdCounter}`);

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
    } catch (e) {
      console.error('address search error', e);
      alert('주소 검색을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleSearch}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border border-cyan/40 bg-cyan/5 px-4 py-2 text-sm font-medium text-cyan transition hover:bg-cyan/10 disabled:opacity-50"
      >
        <Search className="h-4 w-4" /> 도로명 주소 검색
      </button>
      <div id={containerIdRef.current} ref={containerRef} className="w-full" />
    </>
  );
}
