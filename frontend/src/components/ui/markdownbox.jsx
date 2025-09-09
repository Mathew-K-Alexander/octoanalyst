import React from "react";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

export function MarkdownBox({ className, children }) {
  return (
    <div
      className={cn(
        "border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 min-h-[200px] w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm overflow-y-auto max-h-[300px] prose prose-sm max-w-none prose-headings:mt-1 prose-p:my-1 prose-ul:my-1",
        className
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
