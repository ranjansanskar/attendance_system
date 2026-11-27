// Shared Tailwind class strings so screens look consistent.
export const ui = {
  input:
    "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
  label: "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300",
  button:
    "inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50",
  buttonSecondary:
    "inline-flex items-center justify-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  buttonDanger:
    "inline-flex items-center justify-center rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950",
  card: "rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900",
  h1: "text-2xl font-semibold text-zinc-900 dark:text-zinc-100",
  h2: "text-lg font-semibold text-zinc-900 dark:text-zinc-100",
  muted: "text-sm text-zinc-500 dark:text-zinc-400",
  table: "w-full text-left text-sm",
  th: "border-b border-zinc-200 px-3 py-2 font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400",
  td: "border-b border-zinc-100 px-3 py-2 text-zinc-800 dark:border-zinc-800 dark:text-zinc-200",
  error: "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300",
  success: "rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300",
};

export type ActionState = { error?: string; ok?: string } | undefined;
