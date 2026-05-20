import { EmotionalShiftGenerator } from './emotional-shift.generator';
import { makeItem } from './__fixtures__/builders';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

describe('EmotionalShiftGenerator', () => {
  const gen = new EmotionalShiftGenerator();
  const ctx = {
    confidenceThreshold: 0.6,
    minSupportingEntries: 3,
    now: new Date(),
  };

  it('emits when mean intensity for a theme moves ≥ 1.0', () => {
    const trigger = makeItem('work'.split('|'), [{ label: 'dread', intensity: 5 }], daysAgo(0));
    const history = [
      makeItem(['work'], [{ label: 'dread', intensity: 5 }], daysAgo(1)),
      makeItem(['work'], [{ label: 'dread', intensity: 4 }], daysAgo(2)),
      makeItem(['work'], [{ label: 'calm', intensity: 2 }], daysAgo(30)),
      makeItem(['work'], [{ label: 'calm', intensity: 2 }], daysAgo(45)),
      makeItem(['work'], [{ label: 'calm', intensity: 1 }], daysAgo(60)),
    ];
    const out = gen.generate({ ...ctx, trigger, history });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.insight_type).toBe('emotional_shift');
  });

  it('stays silent when intensities are flat', () => {
    const trigger = makeItem(['work'], [{ label: 'meh', intensity: 3 }], daysAgo(0));
    const history = [
      makeItem(['work'], [{ label: 'meh', intensity: 3 }], daysAgo(1)),
      makeItem(['work'], [{ label: 'meh', intensity: 3 }], daysAgo(5)),
      makeItem(['work'], [{ label: 'meh', intensity: 3 }], daysAgo(15)),
      makeItem(['work'], [{ label: 'meh', intensity: 3 }], daysAgo(30)),
    ];
    expect(gen.generate({ ...ctx, trigger, history })).toEqual([]);
  });
});
