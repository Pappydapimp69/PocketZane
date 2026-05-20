import { ResurfacedThemeGenerator } from './resurfaced-theme.generator';
import { makeItem } from './__fixtures__/builders';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString();
}

describe('ResurfacedThemeGenerator', () => {
  const gen = new ResurfacedThemeGenerator();
  const ctx = {
    confidenceThreshold: 0.6,
    minSupportingEntries: 3,
    now: new Date(),
  };

  it('surfaces a theme that was dormant for ≥30 days then returned', () => {
    const trigger = makeItem(['piano'], [], daysAgo(0));
    const history = [
      makeItem(['piano'], [], daysAgo(60)),
      makeItem(['piano'], [], daysAgo(80)),
      makeItem(['other'], [], daysAgo(5)),
    ];
    const out = gen.generate({ ...ctx, trigger, history });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]!.insight_type).toBe('resurfaced_theme');
  });

  it('stays silent when the gap is short', () => {
    const trigger = makeItem(['piano'], [], daysAgo(0));
    const history = [makeItem(['piano'], [], daysAgo(2)), makeItem(['piano'], [], daysAgo(5))];
    expect(gen.generate({ ...ctx, trigger, history })).toEqual([]);
  });
});
