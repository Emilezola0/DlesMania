// A form for any JSON file, built from its JSON Schema where there is one and from the data's own shape
// everywhere else: a new property in a tuning file shows up here with no dashboard code. Numbers get
// number inputs (with the schema's bounds), "#rrggbb" strings a colour picker, picture URLs a thumbnail,
// enums a select, null an offer to fill it the way its siblings are filled.
import { useState, type ReactNode } from 'react';
import type { Json, Schema } from './api';

export type Path = (string | number)[];

export interface EditorCtx {
  root: Json;
  /** The file as saved, for append-only files: what was there is locked. */
  saved: Json;
  policy: 'edit' | 'append-only' | 'read-only';
  /** Problems from the server's checks, by JSON pointer ("/bossWin/hard"). */
  errors: Map<string, string[]>;
  set: (path: Path, value: Json | undefined) => void;
}

const pointer = (path: Path) => (path.length ? `/${path.join('/')}` : '/');
const isObj = (v: unknown): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v);
export const get = (v: Json | undefined, path: Path): Json | undefined => path.reduce<Json | undefined>((o, k) => (o == null || typeof o !== 'object' ? undefined : (o as Record<string, Json>)[k as string]), v);

const COLOR = /^#[0-9a-f]{6}$/i;
const PICTURE = /^(https?:\/\/|\.?\/|art\/).+\.(png|jpe?g|gif|webp|svg|avif)(\?.*|\/revision\/.*)?$|\/images\/.+\.(png|jpe?g|gif|webp|svg)/i;

/** "bossWin" → "Boss win", "longMissions" → "Long missions". */
const humanize = (k: string | number) => {
  const s = String(k).replace(/[-_]/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const childSchema = (s: Schema | undefined, k: string | number): Schema | undefined =>
  s?.properties?.[k as string] ?? (typeof s?.additionalProperties === 'object' ? s.additionalProperties : undefined) ?? s?.items;

/** A blank value of the same shape: for a new entry copied from an existing one. */
function blankLike(v: Json): Json {
  if (typeof v === 'string') return COLOR.test(v) ? v : '';
  if (Array.isArray(v)) return v.map(blankLike);
  if (isObj(v)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, blankLike(x)]));
  return v;
}

/** A value built from a schema alone (for a new entry when there's nothing to copy). */
function fromSchema(s: Schema | undefined): Json {
  if (!s) return '';
  if (s.enum) return s.enum[0];
  if (s.type === 'object') return Object.fromEntries((s.required ?? Object.keys(s.properties ?? {})).map((k) => [k, fromSchema(s.properties?.[k])]));
  if (s.type === 'array') return Array.from({ length: s.minItems ?? 0 }, () => fromSchema(s.items));
  if (s.type === 'number' || s.type === 'integer') return s.minimum ?? 0;
  if (s.type === 'boolean') return false;
  return s['x-widget'] === 'color' ? '#000000' : '';
}

/** What the same key holds in the sibling entries ("hard.secondLoop" → "easy.secondLoop", "hell.secondLoop"…). */
function siblings(root: Json, path: Path): Json[] {
  if (path.length < 2) return [];
  const gp = get(root, path.slice(0, -2));
  const key = path[path.length - 1];
  if (!gp || typeof gp !== 'object') return [];
  return Object.entries(gp)
    .filter(([k]) => k !== String(path[path.length - 2]))
    .map(([, v]) => get(v, [key]))
    .filter((v): v is Json => v !== undefined);
}

function locked(ctx: EditorCtx, path: Path) {
  if (ctx.policy === 'read-only') return true;
  return ctx.policy === 'append-only' && get(ctx.saved, path) !== undefined;
}

const input = 'w-full rounded border border-rule bg-card px-2 py-1 text-sm text-ink disabled:opacity-60';
const smallBtn = 'rounded border border-rule px-1.5 py-0.5 text-xs text-ink-soft hover:bg-tile disabled:opacity-40';

export function JsonEditor({ value, schema, ctx }: { value: Json; schema: Schema | null; ctx: EditorCtx }) {
  return <Node path={[]} value={value} schema={schema ?? undefined} ctx={ctx} depth={0} />;
}

