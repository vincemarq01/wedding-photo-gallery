import type { AnchorHTMLAttributes } from "react";

export function AppLink({
  href = "/",
  disabled = false,
  onClick,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { disabled?: boolean }) {
  return (
    <a
      {...props}
      href={href}
      aria-disabled={disabled || undefined}
      onClick={(event) => {
        onClick?.(event);
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.target === "_blank"
        )
          return;
        event.preventDefault();
        window.history.pushState(null, "", href);
        window.dispatchEvent(new PopStateEvent("popstate"));
        window.scrollTo({ top: 0, behavior: "instant" });
      }}
    />
  );
}
