import { TemporalPatternGenerator } from './temporal-pattern.generator';
import { makeItem } from './__fixtures__/builders';

function tuesdayAt(weeksAgo: number, hour = 10): string {
  // 2026-05-19 was a Tuesday in real life; pick a known Tuesday.
  const base = new Date('2026-05-19T00:00:00Z');
  base.setUTCDate(base.getUTCDate() - weeksAgo * 7);
  base.setUTCHours(hour);
  return base.toISOString();
}

function fridayAt(weeksAgo: number): string {
  const d = new Date('2026-05-22T10:00:00Z');
  d.setUTCDate(d.getUTCDate() - weeksAgo * 7);
  return d.toISOString();
}

describe('TemporalPatternGenerator', () => {
  const gen = new TemporalPatternGenerator();
  const ctx = {
    confidenceThreshold: 0.6,
    minSupportingEntries: 3,
    now: new Date(),
  };

  it('flags a day-of-week skew when ≥60% of occurrences land on one day', () => {
    const trigger = makeItem(['standup'], [], tuesdayAt(0));
    const history = [
      makeItem(['standup'], [], tuesdayAt(1)),
      makeItem(['standup'], [], tuesdayAt(2)),
      makeItem(['standup'], [], tuesdayAt(3)),
      makeItem(['standup'], [], fridayAt(1)),
    ];
    const out = gen.generate({ ...ctx, trigger, history });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.insight_type).toBe('temporal_pattern');
    expect(out[0]!.title).toMatch(/Tuesday/);
  });

  it('does not flag a uniform distribution', () => {
    const days = ['2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];
    const items = days.map((d) => makeItem(['standup'], [], `${d}T10:00:00Z`));
    const [trigger, ...rest] = items;
    const out = gen.generate({ ...ctx, trigger: trigger!, history: rest });
    expect(out).toEqual([]);
  });
});
