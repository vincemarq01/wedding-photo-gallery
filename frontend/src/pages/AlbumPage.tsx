import { ArrowLeft, Heart, Plus } from "lucide-react";
import Album from "../components/Album";
import { AppLink } from "../components/AppLink";
import { Button } from "../components/ui/button";

export default function AlbumPage() {
  return (
    <main className="simple-page album-page">
      <nav className="album-page-nav" aria-label="Album navigation">
        <AppLink href="/" className="back-link">
          <ArrowLeft size={18} />
          Back to upload
        </AppLink>
        <Button asChild variant="outline">
          <AppLink href="/">
            <Plus size={16} />
            Add photos
          </AppLink>
        </Button>
      </nav>
      <header className="simple-header">
        <div className="header-mark">
          <Heart size={20} strokeWidth={1.5} />
        </div>
        <h1>
          Vince <span>&</span> Emy
        </h1>
        <p>Our day, through your eyes.</p>
      </header>
      <Album revision={0} />
      <footer>
        <span>With love, Vince & Emy</span>
        <AppLink href="/">Add your memories</AppLink>
      </footer>
    </main>
  );
}
