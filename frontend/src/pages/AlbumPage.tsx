import BottomNav from "../components/BottomNav";
import { Heart, CloudUpload } from "lucide-react";
import Album from "../components/Album";
import { AppLink } from "../components/AppLink";

export default function AlbumPage() {
  return (
    <main className="relative mx-auto min-h-dvh max-w-[480px] bg-[#fff9f6] pb-[90px] md:my-8 md:min-h-[calc(100dvh-64px)] md:w-[calc(100%-64px)] md:max-w-[1200px] md:rounded-3xl md:border md:border-[#efdfda] md:shadow-[0_16px_70px_#a77e7212] px-4 md:px-10 md:pb-5">
      <header className="relative px-6 pt-[30px] pb-2 text-center md:border-b md:border-[#efdfda] md:pt-11 md:pr-[360px] md:pb-[30px] md:pl-0 md:text-left [&>h1]:font-serif [&>h1]:text-[31px] [&>h1]:leading-[1.1] [&>h1]:font-medium [&>h1]:text-[#714749] md:[&>h1]:text-[52px] [&>p:not(:first-child)]:mt-1 [&>p:not(:first-child)]:text-[11px] [&>p:not(:first-child)]:text-[#a18b88] md:[&>p:not(:first-child)]:mt-2 md:[&>p:not(:first-child)]:text-sm">
        <p className="hidden md:mb-3 md:block md:text-[9px] md:tracking-[3px] md:text-[#b08c88]">
          VINCE & EMYREEN
        </p>
        <h1>Guest Memories</h1>
        <p>All the love through your lens</p>
        <div className="mt-2 flex items-center justify-center gap-2 text-[#d79298] md:mt-3.5 md:justify-start [&>span]:h-px [&>span]:w-8 [&>span]:bg-[#ecd6d3]">
          <span />
          <Heart size={13} strokeWidth={1.4} />
          <span />
        </div>
        <Heart
          className="absolute top-[33px] right-1 text-[#cf8189] md:hidden"
          size={22}
          strokeWidth={1.3}
          aria-hidden="true"
        />
      </header>
      <Album revision={0} />
      <AppLink
        href="/upload"
        className="fixed right-[max(20px,calc((100vw-480px)/2+20px))] bottom-[calc(87px+env(safe-area-inset-bottom))] z-10 flex size-[58px] items-center justify-center gap-2 rounded-full border-[3px] border-[#fffaf7] bg-linear-to-br from-[#e9a5a8] to-[#d37d90] text-white shadow-[0_4px_17px_#a5677350] [&>span]:hidden md:right-[max(42px,calc((100vw-1200px)/2+26px))] md:bottom-[30px] md:h-[55px] md:w-auto md:px-[22px] md:text-[13px] md:[&>span]:inline"
        aria-label="Upload memories"
      >
        <CloudUpload size={25} strokeWidth={1.4} />
        <span>Upload memories</span>
      </AppLink>
      <BottomNav active="album" />
      <footer className="flex items-center justify-between py-6 text-[10px] text-[#96808b] md:col-span-full md:row-start-5 md:border-t md:border-[#f0dfda] [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:pl-4 [&>a]:text-[#8e6379]">
        <span>With love, Vince & Emy</span>
        <AppLink href="/upload">Add your memories</AppLink>
      </footer>
    </main>
  );
}
