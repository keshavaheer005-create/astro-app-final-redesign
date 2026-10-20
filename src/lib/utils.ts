import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Localized Choghadiya name (classical names, en transliteration / hi Devanagari). */
export function choghName(t: (k: string, o?: Record<string, unknown>) => string, name: string): string {
  return t(`choghadiya.n.${name.toLowerCase()}`, { defaultValue: name });
}

/**
 * Strip lightweight markdown (fenced/inline code, headings, emphasis, list
 * bullets) and collapse whitespace — used for one-line chat previews so the
 * `**` / `#` syntax never leaks into the conversation list.
 */
export function stripMarkdownPreview(content: string): string {
  return String(content ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
