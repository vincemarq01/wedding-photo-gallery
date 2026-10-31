import { Home, CloudUpload, Images } from "lucide-react";
import { AppLink } from "./AppLink";

export default function BottomNav({
  active,
  disabled = false,
}: {
  active: "home" | "upload" | "album";
  disabled?: boolean;
}) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-20 grid w-full max-w-[480px] -translate-x-1/2 grid-cols-3 border-t border-[#edddda] bg-[#fffbf8f5] px-3 pt-2 pb-[max(9px,env(safe-area-inset-bottom))] backdrop-blur-md md:absolute md:top-[17px] md:right-7 md:bottom-auto md:left-auto md:w-[340px] md:translate-x-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
      aria-label="Main navigation"
    >
      {(
        [
          { href: "/", key: "home", label: "Home", Icon: Home },
          {
            href: "/upload",
            key: "upload",
            label: "Upload",
            Icon: CloudUpload,
          },
          { href: "/album", key: "album", label: "Gallery", Icon: Images },
        ] as const
      ).map(({ href, key, label, Icon }) => (
        <AppLink
          key={key}
          href={href}
          disabled={disabled}
          className={
            "flex min-h-[49px] flex-col items-center gap-1 rounded-full text-[10px] md:min-h-11 md:flex-row md:justify-center md:gap-1 md:text-[13px] [&>span]:grid [&>span]:h-8 [&>span]:w-[43px] [&>span]:place-items-center [&>span]:rounded-full md:[&>span]:size-[29px] " +
            (active === key
              ? "text-[#dc7c8a] [&>span]:bg-[#ffe5e8] md:bg-[#fce9e8] md:[&>span]:bg-transparent"
              : "text-[#94888a]")
          }
          aria-current={active === key ? "page" : undefined}
        >
          <span>
            <Icon size={21} strokeWidth={1.5} />
          </span>
          {label}
        </AppLink>
      ))}
    </nav>
  );
}
