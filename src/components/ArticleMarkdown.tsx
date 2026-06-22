import { ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

function getVideoEmbedUrl(url: string): string | null {
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  const twitchVideoMatch = url.match(/twitch\.tv\/videos\/(\d+)/);
  if (twitchVideoMatch) {
    const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://player.twitch.tv/?video=${twitchVideoMatch[1]}&parent=${parent}&autoplay=false`;
  }

  const twitchChannelMatch = url.match(/twitch\.tv\/(?!videos\/)([A-Za-z0-9_]+)/);
  if (twitchChannelMatch) {
    const parent = typeof window !== "undefined" ? window.location.hostname : "localhost";
    return `https://player.twitch.tv/?channel=${twitchChannelMatch[1]}&parent=${parent}&autoplay=false`;
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => {
    const url = href || "";
    const embedUrl = getVideoEmbedUrl(url);
    if (embedUrl) {
      return (
        <span className="not-prose my-4 block">
          <span className="mb-1.5 block text-sm font-medium text-muted-foreground">{children}</span>
          <span
            className="relative block w-full overflow-hidden rounded-lg border border-border bg-black"
            style={{ paddingBottom: "56.25%" }}
          >
            <iframe
              src={embedUrl}
              title={typeof children === "string" ? children : "Video"}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </span>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
          >
            <ExternalLink className="h-3 w-3 shrink-0" />
            Abrir en nueva pestaña
          </a>
        </span>
      );
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

type ArticleMarkdownProps = {
  children: string;
  className?: string;
  imageUrlToOmit?: string | null;
};

export function ArticleMarkdown({ children, className, imageUrlToOmit }: ArticleMarkdownProps) {
  const markdown = imageUrlToOmit
    ? children.replace(new RegExp(`!\\[[^\\]]*\\]\\(${escapeRegExp(imageUrlToOmit)}\\)`, "g"), "")
    : children;

  return (
    <div
      className={cn(
        "prose prose-base max-w-none dark:prose-invert",
        "prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground",
        "prose-p:leading-7 prose-p:text-foreground/90",
        "prose-li:leading-7 prose-li:text-foreground/90",
        "prose-a:text-primary hover:prose-a:text-accent",
        "prose-strong:text-foreground",
        "prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80",
        "prose-code:text-foreground",
        "prose-hr:border-border",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
