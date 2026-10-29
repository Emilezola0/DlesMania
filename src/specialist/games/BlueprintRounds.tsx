import type { RoundRecord } from '../../types';
import { BLUEPRINT_NODES, blueprintNodeById, nodeImage, type BlueprintNode } from '../blueprint';
import type { SpRound } from '../rounds';
import { ClassicGrid, same, type Column } from './ClassicRound';
import { SpGuessRound } from './SpGuessRound';

interface Props {
  round: SpRound;
  record: RoundRecord;
  onChange: (record: RoundRecord) => void;
}

/** The suggestions: every node, its own drawing as the picture. */
const POOL = BLUEPRINT_NODES.map((n) => ({ ...n, image: nodeImage(n) }));
const hasExec = (n: BlueprintNode) => [...n.inputs, ...n.outputs].some(([, t]) => t === 'exec');
const detail = (n: BlueprintNode) => `${n.kind} · ${n.category}${n.latent ? ' · latent' : ''}`;
const hints = (n: BlueprintNode) => [`Category: ${n.category}`, `Kind: ${n.kind}`, `Returns: ${n.returns}`, `Its name starts with “${n.name[0]}”`];

const COLUMNS: Column<BlueprintNode>[] = [
  { label: 'Kind', show: (n) => n.kind, judge: same((n) => n.kind) },
  { label: 'Category', show: (n) => n.category, judge: same((n) => n.category) },
  { label: 'Exec pins', show: (n) => (hasExec(n) ? 'Yes' : 'No'), judge: same((n) => String(hasExec(n))) },
  { label: 'Latent', show: (n) => (n.latent ? 'Yes' : 'No'), judge: same((n) => String(n.latent)) },
  { label: 'Returns', show: (n) => n.returns, judge: same((n) => n.returns) },
];
const byId = new Map(POOL.map((n) => [n.id, n]));

export function BlueprintClassicRound(props: Props) {
  return <ClassicGrid {...props} pool={POOL} byId={byId} columns={COLUMNS} noun="node" detail={detail} />;
}

/** Pins: the node with its title hidden — name it from its pins and colours. */
export function BlueprintPinsRound({ round, record, onChange }: Props) {
  const n = blueprintNodeById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="pins"
      question="Which node has these pins?"
      pool={POOL}
      targetId={n.id}
      hints={hints(n)}
      record={record}
      onChange={onChange}
      answer={{ name: n.name, image: nodeImage(n), detail: detail(n) }}
      noPictures
      clue={(_, done) => (
        <div className="mx-auto w-full max-w-sm rounded-xl bg-[#262626] bg-[linear-gradient(#ffffff0a_1px,transparent_1px),linear-gradient(90deg,#ffffff0a_1px,transparent_1px)] bg-[size:16px_16px] p-6">
          <img src={nodeImage(n, !done)} alt={done ? n.name : 'A Blueprint node, its title hidden'} className="mx-auto w-full" draggable={false} />
        </div>
      )}
    />
  );
}

/** Clue: what the node does. */
export function BlueprintClueRound({ round, record, onChange }: Props) {
  const n = blueprintNodeById.get(round.targetId)!;
  return (
    <SpGuessRound
      type="clue"
      question="Which node does this?"
      pool={POOL}
      targetId={n.id}
      hints={hints(n)}
      record={record}
      onChange={onChange}
      answer={{ name: n.name, image: nodeImage(n), detail: detail(n) }}
      noPictures
      clue={() => <blockquote className="page mx-auto max-w-xl rounded-md px-6 py-8 text-center font-serif text-2xl italic leading-snug">“{n.description}”</blockquote>}
    />
  );
}
