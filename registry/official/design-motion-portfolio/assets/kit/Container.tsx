import type { ComponentPropsWithoutRef } from "react";

type ContainerProps = ComponentPropsWithoutRef<"div">;

/** Centers content at the page width with the standard side gutter. */
export function Container({ className = "", ...rest }: ContainerProps) {
  return <div className={`mx-auto w-full max-w-page px-gutter ${className}`.trim()} {...rest} />;
}
