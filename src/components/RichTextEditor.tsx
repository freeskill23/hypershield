import { useRef, useEffect, useCallback } from 'react';
import {
  Bold, Italic, Underline, List, ListOrdered, Quote,
  Link2, Heading2, Heading3, Undo, Redo,
} from 'lucide-react';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export default function RichTextEditor({ value, onChange, placeholder = '내용을 입력하세요...', minHeight = 200 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const isUserEditing = useRef(false);

  // Only sync external value when not actively editing (e.g. initial load or programmatic change)
  useEffect(() => {
    const el = ref.current;
    if (!el || isUserEditing.current) return;
    if (el.innerHTML !== value) {
      el.innerHTML = value;
    }
  }, [value]);

  const exec = useCallback((command: string, val?: string) => {
    document.execCommand(command, false, val);
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  }, [onChange]);

  const handleInput = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    isUserEditing.current = true;
    onChange(el.innerHTML);
    // Reset after a tick so external value syncs can resume
    requestAnimationFrame(() => { isUserEditing.current = false; });
  }, [onChange]);

  const handleLink = useCallback(() => {
    const url = prompt('링크 URL을 입력하세요');
    if (url) exec('createLink', url);
  }, [exec]);

  const btn = (icon: React.ReactNode, command: string, title: string, val?: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); exec(command, val); }}
      className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
    >
      {icon}
    </button>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-navy-700 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-navy-700 bg-slate-50 px-2 py-1.5">
        {btn(<Bold className="h-4 w-4" />, 'bold', '굵게')}
        {btn(<Italic className="h-4 w-4" />, 'italic', '기울임')}
        {btn(<Underline className="h-4 w-4" />, 'underline', '밑줄')}
        <div className="mx-1 h-5 w-px bg-navy-700" />
        {btn(<Heading2 className="h-4 w-4" />, 'formatBlock', '제목 2', '<h2>')}
        {btn(<Heading3 className="h-4 w-4" />, 'formatBlock', '제목 3', '<h3>')}
        <div className="mx-1 h-5 w-px bg-navy-700" />
        {btn(<List className="h-4 w-4" />, 'insertUnorderedList', '글머리 기호')}
        {btn(<ListOrdered className="h-4 w-4" />, 'insertOrderedList', '번호 매기기')}
        {btn(<Quote className="h-4 w-4" />, 'formatBlock', '인용', '<blockquote>')}
        <div className="mx-1 h-5 w-px bg-navy-700" />
        <button
          type="button"
          title="링크"
          onMouseDown={(e) => { e.preventDefault(); handleLink(); }}
          className="grid h-8 w-8 place-items-center rounded-md text-slate-500 transition hover:bg-slate-200 hover:text-slate-800"
        >
          <Link2 className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-navy-700" />
        {btn(<Undo className="h-4 w-4" />, 'undo', '실행 취소')}
        {btn(<Redo className="h-4 w-4" />, 'redo', '다시 실행')}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        data-placeholder={placeholder}
        className="rich-editor prose max-w-none px-4 py-3 text-sm text-slate-800 focus:outline-none"
        style={{ minHeight }}
      />
    </div>
  );
}
