import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "sonner"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Show a persistent success toast with a full tx hash and a copy button. */
export function txToast(title: string, hash: string) {
  toast.success(title, {
    description: hash,
    duration: Infinity,
    action: {
      label: "Copy",
      onClick: () => navigator.clipboard.writeText(hash),
    },
  });
}
