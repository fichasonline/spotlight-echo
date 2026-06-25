import MarkdownIt from "markdown-it";

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
});

export function markdownToHtml(markdown: string): string {
  if (!markdown || !markdown.trim()) return "";
  return md.render(markdown);
}

export function isMarkdown(content: string): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  // Si contiene tags HTML, es HTML, no markdown
  if (trimmed.includes("<")) return false;
  // Si contiene elementos markdown, es markdown
  return (
    trimmed.includes("**") ||
    trimmed.includes("__") ||
    trimmed.includes("# ") ||
    trimmed.includes("## ") ||
    trimmed.includes("- ") ||
    trimmed.includes("* ") ||
    trimmed.includes("1. ")
  );
}
