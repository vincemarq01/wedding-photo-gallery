import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Image,
  LoaderCircle,
  Plus,
  RefreshCw,
  Video,
  X,
} from "lucide-react";
import { getPhotoSource, getPhotos, type AlbumPhoto } from "../services/album";
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
  const [source, setSource] = useState("");
  const container = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let started = false;
    const load = () => {
      if (started) return;
      started = true;
      getPhotoSource(photo, large, controller.signal)
        .then((url) => {
          if (!controller.signal.aborted) setSource(url);
        })
        .catch(() => {
          if (!controller.signal.aborted) setFailed(true);
        });
    };
    const element = container.current;
    const observer =
      !large && element && typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(
            (entries) => {
              if (entries.some((e) => e.isIntersecting)) {
                observer?.disconnect();
                load();
              }
            },
            { rootMargin: "200px" },
          )
        : null;
    if (observer && element) observer.observe(element);
    else load();
    return () => {
      controller.abort();
      observer?.disconnect();
    };
  }, [photo.id, photo.image, large]);
  return failed ? (
    <span className="flex size-full flex-col items-center justify-center gap-2 bg-[#f0e5e1] p-2 text-center text-[9px] leading-relaxed text-[#8e7681]">
      <Image size={28} />
      <span>Preview is being prepared</span>
    </span>
  ) : source ? (
    <img
      src={source}
      alt={photo.name}
      loading={large ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      ref={container}
      className="flex size-full flex-col items-center justify-center gap-2 bg-[#f0e5e1] p-2 text-center text-[9px] leading-relaxed text-[#8e7681]"
      role="status"
    >
      <LoaderCircle
        size={20}
        className="animate-spin motion-reduce:animate-none"
      />
      <span>Loading photo...</span>
    </span>
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
  const [filter, setFilter] = useState<"all" | "photos" | "videos">("all");
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
    <section id="album" className="relative md:pt-6">
      <div
        className="mt-1 mb-2.5 grid grid-cols-[.8fr_1.1fr_1.1fr] gap-2.5 md:mt-0 md:mb-6 md:w-[360px] md:gap-3 [&>button]:flex [&>button]:min-h-10 [&>button]:items-center [&>button]:justify-center [&>button]:gap-2 [&>button]:rounded-full [&>button]:bg-[#f2e8e5] [&>button]:text-xs [&>button]:text-[#725957] [&>button]:transition-colors md:[&>button]:min-h-11 md:[&>button]:text-[13px] [&>button[aria-pressed=true]]:bg-linear-to-r [&>button[aria-pressed=true]]:from-[#e39b9e] [&>button[aria-pressed=true]]:to-[#d98392] [&>button[aria-pressed=true]]:text-white"
        role="group"
        aria-label="Filter memories"
      >
        <button
          type="button"
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={filter === "photos"}
          onClick={() => setFilter("photos")}
        >
          <Image size={16} />
          Photos
        </button>
        <button
          type="button"
          aria-pressed={filter === "videos"}
          onClick={() => setFilter("videos")}
        >
          <Video size={16} />
          Videos
        </button>
      </div>
      <div className="mb-2 flex items-center justify-between md:absolute md:top-6 md:right-0 md:min-h-11 md:gap-5 [&_h2]:flex [&_h2]:items-center [&_h2]:gap-2 [&_h2]:text-[11px] [&_h2]:font-normal [&_h2]:tracking-wide [&_h2]:text-[#a38c87] md:[&_h2]:text-xs">
        <div>
          <h2>
            Photos{" "}
            <span className="text-[10px]">
              {photos.length}
              {cursor ? "+" : ""}
            </span>
          </h2>
        </div>
        <button
          type="button"
          className="flex min-h-[30px] min-w-11 items-center gap-1.5 py-1 pl-2.5 text-[10px] text-[#ac8583] disabled:opacity-50 md:text-xs"
          onClick={() => setRefresh((v) => v + 1)}
          disabled={loading}
          aria-label="Refresh album"
        >
          <RefreshCw
            size={15}
            className={loading ? "animate-spin motion-reduce:animate-none" : ""}
          />
          <span>Refresh</span>
        </button>
      </div>
      {filter === "videos" ? (
        <div className="col-span-full flex min-h-[175px] flex-col items-center justify-center gap-3 rounded-[13px] border border-dashed border-[#dcc8d2] bg-[#f8f1f5] p-5 text-center text-[13px] text-[#8f7481] md:min-h-[310px] [&>a]:min-h-11 [&>a]:rounded-lg [&>a]:px-4 [&>a]:py-2 [&>a]:text-xs mt-3 [&>button]:min-h-11 [&>button]:rounded-full [&>button]:border [&>button]:border-[#dfb9bd] [&>button]:bg-[#fff9f6] [&>button]:px-5 [&>button]:py-3 [&>button]:text-[#9f6574]">
          <Video size={30} strokeWidth={1.3} />
          <p>This album currently accepts photos only.</p>
          <button type="button" onClick={() => setFilter("photos")}>
            View photos
          </button>
        </div>
      ) : loading && photos.length === 0 ? (
        <div
          className="col-span-full flex min-h-[175px] flex-col items-center justify-center gap-3 rounded-[13px] border border-dashed border-[#dcc8d2] bg-[#f8f1f5] p-5 text-center text-[13px] text-[#8f7481] md:min-h-[310px] [&>a]:min-h-11 [&>a]:rounded-lg [&>a]:px-4 [&>a]:py-2 [&>a]:text-xs"
          role="status"
        >
          <LoaderCircle className="animate-spin motion-reduce:animate-none" />
          <p>Loading photos...</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 md:gap-3.5 min-[1100px]:grid-cols-5">
          {photos.map((p, index) => (
            <button
              className="group block overflow-hidden rounded-[10px] bg-[#f1ecee] md:rounded-[13px]"
              type="button"
              key={p.id}
              onClick={() => {
                setSelected(index);
                dialog.current?.showModal();
              }}
              aria-label={"View " + p.name}
            >
              <div className="relative grid aspect-[.79] place-items-center overflow-hidden rounded-[10px] md:aspect-[.88] md:rounded-[13px] [&>img]:size-full [&>img]:object-cover [&>img]:transition-transform group-hover:[&>img]:scale-[1.035] motion-reduce:[&>img]:transition-none">
                <PhotoImage key={p.image} photo={p} />
                <span className="absolute inset-0 grid place-items-center bg-[#69434920] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  <Plus size={22} />
                </span>
              </div>
            </button>
          ))}
          {!photos.length && !error && (
            <div className="col-span-full flex min-h-[175px] flex-col items-center justify-center gap-3 rounded-[13px] border border-dashed border-[#dcc8d2] bg-[#f8f1f5] p-5 text-center text-[13px] text-[#8f7481] md:min-h-[310px] [&>a]:min-h-11 [&>a]:rounded-lg [&>a]:px-4 [&>a]:py-2 [&>a]:text-xs">
              <div className="[&>svg]:size-7">
                <Camera size={36} strokeWidth={1} />
              </div>
              <p>No photos yet. Add the first one!</p>
              <Button asChild>
                <AppLink href="/upload">
                  <Plus size={16} /> Add photos
                </AppLink>
              </Button>
            </div>
          )}
        </div>
      )}
      {error && (
        <div
          className="p-5 text-center text-xs text-[#a66075] [&>button]:mt-2 [&>button]:min-h-11 [&>button]:px-4 [&>button]:py-2 [&>button]:underline"
          role="alert"
        >
          <p>{error}</p>
          <button type="button" onClick={() => setRefresh((v) => v + 1)}>
            Try again
          </button>
        </div>
      )}
      {cursor && filter !== "videos" && (
        <Button
          variant="outline"
          className="mx-auto mt-5 flex min-h-11 rounded-lg px-[18px] py-2.5 text-xs"
          onClick={loadMore}
          disabled={more || loading}
        >
          {more ? (
            <LoaderCircle
              size={16}
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Plus size={16} />
          )}
          Load more
        </Button>
      )}
      <dialog
        ref={dialog}
        className="fixed inset-0 m-auto max-h-dvh w-full max-w-full overflow-auto border-0 bg-white p-3 shadow-2xl backdrop:bg-[#211b21dc] md:max-h-[94dvh] md:w-[min(960px,95vw)] md:max-w-[95vw] md:rounded-[10px]"
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
          className="absolute top-5 right-5 z-10 grid size-11 place-items-center rounded-full bg-[#ffffffdf] p-2 text-[#826c78]"
          type="button"
          aria-label="Close photo viewer"
          onClick={() => dialog.current?.close()}
        >
          <X />
        </button>
        {photo && (
          <div className="">
            <div
              className="grid h-[70dvh] touch-pan-y touch-pinch-zoom place-items-center bg-[#f5f1f3] md:h-[min(75dvh,750px)] [&>img]:size-full [&>img]:object-contain"
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
            <div className="flex items-center justify-between pt-3 pb-[env(safe-area-inset-bottom)] [&_p]:text-xs [&_p]:text-[#a38998] [&>button]:grid [&>button]:size-11 [&>button]:place-items-center [&>button]:rounded-full [&>button]:bg-[#f7f2f5] [&>button]:text-[#a28394]">
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
