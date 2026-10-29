import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Image,
  LoaderCircle,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { API, getPhotos, type AlbumPhoto } from "../services/album";
import { Button } from "./ui/button";
import { AppLink } from "./AppLink";

function PhotoImage({
  photo,
  large = false,
}: {
  photo: AlbumPhoto;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span className="photo-unavailable">
      <Image size={28} />
      <span>Preview is being prepared</span>
    </span>
  ) : (
    <img
      src={API + photo.image}
      alt={photo.name}
      loading={large ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
export default function Album({ revision }: { revision: number }) {
  const [photos, setPhotos] = useState<AlbumPhoto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const loadingMore = useRef(false);
  const generation = useRef(0);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    generation.current++;
    setLoading(true);
    setError("");
    getPhotos(undefined, controller.signal)
      .then((data) => {
        setPhotos(data.photos);
        setCursor(data.nextCursor);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Please retry.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision, refresh]);
  const next = useCallback(
    (direction: number) =>
      setSelected(
        (index) => (index + direction + photos.length) % photos.length,
      ),
    [photos.length],
  );
  async function loadMore() {
    if (!cursor || loadingMore.current) return;
    loadingMore.current = true;
    setMore(true);
    setError("");
    const current = generation.current;
    try {
      const data = await getPhotos(cursor);
      if (current === generation.current) {
        setPhotos((previous) => {
          const seen = new Set(previous.map((p) => p.id));
          return [...previous, ...data.photos.filter((p) => !seen.has(p.id))];
        });
        setCursor(data.nextCursor);
      }
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      loadingMore.current = false;
      setMore(false);
    }
  }
  const photo = photos[selected];
  return (
    <section id="album" className="album-section">
      <div className="album-heading">
        <div>
          <h2>
            Shared photos{" "}
            <span className="photo-count">
              {photos.length}
              {cursor ? "+" : ""}
            </span>
          </h2>
        </div>
        <button
          type="button"
          className="album-refresh"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={loading}
          aria-label="Refresh album"
        >
          <RefreshCw size={15} className={loading ? "spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>
      {loading && photos.length === 0 ? (
        <div className="album-empty" role="status">
          <LoaderCircle className="spin" />
          <p>Loading photos...</p>
        </div>
      ) : (
        <div className="album-grid">
          {photos.map((p, index) => (
            <button
              className="album-photo"
              type="button"
              key={p.id}
              onClick={() => {
                setSelected(index);
                dialog.current?.showModal();
              }}
              aria-label={"View " + p.name}
            >
              <div className="photo-window">
                <PhotoImage key={p.image} photo={p} />
                <span className="photo-expand">
                  <Plus size={22} />
                </span>
              </div>
            </button>
          ))}
          {!photos.length && !error && (
            <div className="album-empty">
              <div className="empty-photos">
                <Camera size={36} strokeWidth={1} />
              </div>
              <p>No photos yet. Add the first one!</p>
              <Button asChild>
                <AppLink href="/">
                  <Plus size={16} /> Add photos
                </AppLink>
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="album-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => setRefresh((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}
      {cursor && (
        <Button
          variant="outline"
          className="load-more"
          onClick={loadMore}
          disabled={more || loading}
        >
          {more ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Plus size={16} />
          )}
          Load more
        </Button>
      )}
      <dialog
        ref={dialog}
        className="lightbox"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialog.current?.close();
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            next(1);
          }
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            next(-1);
          }
        }}
        aria-label="Wedding photo viewer"
      >
        <button
          className="lightbox-close"
          type="button"
          aria-label="Close photo viewer"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        {photo && (
          <div className="lightbox-content">
            <div
              className="lightbox-image"
              onTouchStart={(event) => {
                const touch = event.touches[0];
                if (touch)
                  touchStart.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const touch = event.changedTouches[0];
                const start = touchStart.current;
                touchStart.current = null;
                if (!touch || !start) return;
                const dx = touch.clientX - start.x;
                const dy = touch.clientY - start.y;
                if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5)
                  next(dx < 0 ? 1 : -1);
              }}
            >
              <PhotoImage key={photo.image} photo={photo} large />
            </div>
            <div className="lightbox-caption">
              <button
                type="button"
                onClick={() => next(-1)}
                aria-label="Previous photo"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <p>
                  {selected + 1} / {photos.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => next(1)}
                aria-label="Next photo"
              >
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
