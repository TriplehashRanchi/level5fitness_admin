"use client";

import { useRef, useState } from "react";
import { api, messageOf } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import AdminOnly from "@/components/admin-only";
import { ListTable } from "@/components/table";
import { Alert, Badge, Button, ConfirmDialog, Field, Input, Modal, PageHeader, PageSpinner, Textarea } from "@/components/ui";

const BLANK = { displayName: "", text: "", programmeDay: "", video: null };
const MAX_VIDEO_MB = 50;
/** Some systems give a video no type, so the file's ending decides then. */
const videoType = (file) => file.type || (/\.mov$/i.test(file.name) ? "video/quicktime" : /\.mp4$/i.test(file.name) ? "video/mp4" : "");
const day = (d) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));

/** The story's video, from a short-lived address. */
function VideoPreview({ id }) {
  const { data, error } = useApi(`/stories/${id}/video`);
  if (error) return <Alert>{messageOf(error)}</Alert>;
  if (!data) return <PageSpinner label="Loading the video…" />;
  return <video src={data.url} controls preload="metadata" className="max-h-80 w-full rounded-2xl bg-black" />;
}

function Stories() {
  const { data, error, reload } = useApi("/admin/stories");
  const [open, setOpen] = useState(null);
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState(null);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  /** The file already in storage, so that trying again after a refused form does not upload it twice. */
  const uploaded = useRef(null);

  /** Sends the file straight to storage and returns its key. */
  const upload = async (file) => {
    if (uploaded.current?.file === file) return uploaded.current.key;
    const started = await api("/admin/stories/video", { method: "POST", body: { contentType: videoType(file), size: file.size } });
    const res = await fetch(started.uploadUrl, { method: "PUT", headers: started.headers, body: file }).catch(() => null);
    if (!res?.ok) throw new Error("The video could not be uploaded. Check your connection and try again.");
    uploaded.current = { file, key: started.key };
    return started.key;
  };

  /** Sends a change, then closes the dialog and reads the list again. A failure is said in the dialog. */
  const send = async (path, options, close) => {
    setBusy(true);
    setProblem(null);
    try {
      await api(path, options);
      close(null);
      reload();
    } catch (e) {
      setProblem(messageOf(e));
    } finally {
      setBusy(false);
      setDeleting(false);
    }
  };
  const add = async (e) => {
    e.preventDefault();
    const { video, ...words } = form;
    setBusy(true);
    setProblem(null);
    let videoKey = null;
    try {
      if (video) videoKey = await upload(video);
    } catch (err) {
      setProblem(err.status === undefined ? err.message : messageOf(err));
      setBusy(false);
      return;
    }
    send("/admin/stories", { method: "POST", body: { ...words, programmeDay: words.programmeDay ? Number(words.programmeDay) : null, videoKey } }, setForm);
  };

  const columns = [
    { key: "name", header: "Name", sort: (s) => s.name, cell: (s) => <p className="font-medium text-white">{s.name}</p> },
    { key: "text", header: "Testimonial", cell: (s) => <p className="max-w-md truncate">{s.text}</p> },
    { key: "video", header: "Video", nowrap: true, sort: (s) => Number(s.hasVideo), cell: (s) => (s.hasVideo ? <Badge tone="brand">Video</Badge> : "–") },
    { key: "added", header: "Added", nowrap: true, sort: (s) => s.addedAt, cell: (s) => day(s.addedAt) },
    { key: "cheers", header: "Cheers", nowrap: true, sort: (s) => s.cheers, cell: (s) => s.cheers },
  ];

  return (
    <>
      <PageHeader
        title="Testimonials"
        subtitle="Testimonials on the app's Home, shown in a row: today's pick first, then the newest, up to 10."
        actions={<Button onClick={() => { setProblem(null); setForm(BLANK); }}>Add testimonial</Button>}
      />
      {error ? <div className="mb-4"><Alert>{messageOf(error)}</Alert></div> : null}
      {!data && !error ? <PageSpinner /> : null}
      {data ? (
        <ListTable
          label="Testimonials" minWidth={720} rows={data.stories} rowKey={(s) => s.id} columns={columns}
          onOpen={(s) => { setProblem(null); setOpen(s); }}
          empty={{ title: "No testimonials yet", text: "Add a testimonial and it appears on the app's Home." }}
        />
      ) : null}
      <Modal
        open={!!open} onClose={() => setOpen(null)} wide title="Testimonial"
        footer={open ? (
          <>
            <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>Close</Button>
            <Button variant="danger" disabled={busy} onClick={() => setDeleting(true)}>Delete</Button>
          </>
        ) : null}
      >
        {open ? (
          <div className="space-y-4">
            {open.hasVideo ? <VideoPreview id={open.id} /> : null}
            <p className="text-base leading-7 text-white">“{open.text}”</p>
            <p className="text-sm text-muted">
              Shown as <span className="font-semibold text-white">{open.name}</span>
              {open.programmeDay ? `, on day ${open.programmeDay} of their journey` : ""}.
            </p>
            {problem ? <Alert>{problem}</Alert> : null}
          </div>
        ) : null}
      </Modal>
      <Modal
        open={!!form} onClose={() => { if (!busy) setForm(null); }} wide title="Add testimonial"
        footer={
          <>
            <Button variant="secondary" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
            <Button type="submit" form="story-form" loading={busy}>Add testimonial</Button>
          </>
        }
      >
        {form ? (
          <form id="story-form" onSubmit={add} className="space-y-4">
            <Field label="Name shown in the app" hint="A first name or nickname, 2 to 24 letters or numbers."><Input value={form.displayName} onChange={(e) => set("displayName", e.target.value)} minLength={2} maxLength={24} required autoFocus /></Field>
            <Field label="Testimonial" hint={`${form.text.length}/280. At least 20 characters, without links or phone numbers.`}><Textarea rows={4} value={form.text} onChange={(e) => set("text", e.target.value)} minLength={20} maxLength={280} required /></Field>
            <Field label="Day of their journey (optional)"><Input inputMode="numeric" value={form.programmeDay} onChange={(e) => set("programmeDay", e.target.value.replace(/\D/g, "").slice(0, 4))} /></Field>
            <Field label="Video (optional)" hint={`MP4 or MOV, up to ${MAX_VIDEO_MB} MB. MP4 plays on the most phones.`}>
              <Input
                type="file" accept="video/mp4,video/quicktime,.mp4,.mov" disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  const wrong = file && !videoType(file) ? "Choose an MP4 or MOV video." : file && file.size > MAX_VIDEO_MB * 1024 * 1024 ? `The video is larger than ${MAX_VIDEO_MB} MB.` : null;
                  setProblem(wrong);
                  if (wrong) e.target.value = "";
                  set("video", wrong ? null : file);
                }}
              />
            </Field>
            {busy && form.video ? <p role="status" className="text-sm text-brand">Uploading the video. Keep this window open.</p> : null}
            <p className="text-xs leading-5 text-muted">Add only words a real person said and agreed to share. Avoid medical claims and extreme diets. It appears first on Home at once.</p>
            {problem ? <Alert>{problem}</Alert> : null}
          </form>
        ) : null}
      </Modal>
      <ConfirmDialog
        open={deleting} title="Delete this testimonial?" message="It is removed from Home, along with its cheers." confirmLabel="Delete"
        busy={busy} onConfirm={() => send(`/admin/stories/${open.id}`, { method: "DELETE" }, setOpen)} onCancel={() => setDeleting(false)}
      />
    </>
  );
}

export default function StoriesPage() {
  return (
    <AdminOnly>
      <Stories />
    </AdminOnly>
  );
}
