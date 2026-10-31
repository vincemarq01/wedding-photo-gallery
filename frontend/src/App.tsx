import { useRef, useState } from "react";
import { useMemories } from "./hooks/useMemories";
import { usePathname } from "./hooks/usePathname";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import HomePage from "./pages/HomePage";
import BottomNav from "./components/BottomNav";
import PrintCard from "./pages/PrintCard";
import AlbumPage from "./pages/AlbumPage";
import { AppLink } from "./components/AppLink";
import {
  ArrowLeft,
  Camera,
  ArrowRight,
  CheckCircle2,
  Heart,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Upload,
  X,
} from "lucide-react";
import { Button } from "./components/ui/button";
import type { Memory } from "./types";
import { authorize, upload } from "./services/upload";
import { MAX_PHOTO_BYTES, MAX_BATCH_FILES } from "./services/config";
const schema = z.object({
  guestName: z.string().trim().max(80, "Please use 80 characters or fewer."),
});
const supported = /\.(jpe?g|png|webp|heic|heif)$/i;
const format = (n: number) =>
  n >= 1024 ** 3
    ? (n / 1024 ** 3).toFixed(1) + " GB"
    : (n / 1024 ** 2).toFixed(1) + " MB";
export default function App() {
  const pathname = usePathname();
  const { items, setItems, latest } = useMemories();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [batch, setBatch] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { guestName: "" },
  });
  if (pathname === "/" && window.location.hash !== "#share")
    return <HomePage />;
  if (pathname === "/print") return <PrintCard />;
  if (pathname.replace(/\/$/, "") === "/album") return <AlbumPage />;
  function add(files: FileList | null) {
    if (!files || busy) return;
    const messages: string[] = [];
    const next = [...latest.current];
    for (const file of Array.from(files)) {
      if (!supported.test(file.name)) {
        messages.push(`${file.name}: choose JPG, PNG, WebP or HEIC photos.`);
        continue;
      }
      if (!file.size || file.size > MAX_PHOTO_BYTES) {
        messages.push(`${file.name}: choose a photo up to 10 MB.`);
        continue;
      }
      if (
        next.some(
          (i) =>
            i.file.name === file.name &&
            i.file.size === file.size &&
            i.file.lastModified === file.lastModified,
        )
      )
        continue;
      if (
        next.filter((item) => item.status !== "success").length >=
        MAX_BATCH_FILES
      ) {
        messages.push(
          "Please share up to 20 photos per batch. You can add more after uploading.",
        );
        break;
      }
      next.push({
        id: crypto.randomUUID(),
        file,
        preview:
          file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name)
            ? URL.createObjectURL(file)
            : undefined,
        status: "ready",
        progress: 0,
      });
    }
    latest.current = next;
    setItems(next);
    setNotice(messages.join(" "));
  }
  function patch(id: string, data: Partial<Memory>) {
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...data } : i)));
  }
  async function submit({ guestName }: { guestName: string }) {
    if (
      running.current ||
      !items.some((item) => item.status === "ready" || item.status === "failed")
    )
      return;
    running.current = true;
    setBusy(true);
    setNotice("");
    try {
      let access = batch;
      if (!access) {
        access = await authorize();
        setBatch(access);
      }
      const pending = items.filter(
        (i) => i.status === "ready" || i.status === "failed",
      );
      let cursor = 0;
      await Promise.all(
        Array.from({ length: Math.min(2, pending.length) }, async () => {
          while (cursor < pending.length) {
            const item = pending[cursor++];
            patch(item.id, { status: "uploading", error: undefined });
            try {
              await upload(
                item,
                guestName,
                access,
                (s) => patch(item.id, { session: s }),
                (n) => patch(item.id, { progress: n }),
              );
              patch(item.id, { status: "success", progress: 100 });
            } catch (e) {
              if (e instanceof Error && /authorization expired/.test(e.message))
                setBatch("");
              patch(item.id, {
                status: "failed",
                error: e instanceof Error ? e.message : "Please retry.",
              });
            }
          }
        }),
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Please try again.");
      setBatch("");
    } finally {
      setBusy(false);
      running.current = false;
    }
  }
  const success = items.filter((i) => i.status === "success");
  const pending = items.filter((i) => i.status !== "success");
  return (
    <main className="relative mx-auto min-h-dvh max-w-[480px] bg-[#fff9f6] pb-[90px] md:my-8 md:min-h-[calc(100dvh-64px)] md:w-[calc(100%-64px)] md:max-w-[1200px] md:rounded-3xl md:border md:border-[#efdfda] md:shadow-[0_16px_70px_#a77e7212] px-6 md:grid md:grid-cols-[minmax(230px,.8fr)_minmax(0,1.2fr)] md:grid-rows-[80px_auto_auto_1fr_auto] md:gap-x-10 md:px-9 md:pb-0 [&>section]:md:col-start-2 [&>section]:md:row-start-2 [&>section]:md:row-end-5 [&>section]:md:py-10">
      <nav
        className="flex items-center justify-between pt-3 text-[15px] font-medium md:col-span-2 md:h-20 md:justify-start md:gap-3.5 md:border-b md:border-[#f0dfda] md:pt-0 md:pr-[360px] [&>a]:-ml-3 [&>a]:grid [&>a]:size-10 [&>a]:place-items-center [&>svg]:text-[#d08285] md:[&>svg]:hidden"
        aria-label="Upload navigation"
      >
        <AppLink href="/" disabled={busy} aria-label="Back to home">
          <ArrowLeft size={20} />
        </AppLink>
        <span>Upload Memories</span>
        <Heart size={21} strokeWidth={1.4} />
      </nav>
      <header className="pt-[17px] pb-[22px] text-center md:col-start-1 md:row-start-2 md:self-end md:pt-[85px] md:pb-6 md:text-left [&>h1]:font-script [&>h1]:text-[56px] [&>h1]:leading-[1.15] [&>h1]:text-[#bf8682] md:[&>h1]:text-[clamp(54px,5.5vw,78px)] [&>h1_span]:text-[#bb8796] [&>p]:mt-1 [&>p]:text-[8px] [&>p]:tracking-[3px] [&>p]:text-[#b08787] md:[&>p]:mt-[18px] md:[&>p]:text-[10px] md:[&>p]:leading-loose">
        <div className="hidden">
          <Heart size={20} strokeWidth={1.5} />
        </div>
        <h1>
          Vince <span>&</span> Emyreen
        </h1>
        <p>YOUR PHOTOS. OUR FOREVER.</p>
      </header>
      <section id="share">
        <form
          onSubmit={handleSubmit(submit)}
          className="md:rounded-[22px] md:border md:border-[#efdfda] md:bg-[#fffdfb] md:p-6 md:shadow-[0_12px_40px_#9a706608]"
        >
          <input
            ref={input}
            type="file"
            className="sr-only"
            multiple
            accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
            disabled={busy}
          />
          <input
            ref={camera}
            type="file"
            className="sr-only"
            accept="image/*"
            capture="environment"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
            disabled={busy}
          />
          <div
            className={
              "rounded-[17px] border border-dashed px-3.5 pt-6 pb-4 text-center md:px-4 md:pt-9 md:pb-6 [&>h3]:text-sm [&>h3]:font-semibold md:[&>h3]:text-base [&>small]:block [&>small]:text-[9px] [&>small]:leading-loose [&>small]:text-[#aa898b] [&>button:nth-of-type(2)]:min-h-9 [&>button:nth-of-type(2)]:rounded-full [&>button:nth-of-type(2)]:border-[#ecc4c5] [&>button:nth-of-type(2)]:bg-[#fffbf8] [&>button:nth-of-type(2)]:px-5 [&>button:nth-of-type(2)]:py-2 [&>button:nth-of-type(2)]:text-xs [&>button:nth-of-type(2)]:text-[#ae6f77] md:[&>button:nth-of-type(2)]:min-h-11 " +
              (drag
                ? "border-[#a56f7f] bg-[#f9edf1]"
                : "border-[#e9acb1] bg-linear-to-br from-[#fff0ef] to-[#fce8e8]")
            }
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
          >
            <button
              type="button"
              className="mx-auto mb-3 grid size-[59px] place-items-center rounded-full border-0 bg-[#ffe0e3] text-[#d97e8c]"
              aria-label="Choose photos"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Upload size={28} strokeWidth={1.3} />
            </button>
            <h3>Tap to upload or drag and drop</h3>
            <p className="mt-1 mb-3 text-xs text-[#a17f80] md:text-[13px]">
              Every little moment is welcome!
            </p>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Plus size={18} /> Choose photos
            </Button>
            <button
              type="button"
              className="mx-auto my-1 flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-4 text-[11px] text-[#8d6576] hover:bg-[#f3e7ec]"
              onClick={() => camera.current?.click()}
              disabled={busy}
            >
              <Camera size={16} /> Take a photo
            </button>
            <small>
              Original quality · JPG, PNG, WebP & HEIC · Up to 10 MB per photo
            </small>
          </div>
          {pending.length > 0 && (
            <div className="my-3.5 grid grid-cols-3 gap-2.5 [&>h4]:col-span-full [&>h4]:mt-3 [&>h4]:text-[13px] [&>h4]:font-medium [&>h4_span]:text-[#a97e8a]">
              <h4>
                Selected files <span>{pending.length}</span>
              </h4>
              {pending.map((i) => (
                <div
                  className="relative flex min-w-0 flex-col gap-1 pb-2 [&>img]:aspect-[1.2] [&>img]:w-full [&>img]:rounded-[10px] [&>img]:object-cover"
                  key={i.id}
                >
                  {i.preview ? (
                    <img src={i.preview} alt="Selected memory preview" />
                  ) : (
                    <div className="grid aspect-[1.2] w-full place-items-center rounded-[10px] bg-[#f8eff2] text-[#b68e9a] [&>svg]:size-5">
                      <Camera />
                    </div>
                  )}
                  <div className="w-full min-w-0 [&>strong]:block [&>strong]:truncate [&>strong]:text-[10px] [&>strong]:font-medium [&>small]:text-[9px] [&>small]:text-[#8e7983] [&>progress]:mt-2 [&>progress]:block [&>progress]:h-[5px] [&>progress]:w-full [&>progress]:accent-[#a87584]">
                    <strong>{i.file.name}</strong>
                    <small>
                      {format(i.file.size)} ·{" "}
                      {i.status === "uploading"
                        ? `${i.progress}% uploaded`
                        : i.status === "failed"
                          ? "Ready to retry"
                          : "Ready to share"}
                    </small>
                    {i.status === "uploading" && (
                      <progress
                        max={100}
                        value={i.progress}
                        aria-label={`Uploading ${i.file.name}`}
                      />
                    )}{" "}
                    {i.error && (
                      <p className="mt-2 text-xs leading-relaxed wrap-anywhere text-[#a3445b]">
                        {i.error}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border-[3px] border-[#fff9f6] bg-[#785957e6] p-1.5 text-white hover:bg-[#976e82]"
                    aria-label={"Remove " + i.file.name}
                    disabled={busy}
                    onClick={() => {
                      i.preview && URL.revokeObjectURL(i.preview);
                      setItems((all) => all.filter((a) => a.id !== i.id));
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label
            className="mt-[22px] mb-2 block text-xs font-medium [&>span]:text-[11px] [&>span]:font-normal [&>span]:text-[#96838b]"
            htmlFor="guest"
          >
            Your name <span>(optional)</span>
          </label>
          <input
            id="guest"
            className="min-h-12 w-full rounded-xl border border-[#ecdcda] bg-[#fffaf9] px-3.5 py-3 text-base outline-[#a4727d] placeholder:text-sm placeholder:text-[#a6939c]"
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
            disabled={busy}
            {...register("guestName")}
          />
          {errors.guestName && (
            <p
              role="alert"
              className="mt-2 text-xs leading-relaxed wrap-anywhere text-[#a3445b]"
            >
              {errors.guestName.message}
            </p>
          )}
          {notice && (
            <p
              role="alert"
              className="mt-2 text-xs leading-relaxed wrap-anywhere text-[#a3445b]"
            >
              {notice}
            </p>
          )}
          {(pending.length > 0 || !success.length) && (
            <Button
              className="mt-[22px] min-h-[50px] w-full rounded-full bg-linear-to-r from-[#df9792] to-[#d97d88] p-3 text-sm font-medium text-white disabled:from-[#e9bcc0] disabled:to-[#e9bcc0] disabled:text-[#fffaf9] disabled:opacity-100"
              disabled={busy || !pending.length}
              type="submit"
            >
              {busy ? (
                <LoaderCircle
                  size={18}
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Upload size={18} />
              )}{" "}
              {busy
                ? "Uploading..."
                : pending.some((i) => i.status === "failed")
                  ? "Retry upload"
                  : pending.length
                    ? `Upload to Album (${pending.length})`
                    : "Upload to Album"}
            </Button>
          )}
          <p className="mx-auto mt-3 flex max-w-[340px] items-baseline justify-center gap-1 text-center text-[10px] leading-loose text-[#8f7b84] [&>svg]:relative [&>svg]:top-0.5 [&>svg]:shrink-0">
            <LockKeyhole size={12} /> Visible to everyone visiting this page. No
            account needed.
          </p>
          {success.length > 0 && (
            <div
              className="mt-4 flex min-h-12 flex-wrap items-center gap-2 rounded-[10px] bg-[#f0f6f0] p-3 text-xs text-[#648567] [&>svg]:shrink-0"
              role="status"
            >
              <CheckCircle2 size={18} />
              <span>
                {success.length} {success.length === 1 ? "file" : "files"}{" "}
                uploaded. Thank you!
              </span>
              <AppLink
                href="/album"
                disabled={busy}
                className="ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 font-medium"
              >
                View album <ArrowRight size={15} />
              </AppLink>
            </div>
          )}
        </form>
      </section>
      <Button
        asChild
        variant="outline"
        className="mt-4 flex min-h-[50px] w-full rounded-full border-[#eed9d7] bg-transparent text-sm text-[#ae7c80] md:col-start-1 md:row-start-3 md:mt-0 md:max-w-[290px] md:self-start [&>svg:last-child]:ml-auto [&>svg:first-child]:mr-auto"
      >
        <AppLink href="/album" disabled={busy}>
          <ImagePlus size={18} />
          View album
          <ArrowRight size={16} />
        </AppLink>
      </Button>
      <BottomNav active="upload" disabled={busy} />
      <footer className="flex items-center justify-between py-6 text-[10px] text-[#96808b] md:col-span-full md:row-start-5 md:border-t md:border-[#f0dfda] [&>a]:inline-flex [&>a]:min-h-11 [&>a]:items-center [&>a]:pl-4 [&>a]:text-[#8e6379]">
        <span>With love, Vince & Emy</span>
        <a href="/print">QR card</a>
      </footer>
    </main>
  );
}
