import { allPuzzles } from '../../game/puzzles';
import type { MateN } from '../../game/types';
import { accuracy, BADGES, liveStreak, weeklyGrowth } from '../../progress/progress';
import { exportData, importData, resetData } from '../../storage/backup';
import { h, toast } from '../../ui/dom';
import { openOptions } from '../nav';
import type { Screen } from '../context';

const stat = (v: string | number, k: string) => h('div.stat', null, h('div.v', null, String(v)), h('div.k', null, k));

export const progressScreen: Screen = (ctx, root) => {
  const p = ctx.progress;
  const today = ctx.today();
  const streak = liveStreak(p, today, ctx.settings.streakFreeze);
  const total = Object.keys(p.solved).length;
  const { thisWeek, lastWeek } = weeklyGrowth(p, today);
  const growth =
    thisWeek > lastWeek
      ? `📈 ${thisWeek - lastWeek} more than last week — keep it up!`
      : thisWeek === lastWeek && thisWeek > 0
        ? 'Same pace as last week — steady!'
        : thisWeek > 0
          ? `${thisWeek} solved this week.`
          : 'Solve a puzzle to start this week’s count.';

  const pool = allPuzzles();
  const catBar = (n: MateN) => {
    const available = pool.filter((x) => x.n === n).length;
    const pct = Math.min(100, (100 * p.byN[n]) / available);
    return h(
      'div',
      null,
      h('div', { style: 'display:flex;justify-content:space-between' }, h('span', null, `Mate in ${n}`), h('span', null, `${p.byN[n]} / ${available}`)),
      h('div.bar', { role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 }, h('i', { style: `width:${Math.max(pct, p.byN[n] ? 2 : 0)}%` })),
    );
  };

  // Last 7 days mini chart.
  const days = h('div', { style: 'display:flex;gap:4px;align-items:flex-end;height:48px' });
  const counts: { d: string; n: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    counts.push({ d: d.toLocaleDateString(undefined, { weekday: 'narrow' }), n: p.days[key]?.solved ?? 0 });
  }
  const max = Math.max(1, ...counts.map((c) => c.n));
  for (const c of counts) {
    days.append(
      h(
        'div',
        { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:2px', title: `${c.n} solved` },
        h('div', { style: `width:100%;background:var(--accent);border-radius:4px 4px 0 0;height:${Math.round((30 * c.n) / max)}px;min-height:${c.n ? 3 : 0}px` }),
        h('span', { style: 'font-size:.75em;color:var(--muted)' }, c.d),
      ),
    );
  }

  root.append(
    h('h2', { style: 'margin:0' }, 'Your progress'),
    h(
      'div.grid-2',
      null,
      stat(`🔥 ${streak}`, `day streak · best ${p.streak.best}${ctx.settings.streakFreeze ? ` · ${p.streak.freezes ? '🧊 freeze ready' : 'no freeze'}` : ''}`),
      stat(total, 'puzzles solved'),
      stat(`${accuracy(p)}%`, 'first-try accuracy'),
      stat(`⚡ ${p.rushBest}`, 'Puzzle Rush best'),
      stat(`${p.game.w}/${p.game.d}/${p.game.l}`, 'Finish the Position W/D/L'),
      ctx.settings.showRating ? stat(p.rating, 'puzzle rating (hidden by default)') : stat(p.mistakes.length, 'mistakes to retry'),
    ),
    h('div.card', null, h('h3', null, 'This week'), days, h('p', null, growth)),
    h('div.card', null, h('h3', null, 'By category'), catBar(1), catBar(2), catBar(3)),
    p.mistakes.length ? h('button.btn', { onclick: () => ctx.go({ name: 'puzzle', mode: 'retry' }) }, `🔁 Retry ${p.mistakes.length} mistake${p.mistakes.length === 1 ? '' : 's'}`) : '',
    h('div.section-title', null, 'Badges'),
    h(
      'div.badges',
      null,
      BADGES.map((b) =>
        h('div.badge', { class: p.badges[b.id] ? '' : 'locked', title: b.desc }, h('span.i', null, b.icon), h('strong', null, b.name), h('div', null, b.desc)),
      ),
    ),
    h('div.section-title', null, 'Your data'),
    h('p', { style: 'margin:0;color:var(--muted);font-size:.9em' }, 'Everything is stored only on this device. Export a backup to move it to another computer.'),
    // The popup closes when a file dialog opens, so data tools live on the Options page there.
    ctx.surface === 'popup'
      ? h('button.btn', { onclick: () => openOptions('data') }, '⚙️ Export / Import / Reset…')
      : h(
      'div.btn-row',
      null,
      h('button.btn', { onclick: () => void exportData() }, '⬇ Export'),
      h(
        'button.btn',
        {
          onclick: async () => {
            try {
              if (await importData()) {
                toast('Progress imported ✓', 'good');
                setTimeout(() => location.reload(), 600);
              }
            } catch (e) {
              toast((e as Error).message, 'warn', 3500);
            }
          },
        },
        '⬆ Import',
      ),
      h(
        'button.btn',
        {
          onclick: async () => {
            if (await resetData()) location.reload();
          },
        },
        '🗑 Reset',
      ),
    ),
  );
  return {};
};
