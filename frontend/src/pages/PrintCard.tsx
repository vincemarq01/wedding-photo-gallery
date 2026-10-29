import { QRCodeSVG } from "qrcode.react";
import { Heart } from "lucide-react";
import { Button } from "../components/ui/button";
export default function PrintCard() {
  const url = import.meta.env.VITE_PUBLIC_URL;
  return (
    <main className="print-page">
      <div className="print-card">
        <div className="eyebrow">A LITTLE MOMENT. A LIFETIME OF MEMORIES.</div>
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
        <p className="small">Your photos. Our forever.</p>
      </div>
      <Button onClick={() => window.print()} className="no-print">
        Print our QR card
      </Button>
    </main>
  );
}
