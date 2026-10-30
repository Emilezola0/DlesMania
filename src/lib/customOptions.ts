import type { CustomOption } from '../components/Customise';
import { DOMAINS } from '../data';
import { BOSSES } from '../data/bosses';

/** The Boss Battle franchises among `ids` as Customise options, grouped like Boss Battle's tabs. */
export function franchiseOptions(ids: Set<string>): CustomOption[] {
  return BOSSES.filter((b) => ids.has(b.id)).map((b) => {
    const d = DOMAINS.find((x) => x.id === b.domain)!;
    return { key: b.id, label: b.franchise, group: b.category === 'other' ? '✨ Other' : `${d.icon} ${d.label}` };
  });
}
