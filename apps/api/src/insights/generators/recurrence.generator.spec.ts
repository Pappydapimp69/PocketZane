import { RecurrenceGenerator } from './recurrence.generator';
import { makeItem } from './__fixtures__/builders';

describe('RecurrenceGenerator', () => {
  const gen = new RecurrenceGenerator();
  const ctx = {
    confidenceThreshold: 0.6,
    minSupportingEntries: 3,
    now: new Date(),
  };

  it('does not emit when fewer than min supporting entries exist', () => {
    const trigger = makeItem(['solitude']);
    const history = [makeItem(['solitude'])];
    expect(gen.generate({ ...ctx, trigger, history })).toEqual([]);
  });

  it('emits a candidate when a theme appears in ≥3 entries', () => {
    const trigger = makeItem(['solitude']);
    const history = [makeItem(['solitude']), makeItem(['solitude']), makeItem(['other'])];
    const out = gen.generate({ ...ctx, trigger, history });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.insight_type).toBe('recurrence');
    expect(out[0]!.evidence_entry_ids.length).toBeGreaterThanOrEqual(3);
    expect(out[0]!.dedup_key).toBe('theme:solitude');
  });

  it('produces a stable dedup_key', () => {
    const trigger = makeItem(['solitude']);
    const history = [makeItem(['solitude']), makeItem(['solitude'])];
    const a = gen.generate({ ...ctx, trigger, history });
    const b = gen.generate({ ...ctx, trigger, history });
    expect(a[0]?.dedup_key).toBe(b[0]?.dedup_key);
  });
});
