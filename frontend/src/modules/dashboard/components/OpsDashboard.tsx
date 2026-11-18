'use client';

import { AlertTriangle, Camera, ClipboardCheck, Megaphone, MapPin } from 'lucide-react';

import { dashboardApi } from '../api';
import { useDashboardData } from '../hooks/use-dashboard';
import type { OpsCampaign, OpsDashboardData } from '../role-types';
import { Empty, LoadError, Panel, Row, SectionTitle, Skeleton, Stat, fmtDay, plural, relDay } from './dashboard-kit';

function headline(d: OpsDashboardData): string {
  const parts: string[] = [`${plural(d.campaigns.live, 'campaign')} ${d.campaigns.live === 1 ? 'is' : 'are'} live right now`];
  if (d.tasks.overdue) parts.push(`${plural(d.tasks.overdue, 'task')} ${d.tasks.overdue === 1 ? 'is' : 'are'} overdue`);
  if (d.tasks.dueToday) parts.push(`${d.tasks.dueToday} due today`);
  if (d.proofs.pendingReview) parts.push(`${plural(d.proofs.pendingReview, 'proof')} waiting for review`);
  let text = parts.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
  const starting = d.campaigns.startingThisWeek.length;
  const ending = d.campaigns.endingThisWeek.length;
  if (starting || ending) {
    text += ` This week: ${[starting && `${starting} starting`, ending && `${ending} ending`].filter(Boolean).join(', ')}.`;
  }
  if (!d.tasks.overdue && !d.tasks.dueToday && !d.proofs.pendingReview) text += ' Nothing urgent. 👍';
  return text;
}

function CampaignList({ items, dateKey, empty }: { items: OpsCampaign[]; dateKey: 'startDate' | 'endDate'; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul>
      {items.map((c) => (
        <Row
          key={c.id}
          left={c.name}
          sub={[c.code, c.city].filter(Boolean).join(' · ')}
          right={c[dateKey] ? relDay(c[dateKey]!) : '—'}
        />
      ))}
    </ul>
  );
}

export function OpsDashboard() {
  const { data, error, reload } = useDashboardData(dashboardApi.getOps);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={3} />;

  const todayStart = new Date(new Date().toDateString());
  const sitePct = data.sites.total ? Math.round((data.sites.booked / data.sites.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700 leading-relaxed bg-[#FFF8F8] border border-[#F0D0D0] rounded-2xl px-4 py-3">
        {headline(data)}
      </p>

      <div className="space-y-2">
        <SectionTitle>At a glance</SectionTitle>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat
            icon={Megaphone}
            tone="brand"
            label="Live campaigns"
            value={data.campaigns.live}
            hint={`${data.campaigns.inProgress} in progress`}
            href="/campaigns"
          />
          <Stat
            icon={AlertTriangle}
            tone={data.tasks.overdue ? 'rose' : 'slate'}
            label="Overdue tasks"
            value={data.tasks.overdue}
            hint={`${data.tasks.open} open · ${data.tasks.dueToday} due today${data.tasks.unassigned ? ` · ${data.tasks.unassigned} unassigned` : ''}`}
            href="/campaigns"
          />
          <Stat
            icon={Camera}
            tone="amber"
            label="Proofs to review"
            value={data.proofs.pendingReview}
            hint={data.proofs.rejectedThisWeek ? `${data.proofs.rejectedThisWeek} rejected this week` : 'Photo proofs from the field'}
            href="/proofs"
          />
          <Stat
            icon={MapPin}
            tone="emerald"
            label="Sites available"
            value={
              <>
                {data.sites.available}
                <span className="text-base font-semibold text-slate-400"> / {data.sites.total}</span>
              </>
            }
            hint={data.sites.total ? `${sitePct}% booked` : 'No sites yet'}
            href="/sites"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          className="lg:col-span-2"
          title="Tasks needing attention"
          subtitle="Overdue and due in the next 3 days"
          action={{ href: '/campaigns', label: 'All campaigns' }}
        >
          {data.tasks.urgent.length === 0 ? (
            <Empty>No overdue or upcoming tasks. 👍</Empty>
          ) : (
            <ul>
              {data.tasks.urgent.map((t) => {
                const overdue = new Date(t.deadline) < todayStart;
                return (
                  <Row
                    key={t.id}
                    left={t.title}
                    sub={[t.campaign, t.type, t.assignee ? `→ ${t.assignee}` : 'Unassigned', t.proofRequired ? 'proof needed' : null]
                      .filter(Boolean)
                      .join(' · ')}
                    right={overdue ? `Overdue · ${fmtDay(t.deadline, false)}` : `Due ${relDay(t.deadline)}`}
                    tone={overdue ? 'rose' : 'amber'}
                  />
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Open tasks by type">
          {data.tasks.byType.length === 0 ? (
            <Empty>No open tasks.</Empty>
          ) : (
            <ul>
              {data.tasks.byType.map((t) => (
                <Row key={t.type} left={t.type} right={t.count} />
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <ClipboardCheck className="h-3.5 w-3.5" /> Printing → Installation → Verification → Removal
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Starting this week" subtitle="Get printing & installation ready" action={{ href: '/campaigns', label: 'Campaigns' }}>
          <CampaignList items={data.campaigns.startingThisWeek} dateKey="startDate" empty="No campaigns start in the next 7 days." />
        </Panel>
        <Panel title="Ending this week" subtitle="Plan removal and final proofs" action={{ href: '/campaigns', label: 'Campaigns' }}>
          <CampaignList items={data.campaigns.endingThisWeek} dateKey="endDate" empty="No campaigns end in the next 7 days." />
        </Panel>
      </div>
    </div>
  );
}
