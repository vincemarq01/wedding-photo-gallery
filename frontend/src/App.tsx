import { useRef, useState } from "react";
import { useMemories } from "./hooks/useMemories";
import { usePathname } from "./hooks/usePathname";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import PrintCard from "./pages/PrintCard";
import AlbumPage from "./pages/AlbumPage";
import { AppLink } from "./components/AppLink";
import {
  Camera,
  ArrowRight,
  CheckCircle2,
  Heart,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Upload,
  Video,
  X,
} from "lucide-react";
import { Button } from "./components/ui/button";
import type { Memory } from "./types";
import { authorize, upload } from "./services/upload";
import { USE_APPS_SCRIPT, MAX_SOURCE_BYTES } from "./services/appsScript";
const schema = z.object({
  guestName: z.string().trim().max(80, "Please use 80 characters or fewer."),
});
const supported = /\.(jpe?g|png|webp|heic|heif|mp4|mov)$/i;
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
  if (pathname === "/print") return <PrintCard />;
  if (pathname.replace(/\/$/, "") === "/album") return <AlbumPage />;
  function add(files: FileList | null) {
    if (!files || busy) return;
    const messages: string[] = [];
    const next = [...latest.current];
    for (const file of Array.from(files)) {
      if (
        !(USE_APPS_SCRIPT ? /\.(jpe?g|png|webp|heic|heif)$/i : supported).test(
          file.name,
        )
      ) {
        messages.push(`${file.name}: choose a supported photo or video.`);
        continue;
      }
      if (
        !file.size ||
        file.size > (USE_APPS_SCRIPT ? MAX_SOURCE_BYTES : 2 * 1024 ** 3)
      ) {
        messages.push(
          `${file.name}: choose a photo up to ${USE_APPS_SCRIPT ? "10 MB" : "2 GB"}.`,
        );
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
      if (next.length >= 50) {
        messages.push("Please share up to 50 memories at a time.");
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
        Array.from(
          { length: Math.min(USE_APPS_SCRIPT ? 1 : 2, pending.length) },
          async () => {
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
                if (
                  e instanceof Error &&
                  /authorization expired/.test(e.message)
                )
                  setBatch("");
                patch(item.id, {
                  status: "failed",
                  error: e instanceof Error ? e.message : "Please retry.",
                });
              }
            }
          },
        ),
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
    <main className="simple-page">
      <header className="simple-header">
        <div className="header-mark">
          <Heart size={20} strokeWidth={1.5} />
        </div>
        <h1>
          Vince <span>&</span> Emy
        </h1>
        <p>Share a little of our special day.</p>
      </header>
      <section id="share">
        <form onSubmit={handleSubmit(submit)} className="upload-card">
          <div className="upload-heading">
            <span className="upload-heading-icon">
              <Camera size={20} />
            </span>
            <div>
              <h2>Add your memories</h2>
              <p>
                {USE_APPS_SCRIPT
                  ? "A photo, a little moment."
                  : "A photo, a video, a little moment."}
              </p>
            </div>
          </div>
          <label className="name-label" htmlFor="guest">
            Your name <span>(optional)</span>
          </label>
          <input
            id="guest"
            className="name-input"
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
            disabled={busy}
            {...register("guestName")}
          />
          {errors.guestName && (
            <p role="alert" className="error">
              {errors.guestName.message}
            </p>
          )}
          <input
            ref={input}
            type="file"
            className="sr-only"
            multiple
            accept={
              USE_APPS_SCRIPT
                ? ".jpg,.jpeg,.png,.webp,.heic,.heif"
                : ".jpg,.jpeg,.png,.webp,.heic,.heif,.mp4,.mov"
            }
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
            accept={USE_APPS_SCRIPT ? "image/*" : "image/*,video/*"}
            capture="environment"
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
            disabled={busy}
          />
          <div
            className={"dropzone " + (drag ? "drag" : "")}
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
            <span className="drop-icon">
              <ImagePlus size={28} strokeWidth={1.3} />
            </span>
            <h3>Your moments belong here</h3>
            <p className="picker-hint">
              {USE_APPS_SCRIPT
                ? "Pick photos from your gallery."
                : "Pick photos & videos from your gallery."}
            </p>
            <Button
              variant="outline"
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Plus size={18} />{" "}
              {USE_APPS_SCRIPT ? "Choose photos" : "Choose photos & videos"}
            </Button>
            <button
              type="button"
              className="camera-link"
              onClick={() => camera.current?.click()}
              disabled={busy}
            >
              <Camera size={16} /> Take a photo
            </button>
            <small>
              {USE_APPS_SCRIPT
                ? "JPG, PNG, WebP & HEIC · Up to 10 MB per photo. Large photos are compressed."
                : "JPG, PNG, WebP, HEIC, MP4 & MOV · Up to 2 GB per file"}
            </small>
          </div>
          {pending.length > 0 && (
            <div className="file-section">
              <h4>
                Selected files <span>{pending.length}</span>
              </h4>
              {pending.map((i) => (
                <div className="file-row" key={i.id}>
                  {i.preview ? (
                    <img src={i.preview} alt="Selected memory preview" />
                  ) : (
                    <div className="file-placeholder">
                      {/\.(mp4|mov)$/i.test(i.file.name) ? (
                        <Video />
                      ) : (
                        <Camera />
                      )}
                    </div>
                  )}
                  <div className="file-detail">
                    <strong>{i.file.name}</strong>
                    <small>
                      {format(i.file.size)} ·{" "}
                      {i.status === "uploading"
                        ? USE_APPS_SCRIPT
                          ? "Uploading..."
                          : `${i.progress}% uploaded`
                        : i.status === "failed"
                          ? "Ready to retry"
                          : "Ready to share"}
                    </small>
                    {i.status === "uploading" && !USE_APPS_SCRIPT && (
                      <progress
                        max={100}
                        value={i.progress}
                        aria-label={`Uploading ${i.file.name}`}
                      />
                    )}{" "}
                    {i.error && <p className="error">{i.error}</p>}
                  </div>
                  <button
                    type="button"
                    className="remove"
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
          {notice && (
            <p role="alert" className="notice">
              {notice}
            </p>
          )}
          {pending.length > 0 && (
            <Button
              className="upload-button"
              disabled={busy || !pending.length}
              type="submit"
            >
              {busy ? (
                <LoaderCircle size={18} className="spin" />
              ) : (
                <Upload size={18} />
              )}{" "}
              {busy
                ? "Uploading..."
                : pending.some((i) => i.status === "failed")
                  ? "Retry upload"
                  : pending.length
                    ? `Upload ${pending.length} ${pending.length === 1 ? "file" : "files"}`
                    : "Upload photos"}
            </Button>
          )}
          <p className="privacy">
            <LockKeyhole size={12} /> Visible to everyone visiting this page. No
            account needed.
          </p>
          {success.length > 0 && (
            <div className="thank-you" role="status">
              <CheckCircle2 size={18} />
              <span>
                {success.length} {success.length === 1 ? "file" : "files"}{" "}
                uploaded. Thank you!
              </span>
              <AppLink
                href="/album"
                disabled={busy}
                className="success-album-link"
              >
                View album <ArrowRight size={15} />
              </AppLink>
            </div>
          )}
        </form>
      </section>
      <Button asChild variant="outline" className="view-album-button">
        <AppLink href="/album" disabled={busy}>
          <ImagePlus size={18} />
          View album
          <ArrowRight size={16} />
        </AppLink>
      </Button>
      <footer>
        <span>With love, Vince & Emy</span>
        <a href="/print">QR card</a>
      </footer>
    </main>
  );
}
