/** A static, selectable command or code sample. */
export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <pre
      tabIndex={0}
      aria-label={label}
      className="overflow-x-auto border border-line-strong bg-bg-sunken p-4 font-mono text-sm text-ink"
    >
      <code>{children}</code>
    </pre>
  );
}
