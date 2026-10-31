import { QRCodeSVG } from "qrcode.react";
import { Heart } from "lucide-react";
import { Button } from "../components/ui/button";
export default function PrintCard() {
  const url = import.meta.env.VITE_PUBLIC_URL;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 p-[30px] print:min-h-0 print:p-0">
      <div className="max-w-[500px] border border-[#c7a3a3] bg-[#fffaf6] px-9 py-[50px] text-center outline outline-[#e0c9c1] outline-offset-[-10px] print:mx-auto print:my-[20mm] print:break-inside-avoid [&>h1]:my-6 [&>h1]:font-serif [&>h1]:text-[52px] [&>h2]:font-serif [&>h2]:text-4xl [&>svg]:mx-auto [&>svg]:my-6 [&>svg]:text-[#ab7880] [&>p]:my-3 [&>p]:text-[13px] [&>p]:leading-loose">
        <div className="text-[9px] tracking-[2px] text-[#ab8f96]">
          A LITTLE MOMENT. A LIFETIME OF MEMORIES.
        </div>
        <h1>
          Vince <i>&</i> Emyreen
        </h1>
        <Heart size={25} />
        <h2>Scan. Snap. Share.</h2>
        <p>Help us capture every beautiful moment!</p>
        {url && /^https:\/\//.test(url) ? (
          <QRCodeSVG
            value={url.replace(/\/$/, "") + "/#share"}
            size={220}
            level="H"
            marginSize={4}
          />
        ) : (
          <p role="alert">
            Set VITE_PUBLIC_URL to your deployed HTTPS website and rebuild to
            generate the production QR code.
          </p>
        )}
        <p className="text-[#9f767c] italic">Your photos. Our forever.</p>
      </div>
      <Button onClick={() => window.print()} className="print:hidden">
        Print our QR card
      </Button>
    </main>
  );
}
