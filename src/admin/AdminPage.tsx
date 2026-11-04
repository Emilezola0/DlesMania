// The tuning dashboard (#/admin), dev only: App.tsx adds its route only under `npm run dev`, and the API it
// talks to (scripts/admin-server.ts) only exists in the dev server. Pick a file, edit it in a form built
// from its schema or its shape, see a preview, save: the file is written in the workspace and Vite
// reloads the running app with it. The files and their rules: schema/admin-files.json.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { checkFile, listFiles, loadFile, saveFile, type AdminRegistry, type Json, type LoadedFile } from './api';
import { JsonEditor, setIn, type EditorCtx, type Path } from './JsonEditor';
import { Preview, PreviewBoundary } from './Previews';

/** Unsaved drafts survive the reloads a save of another file causes (same tab only). */
const draftKey = (id: string) => `omnidle-admin:draft:${id}`;
const store = {
  read(id: string): { version: string; data: Json } | null {
    try {
      return JSON.parse(sessionStorage.getItem(draftKey(id)) ?? 'null');
    } catch {
      return null;
    }
  },
  write(id: string, version: string, data: Json | null) {
    try {
      if (data === null) sessionStorage.removeItem(draftKey(id));
      else sessionStorage.setItem(draftKey(id), JSON.stringify({ version, data }));
    } catch {
      /* storage full or blocked: the draft just won't survive a reload */
    }
  },
};
/** "Saved …", carried over the reload or remount the save causes. */
const FLASH = 'omnidle-admin:flash';
const takeFlash = () => {
  try {
    const text = sessionStorage.getItem(FLASH);
    sessionStorage.removeItem(FLASH);
    return text;
  } catch {
    return null;
  }
};

const btn = 'rounded-md border border-rule px-3 py-1.5 text-sm font-semibold disabled:opacity-40';

