import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Localized Choghadiya name (classical names, en transliteration / hi Devanagari). */
export function choghName(t: (k: string, o?: Record<string, unknown>) => string, name: string): string {
  return t(`choghadiya.n.${name.toLowerCase()}`, { defaultValue: name });
}