function Errors({ ctx, path }: { ctx: EditorCtx; path: Path }) {
  const list = ctx.errors.get(pointer(path));
  if (!list?.length) return null;
  return <p className="text-xs font-semibold text-miss">{list.join(' · ')}</p>;
}

function Row({ label, hint, children, path, ctx, onRemove }: { label: ReactNode; hint?: string; children: ReactNode; path: Path; ctx: EditorCtx; onRemove?: () => void }) {
  const bad = ctx.errors.has(pointer(path));
  return (
    <div className={`grid grid-cols-[minmax(7rem,12rem)_1fr_auto] items-start gap-2 py-1 ${bad ? 'rounded bg-miss/10' : ''}`}>
      <label className="pt-1 text-sm font-semibold text-ink" title={pointer(path)}>
        {label}
        {hint && <span className="block text-xs font-normal text-ink-faint">{hint}</span>}
      </label>
      <div className="min-w-0 space-y-1">
        {children}
        <Errors ctx={ctx} path={path} />
      </div>
      {onRemove ? (
        <button type="button" className={smallBtn} onClick={onRemove} title="Remove">
          ✕
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

function Node({ path, value, schema, ctx, depth, label, onRemove }: { path: Path; value: Json; schema?: Schema; ctx: EditorCtx; depth: number; label?: ReactNode; onRemove?: () => void }) {
  const name = label ?? schema?.title ?? humanize(path[path.length - 1] ?? 'File');
  const hint = schema?.description;
  const off = locked(ctx, path);
  const set = (v: Json | undefined) => ctx.set(path, v);

  if (value === null) {
    const tpl = siblings(ctx.root, path).find((v) => v !== null);
    return (
      <Row label={name} hint={hint} path={path} ctx={ctx} onRemove={onRemove}>
        <span className="text-sm text-ink-faint">none</span>{' '}
        {tpl !== undefined && !off && (
          <button type="button" className={smallBtn} onClick={() => set(structuredClone(tpl))}>
            Fill like a sibling
          </button>
        )}
      </Row>
    );
  }
  if (Array.isArray(value)) return <ArrayNode {...{ path, value, schema, ctx, depth, name, hint, onRemove }} />;
  if (isObj(value)) return <ObjectNode {...{ path, value, schema, ctx, depth, name, hint, onRemove }} />;

  // A value that may also be none (its siblings have null there).
  const nullable = !off && siblings(ctx.root, path).some((v) => v === null);
  const clear = nullable ? () => set(null) : onRemove;
  return (
    <Row label={name} hint={hint} path={path} ctx={ctx} onRemove={clear}>
      <Leaf value={value} schema={schema} disabled={off} onChange={set} />
    </Row>
  );
}

function Leaf({ value, schema, disabled, onChange }: { value: string | number | boolean; schema?: Schema; disabled: boolean; onChange: (v: Json) => void }) {
  if (schema?.enum)
    return (
      <select className={input} value={String(value)} disabled={disabled} onChange={(e) => onChange(typeof value === 'number' ? Number(e.target.value) : e.target.value)}>
        {schema.enum.map((o) => (
          <option key={o} value={String(o)}>
            {o}
          </option>
        ))}
      </select>
    );
  if (typeof value === 'boolean') return <input type="checkbox" className="mt-1.5 size-4" checked={value} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
  if (typeof value === 'number')
    return (
      <NumberInput
        value={value}
        disabled={disabled}
        min={schema?.minimum ?? schema?.exclusiveMinimum}
        max={schema?.maximum}
        integer={schema?.type === 'integer'}
        onChange={onChange}
      />
    );
  if (schema?.['x-widget'] === 'color' || COLOR.test(value))
    return (
      <span className="flex items-center gap-2">
        <input type="color" className="h-7 w-10 cursor-pointer rounded border border-rule bg-card disabled:opacity-60" value={COLOR.test(value) ? value : '#000000'} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <input className={`${input} max-w-28 font-mono`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      </span>
    );
  const picture = PICTURE.test(value);
  return (
    <span className="flex items-start gap-2">
      {value.length > 70 ? (
        <textarea className={`${input} min-h-16`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input className={input} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
      {picture && <img src={value} alt="" loading="lazy" className="size-12 shrink-0 rounded border border-rule bg-tile object-contain" />}
    </span>
  );
}

/** A number typed freely ("0." on the way to "0.5"), sent on as soon as it parses. */
function NumberInput({ value, disabled, min, max, integer, onChange }: { value: number; disabled: boolean; min?: number; max?: number; integer: boolean; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  const shown = Number(text) === value ? text : String(value);
  return (
    <input
      type="number"
      className={`${input} max-w-36 tabular-nums`}
      value={shown}
      min={min}
      max={max}
      step={integer ? 1 : 'any'}
      disabled={disabled}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) onChange(Number(e.target.value));
      }}
    />
  );
}

/** Big objects (card art, frozen rarities) are filtered and shown a page at a time. */
const PAGE = 60;

function ObjectNode({ path, value, schema, ctx, depth, name, hint, onRemove }: { path: Path; value: Record<string, Json>; schema?: Schema; ctx: EditorCtx; depth: number; name: ReactNode; hint?: string; onRemove?: () => void }) {
  const [filter, setFilter] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [newKey, setNewKey] = useState('');
  const keys = Object.keys(value);
  const big = keys.length > 24;
  const visible = (filter ? keys.filter((k) => k.toLowerCase().includes(filter.toLowerCase()) || JSON.stringify(value[k]).toLowerCase().includes(filter.toLowerCase())) : keys).slice(0, shown);
  const required = new Set(schema?.required ?? []);
  // New keys: where the schema allows any (a map like grades or effects), or the data looks like a map with no schema.
  const values = Object.values(value);
  const mapLike = values.length > 0 && values.every((v) => typeof v === typeof values[0] && Array.isArray(v) === Array.isArray(values[0]));
  // With no schema, new keys only in an append-only file (a map of pictures): elsewhere the code wouldn't read them.
  const canAdd = ctx.policy !== 'read-only' && (schema ? typeof schema.additionalProperties === 'object' : ctx.policy === 'append-only' && mapLike);
  const add = () => {
    const k = newKey.trim();
    if (!k || k in value) return;
    const tpl = typeof schema?.additionalProperties === 'object' && !values.length ? fromSchema(schema.additionalProperties) : values.length ? blankLike(values[values.length - 1]) : '';
    ctx.set([...path, k], tpl);
    setNewKey('');
  };
  // With no schema, only what was added since the last save can go (the code may read every saved key).
  const removable = (k: string) => !locked(ctx, [...path, k]) && !required.has(k) && ctx.policy !== 'read-only' && (!!schema || get(ctx.saved, [...path, k]) === undefined);

  const body = (
    <div className={depth ? 'border-l-2 border-rule pl-3' : ''}>
      {hint && depth > 0 && <p className="pb-1 text-xs text-ink-faint">{hint}</p>}
      <Errors ctx={ctx} path={path} />
      {big && (
        <input className={`${input} mb-2 max-w-xs`} placeholder={`Filter ${keys.length} entries…`} value={filter} onChange={(e) => (setFilter(e.target.value), setShown(PAGE))} />
      )}
      {visible.map((k) => (
        <Node key={k} path={[...path, k]} value={value[k]} schema={childSchema(schema, k)} ctx={ctx} depth={depth + 1} onRemove={removable(k) ? () => ctx.set([...path, k], undefined) : undefined} />
      ))}
      {visible.length < (filter ? Infinity : keys.length) && visible.length === shown && (
        <button type="button" className={smallBtn} onClick={() => setShown((n) => n + PAGE)}>
          Show more ({keys.length - shown} left)
        </button>
      )}
      {canAdd && (
        <div className="flex gap-2 py-1">
          <input className={`${input} max-w-56`} placeholder="New key" value={newKey} onChange={(e) => setNewKey(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" className={smallBtn} onClick={add} disabled={!newKey.trim() || newKey.trim() in value}>
            + Add
          </button>
        </div>
      )}
    </div>
  );
  if (depth === 0) return body;
  return (
    <details open={depth < 2 && !big} className="py-1">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
        <span title={pointer(path)}>{name}</span>
        <span className="text-xs font-normal text-ink-faint">{keys.length} fields</span>
        {onRemove && (
          <button type="button" className={smallBtn} onClick={(e) => (e.preventDefault(), onRemove())}>
            ✕
          </button>
        )}
      </summary>
      {body}
    </details>
  );
}

function ArrayNode({ path, value, schema, ctx, depth, name, hint, onRemove }: { path: Path; value: Json[]; schema?: Schema; ctx: EditorCtx; depth: number; name: ReactNode; hint?: string; onRemove?: () => void }) {
  const itemSchema = schema?.items;
  const fixed = schema?.minItems !== undefined && schema.minItems === schema.maxItems;
  const canEdit = ctx.policy !== 'read-only';
  const removable = (i: number) => canEdit && !fixed && !locked(ctx, [...path, i]) && value.length > (schema?.minItems ?? 0);
  const add = () => ctx.set([...path, value.length], value.length ? blankLike(value[value.length - 1]) : fromSchema(itemSchema));
  const flat = value.every((v) => v === null || typeof v !== 'object');

  // A short row of plain values (a colour pair, a metal's three tones, rounds per phase): side by side.
  if (flat && value.length <= 6 && value.every((v) => typeof v !== 'string' || v.length < 12))
    return (
      <Row label={name} hint={hint} path={path} ctx={ctx} onRemove={onRemove}>
        <div className="flex flex-wrap items-center gap-2">
          {value.map((v, i) => (
            <span key={i} className="flex items-center gap-1">
              {v !== null && typeof v !== 'object' && <Leaf value={v} schema={itemSchema} disabled={locked(ctx, [...path, i])} onChange={(x) => ctx.set([...path, i], x)} />}
              {removable(i) && (
                <button type="button" className={smallBtn} onClick={() => ctx.set([...path, i], undefined)}>
                  ✕
                </button>
              )}
            </span>
          ))}
          {canEdit && !fixed && (
            <button type="button" className={smallBtn} onClick={add}>
              +
            </button>
          )}
        </div>
      </Row>
    );

  return (
    <details open={depth < 2 && value.length <= 24} className="py-1">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold text-ink">
        <span title={pointer(path)}>{name}</span>
        <span className="text-xs font-normal text-ink-faint">{value.length} items</span>
        {onRemove && (
          <button type="button" className={smallBtn} onClick={(e) => (e.preventDefault(), onRemove())}>
            ✕
          </button>
        )}
      </summary>
      <div className="border-l-2 border-rule pl-3">
        {hint && <p className="pb-1 text-xs text-ink-faint">{hint}</p>}
        <Errors ctx={ctx} path={path} />
        {value.map((v, i) => (
          <Node key={i} path={[...path, i]} value={v} schema={itemSchema} ctx={ctx} depth={depth + 1} label={itemLabel(v, i)} onRemove={removable(i) ? () => ctx.set([...path, i], undefined) : undefined} />
        ))}
        {canEdit && !fixed && (
          <button type="button" className={smallBtn} onClick={add}>
            + Add item
          </button>
        )}
      </div>
    </details>
  );
}

/** An item's name in a list: its id, name or label if it has one. */
function itemLabel(v: Json, i: number): string {
  if (isObj(v)) for (const k of ['name', 'label', 'id', 'domain', 'rank', 'title']) if (typeof v[k] === 'string' && v[k]) return `${i + 1}. ${v[k]}`;
  return `#${i + 1}`;
}

/** The value with `path` set (or removed, for undefined); a new copy, the old one untouched. */
export function setIn(root: Json, path: Path, value: Json | undefined): Json {
  if (!path.length) return value ?? null;
  const [k, ...rest] = path;
  if (Array.isArray(root)) {
    const out = [...root];
    const i = Number(k);
    if (value === undefined && !rest.length) out.splice(i, 1);
    else out[i] = setIn(out[i] ?? null, rest, value);
    return out;
  }
  const out: Record<string, Json> = { ...(isObj(root) ? root : {}) };
  if (value === undefined && !rest.length) delete out[k];
  else out[k] = setIn(out[k] ?? null, rest, value);
  return out;
}
