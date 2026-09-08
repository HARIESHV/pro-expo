import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { CodeBlock } from './codeblock';
import { cn } from '../../utils/cn';

const inlineCode = ({ className, children }: React.HTMLAttributes<HTMLElement>) => {
  const text = String(children ?? '');
  return (
    <code
      className={cn(
        'rounded-md border border-border bg-surface px-1 py-0.5 font-mono text-[0.8em] text-secondary-foreground',
        className
      )}
    >
      {children}
    </code>
  );
};

function codeBlockRenderer({
  node,
  className,
  children,
  ...props
}: React.ComponentProps<'code'> & { node?: unknown }) {
  const match = /language-(\w+)/.exec(className || '');
  const raw = String((node as any)?.children?.[0]?.value ?? '');
  return (
    <CodeBlock
      code={raw || String(children ?? '').replace(/\n$/, '')}
      language={match?.[1]}
    />
  );
}

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('md-body', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            if (!match) return inlineCode({ className, children });
            const code = String(children ?? '').replace(/\n$/, '');
            return <CodeBlock code={code} language={match[1]} />;
          },
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
            >
              {props.children}
              <ExternalLink className="ml-0.5 inline-block h-3 w-3 opacity-60" />
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export function markdownBodyStyles() {
  return null;
}