import React, { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cn } from '../../utils/cn';

const LANG_LABELS: Record<string, string> = {
  bash: 'bash',
  sh: 'shell',
  shell: 'shell',
  javascript: 'javascript',
  js: 'javascript',
  jsx: 'jsx',
  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'tsx',
  python: 'python',
  py: 'python',
  py3: 'python',
  sql: 'sql',
  json: 'json',
  text: 'text',
  plaintext: 'text',
  html: 'html',
  css: 'css',
  yaml: 'yaml',
  yml: 'yaml',
  markdown: 'markdown',
  md: 'markdown',
  graphql: 'graphql',
  golang: 'go',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  java: 'java',
  c: 'c',
  'c++': 'c++',
  cpp: 'c++',
  csharp: 'c#',
  php: 'php',
  diff: 'diff',
};

function detectLanguage(meta: string | undefined, code: string): string {
  const fromMeta = (meta || '').trim().split(/\s+/)[0].toLowerCase();
  if (fromMeta) return LANG_LABELS[fromMeta] ?? fromMeta;
  if (/^\s*(import\s|def\s|print\(|from\s)/m.test(code)) return 'python';
  if (/^\s*(const\s|let\s|var\s|import\s|function\s|=>)/m.test(code)) return 'javascript';
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)\b/im.test(code)) return 'sql';
  if (/^\s*<[!?]/m.test(code) || /DOCTYPE/m.test(code)) return 'html';
  return 'text';
}

export function CodeBlock({
  code,
  language,
  title,
  className,
}: {
  code: string;
  language?: string;
  title?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const lang = language && language !== 'text' && language !== '' ? language : undefined;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className={cn('group/code my-2 overflow-hidden rounded-xl border border-border bg-surface', className)}>
      <div className="flex h-8 items-center justify-between border-b border-border bg-muted/40 px-3">
        <div className="flex items-center gap-1.5">
          <span className="flex gap-1">
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
            <span className="h-2 w-2 rounded-full bg-border" />
          </span>
          <span className="ml-1 font-mono text-[11px] text-muted-foreground">
            {lang ?? (title ?? 'code')}
          </span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Copy code"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono text-secondary-foreground">{code}</code>
      </pre>
    </div>
  );
}

export function InlineCodeBlock({ code }: { code: string }) {
  const { language, content } = useMemo(() => {
    const match = code.match(/^(\w+)\n([\s\S]*)$/);
    if (match) return { language: match[1].toLowerCase(), content: match[2] };
    return { language: undefined, content: code };
  }, [code]);

  const detected = useMemo(() => detectLanguage(language, content), [language, content]);

  return <CodeBlock code={content} language={detected} />;
}