export default function AdminPage() {
  const [registry, setRegistry] = useState<AdminRegistry | null>(null);
  const [params, setParams] = useSearchParams();
  const id = params.get('file') ?? 'economy';
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [draft, setDraft] = useState<Json | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad' | 'info'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const flash = takeFlash();
    if (flash) setStatus({ tone: 'ok', text: flash });
  }, []);

  useEffect(() => {
    listFiles().then(setRegistry, (e: Error) => setStatus({ tone: 'bad', text: `The admin API isn't answering (${e.message}). It only runs under npm run dev.` }));
  }, []);

  const open = useCallback((fileId: string) => {
    setFile(null);
    setErrors([]);
    loadFile(fileId).then(
      (f) => {
        const kept = store.read(fileId);
        setFile(f);
        if (kept && kept.version === f.version) {
          setDraft(kept.data);
          setStatus({ tone: 'info', text: 'Unsaved draft restored.' });
        } else {
          if (kept) store.write(fileId, '', null);
          setDraft(f.data);
        }
      },
      (e: Error) => setStatus({ tone: 'bad', text: e.message }),
    );
  }, []);
  useEffect(() => open(id), [id, open]);

  const dirty = useMemo(() => !!file && draft !== null && JSON.stringify(draft) !== JSON.stringify(file.data), [file, draft]);

  // The server's own checks, live, a moment after each change.
  useEffect(() => {
    if (!file || draft === null || file.entry.policy === 'read-only') return;
    if (!dirty) return setErrors([]);
    const t = setTimeout(() => checkFile(file.entry.id, draft, file.version).then(setErrors, (e: Error) => setErrors([`/: ${e.message}`])), 300);
    return () => clearTimeout(t);
  }, [file, draft, dirty]);

  const errorMap = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const e of errors) {
      const at = e.indexOf(': ');
      const ptr = e.startsWith('/') && at > 0 ? e.slice(0, at) : '/';
      m.set(ptr, [...(m.get(ptr) ?? []), at > 0 ? e.slice(at + 2) : e]);
    }
    return m;
  }, [errors]);

  const edit = useCallback(
    (path: Path, value: Json | undefined) =>
      setDraft((d) => {
        const next = setIn(d, path, value);
        if (file) store.write(file.entry.id, file.version, next);
        return next;
      }),
    [file],
  );

  const save = useCallback(async () => {
    if (!file || draft === null || !dirty || saving) return;
    setSaving(true);
    try {
      const r = await saveFile(file.entry.id, draft, file.version);
      store.write(file.entry.id, '', null);
      const text = `Saved ${file.entry.file}. The app reloads with it.`;
      sessionStorage.setItem(FLASH, text);
      setFile({ ...file, data: draft, version: r.version ?? file.version });
      setStatus({ tone: 'ok', text });
    } catch (e) {
      const err = e as Error & { errors?: string[]; status?: number };
      if (err.errors) setErrors(err.errors);
      setStatus({ tone: 'bad', text: err.message });
    } finally {
      setSaving(false);
    }
  }, [file, draft, dirty, saving]);

  // Ctrl+S / Cmd+S saves.
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') (e.preventDefault(), saveRef.current());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const revert = () => {
    if (!file) return;
    store.write(file.entry.id, '', null);
    setDraft(file.data);
    setErrors([]);
    setStatus({ tone: 'info', text: 'Draft discarded.' });
  };

  const ctx: EditorCtx | null =
    file && draft !== null ? { root: draft, saved: file.data, policy: file.entry.policy ?? 'edit', errors: errorMap, set: edit } : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">
          Admin <span className="rounded bg-coral px-1.5 py-0.5 align-middle text-xs font-bold text-on-strong">DEV ONLY</span>
        </h1>
        <p className="text-xs text-ink-faint">Edits are written to the workspace files; the dev server reloads the app. Never in a build.</p>
      </header>

      {registry && (
        <nav className="flex flex-wrap gap-4">
          {registry.sections.map((s) => (
            <div key={s.id} className="space-y-1">
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-ink-faint">
                {s.icon} {s.title}
              </h2>
              <div className="flex flex-wrap gap-1">
                {registry.files
                  .filter((f) => f.section === s.id)
                  .map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setParams({ file: f.id })}
                      className={`rounded-md px-2 py-1 text-sm ${f.id === id ? 'bg-accent text-on-strong' : 'bg-tile text-ink hover:bg-tile-strong'}`}
                    >
                      {f.title}
                      {f.policy && f.policy !== 'edit' && <span className="ml-1 text-xs opacity-70">{f.policy === 'read-only' ? '🔒' : '➕'}</span>}
                    </button>
                  ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      {status && (
        <p role="status" className={`rounded-md px-3 py-2 text-sm ${status.tone === 'ok' ? 'bg-hit/15 text-ink' : status.tone === 'bad' ? 'bg-miss/15 font-semibold text-miss' : 'bg-tile text-ink-soft'}`}>
          {status.text}
        </p>
      )}

      {file && ctx && draft !== null && (
        <>
          <div className="page sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md p-3">
            <div className="mr-auto min-w-0">
              <p className="font-display font-bold">{file.entry.title}</p>
              <p className="truncate font-mono text-xs text-ink-faint">
                {file.entry.file}
                {file.entry.schema ? ` · schema ${file.entry.schema}` : ' · no schema: shape kept'}
              </p>
            </div>
            {errors.length > 0 && <span className="text-sm font-semibold text-miss">{errors.length} problem(s)</span>}
            {dirty && !errors.length && <span className="text-sm text-ink-soft">Unsaved changes</span>}
            {file.entry.policy !== 'read-only' && (
              <>
                <button type="button" className={btn} disabled={!dirty} onClick={revert}>
                  Revert
                </button>
                <button type="button" className={`${btn} bg-accent text-on-strong`} disabled={!dirty || errors.length > 0 || saving} onClick={save} title="Ctrl+S">
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </>
            )}
          </div>
          {file.entry.note && <p className="rounded-md bg-tile px-3 py-2 text-sm text-ink-soft">{file.entry.note}</p>}
          {errorMap.get('/') && <p className="text-sm font-semibold text-miss">{errorMap.get('/')!.join(' · ')}</p>}
          <div className={`grid gap-4 ${file.entry.preview && file.entry.preview !== 'images' ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]' : ''}`}>
            <div className="page min-w-0 rounded-md p-3">
              <JsonEditor value={draft} schema={file.schema} ctx={ctx} />
            </div>
            {file.entry.preview && file.entry.preview !== 'images' && (
              <aside className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start">
                <PreviewBoundary key={JSON.stringify(draft).length + id}>
                  <Preview kind={file.entry.preview} data={draft} />
                </PreviewBoundary>
              </aside>
            )}
          </div>
        </>
      )}
      {!file && !status && <p className="text-sm text-ink-faint">Loading…</p>}
    </div>
  );
}
