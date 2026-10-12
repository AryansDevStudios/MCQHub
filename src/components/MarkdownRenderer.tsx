'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { cn } from '@/lib/utils';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  inline?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className, inline = false }) => {
  const safeContent = typeof content === 'string' ? content : String(content ?? '');
  if (!safeContent) return null;

  const WrapperTag = inline ? 'span' : 'div';

  return (
    <WrapperTag className={cn(inline ? 'inline' : 'space-y-2', className)}>
      <ReactMarkdown
        className={cn(
          'prose dark:prose-invert max-w-none text-inherit text-xs sm:text-sm',
          inline
            ? 'prose-p:inline prose-p:my-0'
            : 'prose-p:my-1.5 prose-headings:my-2 prose-ul:my-1.5 prose-li:my-0.5'
        )}
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={
          inline
            ? {
                p: ({ node, ...props }) => <span className="inline" {...props} />,
                code: ({ node, ...props }) => (
                  <code className="bg-muted/70 px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                ),
              }
            : {
                h1: ({ node, ...props }) => (
                  <h1 className="text-base font-bold text-foreground mt-3 mb-1.5" {...props} />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-sm font-bold text-foreground mt-3 mb-1.5" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-xs sm:text-sm font-semibold text-foreground mt-2.5 mb-1 text-primary" {...props} />
                ),
                h4: ({ node, ...props }) => (
                  <h4 className="text-xs font-semibold text-foreground mt-2 mb-0.5" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="leading-relaxed mb-2 text-foreground/90" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc list-inside space-y-1 my-1.5 pl-1" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal list-inside space-y-1 my-1.5 pl-1" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="leading-relaxed text-foreground/90" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-semibold text-foreground" {...props} />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-2 border-primary/50 pl-3 italic text-muted-foreground my-2" {...props} />
                ),
                code: ({ node, ...props }) => (
                  <code className="bg-muted/70 text-primary px-1.5 py-0.5 rounded text-xs font-mono" {...props} />
                ),
              }
        }
      >
        {safeContent}
      </ReactMarkdown>
    </WrapperTag>
  );
};

export default MarkdownRenderer;
