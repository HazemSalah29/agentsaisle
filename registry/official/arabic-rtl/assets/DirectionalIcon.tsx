// Flips an icon in right-to-left layouts, but only when `directional` is set. Use it for icons that express
// direction (arrows, chevrons, "next"); leave logos, media controls, checkmarks and clocks alone.
// Usage: <DirectionalIcon directional><ChevronRight /></DirectionalIcon>
import type { ReactNode } from "react";

export function DirectionalIcon({
  children,
  directional = false,
  className = "",
}: {
  children: ReactNode;
  directional?: boolean;
  className?: string;
}) {
  const flip = directional ? "rtl:-scale-x-100" : "";
  return (
    <span aria-hidden="true" className={`inline-flex ${flip} ${className}`.trim()}>
      {children}
    </span>
  );
}
