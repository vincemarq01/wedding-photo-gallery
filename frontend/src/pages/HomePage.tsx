import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Heart,
  Menu,
  CloudUpload,
  ChevronRight,
  Images,
  CalendarDays,
  X,
} from "lucide-react";
import { AppLink } from "../components/AppLink";
import BottomNav from "../components/BottomNav";

export default function HomePage() {
  const [menu, setMenu] = useState(false);
  const [event, setEvent] = useState(false);
  const publicUrl = import.meta.env.VITE_PUBLIC_URL || window.location.origin;
  return (
    <main className="relative mx-auto min-h-dvh max-w-[480px] bg-[#fff9f6] pb-[90px] md:my-8 md:min-h-[calc(100dvh-64px)] md:w-[calc(100%-64px)] md:max-w-[1200px] md:rounded-3xl md:border md:border-[#efdfda] md:shadow-[0_16px_70px_#a77e7212] overflow-hidden md:grid md:grid-cols-[1.15fr_1fr] md:grid-rows-[80px_1fr] md:pb-0">
      <header className="flex h-[65px] items-center gap-3.5 bg-[#fffaf8ed] px-6 text-[#bd7778] md:col-span-2 md:h-20 md:border-b md:border-[#f1e3df] md:px-8 [&>span]:flex-1 [&>span]:font-serif [&>span]:text-xl [&>span]:text-[#8f5c5d] md:[&>span]:text-2xl [&>button]:grid [&>button]:size-11 [&>button]:place-items-center md:[&>button]:hidden">
        <Heart size={27} strokeWidth={1.2} />
        <span>Wedding Album Share</span>
        <button
          type="button"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X size={21} /> : <Menu size={21} />}
        </button>
      </header>
      {menu && (
        <nav
          className="absolute top-[62px] right-4 z-30 rounded-2xl bg-[#fffaf8] p-2 shadow-xl md:hidden [&>a]:block [&>a]:px-5 [&>a]:py-3 [&>a]:text-sm"
          aria-label="Wedding links"
        >
          <AppLink href="/upload">Upload memories</AppLink>
          <AppLink href="/album">View gallery</AppLink>
          <AppLink href="/print">Print QR card</AppLink>
        </nav>
      )}
      <section
        className="relative h-[440px] overflow-hidden text-white md:h-full md:min-h-[650px] [&>img]:size-full [&>img]:object-cover [&>img]:object-center after:absolute after:inset-0 after:bg-[linear-gradient(180deg,#00000099,transparent_60%,#00000020)] md:after:bg-[linear-gradient(180deg,#00000010_20%,transparent_65%,#00000030)]"
        aria-label="Our wedding memories"
      >
        <img
          className="origin-[50%_40%] scale-200 md:origin-center md:scale-100"
          src="/DSC06521.jpg"
          width={5744}
          height={3829}
          alt="Vince and Emyreen holding hands beneath a church arch, overlooking the mountains"
          fetchPriority="high"
        />
        <div className="absolute top-8 right-4 left-4 z-10 text-center [text-shadow:0_2px_15px_#38221c50] md:top-14 [&>h1]:font-script [&>h1]:text-[61px] [&>h1]:leading-[1.15] md:[&>h1]:text-[clamp(56px,5.5vw,82px)] [&>svg]:mx-auto [&>svg]:mt-1 [&>svg]:mb-2.5 [&>p:last-child]:font-serif [&>p:last-child]:text-2xl [&>p:last-child]:leading-tight md:[&>p:last-child]:text-3xl">
          <p className="mb-3 text-[9px] tracking-[3.5px] md:text-[11px]">
            OUR WEDDING MEMORIES
          </p>
          <h1>Vince & Emyreen</h1>
          <Heart size={18} strokeWidth={1.3} />
          <p>
            Share your beautiful
            <br />
            moments with us
          </p>
        </div>
      </section>
      <section
        className="relative z-10 -mt-6 bg-[linear-gradient(transparent,#f9eeeb_85%)] px-6 md:mt-0 md:flex md:flex-col md:justify-center md:bg-[radial-gradient(ellipse_at_top_right,#fffaf7,#f8e9e6)] md:px-8 md:pt-14 md:pb-8"
        aria-label="Share our day"
      >
        <div className="flex items-center gap-4 rounded-[19px] border border-white bg-[#fffaf8f2] p-[18px] [&>svg:first-child]:shrink-0 [&>svg:last-child]:ml-auto [&>svg:last-child]:shrink-0 [&>svg:last-child]:self-end [&>svg:last-child]:text-[#d88e91] [&_h2]:mb-1.5 [&_h2]:text-sm [&_h2]:font-semibold [&_p]:text-[11px] [&_p]:leading-relaxed [&_p]:text-[#8e7e7c] md:py-6 md:[&_h2]:text-lg md:[&_p]:text-xs">
          <QRCodeSVG
            value={publicUrl.replace(/\/$/, "") + "/upload"}
            size={88}
            marginSize={1}
            level="M"
          />
          <div>
            <h2>Scan to Share</h2>
            <p>
              Open this on your phone
              <br />
              to upload your photos
              <br />
              and memories of love.
            </p>
          </div>
          <Heart size={15} />
        </div>
        <AppLink
          href="/upload"
          className="mt-4 flex min-h-[54px] items-center justify-center gap-3.5 rounded-full bg-linear-to-r from-[#df9792] to-[#d97d88] px-6 text-[15px] text-white shadow-sm [&>svg:first-child]:ml-auto [&>svg:last-child]:ml-auto md:mt-6 md:min-h-[58px] md:text-base"
        >
          <CloudUpload size={21} />
          Upload Memories
          <ChevronRight size={18} />
        </AppLink>
        <div className="mt-3.5 grid grid-cols-2 gap-3 md:mt-[18px] md:gap-4 [&>*]:flex [&>*]:flex-col [&>*]:items-center [&>*]:rounded-2xl [&>*]:border [&>*]:border-white/50 [&>*]:bg-white/65 [&>*]:px-2 [&>*]:pt-[17px] [&>*]:pb-[13px] [&>*]:text-[#65494d] md:[&>*]:py-6 [&_svg]:mb-2 [&_svg]:text-[#cd8589] [&_strong]:font-serif [&_strong]:text-lg [&_strong]:font-medium md:[&_strong]:text-2xl [&_span]:mt-1 [&_span]:text-[10px] [&_span]:text-[#9b8584] md:[&_span]:text-[11px]">
          <AppLink href="/album">
            <Images size={23} />
            <strong>Gallery</strong>
            <span>View all memories</span>
          </AppLink>
          <button
            type="button"
            onClick={() => setEvent(!event)}
            aria-expanded={event}
          >
            <CalendarDays size={23} />
            <strong>Event Info</strong>
            <span>A day to remember</span>
          </button>
        </div>
        {event && (
          <div className="mt-4 rounded-2xl border border-[#efdbd8] bg-[#fffaf8] p-5 text-center [&>svg]:mx-auto [&>svg]:mb-2 [&>svg]:text-[#d18c8d] [&>h2]:font-serif [&>h2]:text-2xl [&>h2]:font-medium [&>p]:mt-2 [&>p]:text-xs [&>p]:leading-loose [&>p]:text-[#947b7c]">
            <Heart size={19} />
            <h2>Celebrating Vince & Emyreen</h2>
            <p>
              Capture the smiles, the happy tears, and every little moment.
              Share your photos here so we can treasure our day together.
            </p>
          </div>
        )}
        <p className="pt-4 pb-1 text-center font-script text-[28px] text-[#b58a89] md:pt-6 md:text-4xl">
          Your photos. Our forever.
        </p>
      </section>
      <BottomNav active="home" />
    </main>
  );
}
