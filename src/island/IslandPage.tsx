// Friends → Island: your island (stage 2a) and the Seed Book (stage 1).
import { useState } from 'react';
import { tr } from '../lib/i18n';
import { IslandView } from './IslandView';
import { SeedBook } from './SeedBook';

export function IslandPage() {
  const [view, setView] = useState<'island' | 'book'>('island');
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5">
        {(
          [
            ['island', '🏝️', tr('My island', 'Mon île')],
            ['book', '📖', tr('Seed Book', 'Herbier')],
          ] as const
        ).map(([id, icon, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-md border px-3 py-1.5 text-sm font-semibold ${view === id ? 'border-accent bg-card shadow' : 'border-rule text-ink-soft hover:bg-card/60'}`}
          >
            {icon} {name}
          </button>
        ))}
      </div>
      {view === 'island' ? (
        <div className="page space-y-2 rounded-md p-4">
          <h2 className="font-display text-2xl font-bold">🏝️ {tr('My island', 'Mon île')}</h2>
          <p className="text-sm text-ink-soft">
            {tr(
              'Plant two seeds on the dirt; a day or two later, harvest what grows and build with it: blocks, wallpapers, lights, music, furniture, and frames to show your cards. Soon, your friends can visit.',
              'Plante deux graines sur la terre ; un jour ou deux plus tard, récolte ce qui pousse et construis avec : blocs, papiers peints, lumières, musique, meubles, et cadres pour exposer tes cartes. Bientôt, tes amis pourront venir te voir.',
            )}
          </p>
          <IslandView />
        </div>
      ) : (
        <SeedBook />
      )}
    </div>
  );
}
