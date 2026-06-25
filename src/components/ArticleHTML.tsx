import { cn } from "@/lib/utils";

type ArticleHTMLProps = {
  children: string;
  className?: string;
};

export function ArticleHTML({ children, className }: ArticleHTMLProps) {
  return (
    <div
      className={cn(
        "max-w-none",
        "prose prose-base dark:prose-invert",
        "prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground prose-headings:mt-8 prose-headings:mb-4",
        "prose-h1:text-4xl prose-h2:text-3xl prose-h3:text-2xl",
        "prose-p:leading-7 prose-p:text-foreground/90 prose-p:my-4",
        "prose-li:leading-7 prose-li:text-foreground/90",
        "prose-a:text-primary hover:prose-a:text-accent prose-a:underline",
        "prose-strong:text-foreground prose-strong:font-semibold",
        "prose-em:text-foreground/90 prose-em:italic",
        "prose-blockquote:border-primary/40 prose-blockquote:text-foreground/80 prose-blockquote:my-4",
        "prose-code:text-foreground prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        "prose-hr:border-border prose-hr:my-8",
        "prose-img:rounded-lg prose-img:border prose-img:border-border prose-img:my-6",
        "prose-ol:list-decimal prose-ul:list-disc",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: children }}
    />
  );
}
