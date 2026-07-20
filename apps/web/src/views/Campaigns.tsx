import { Fragment, useCallback, useEffect, useState } from "react";
import type { Api, Campaign, CampaignStats } from "../api.js";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function StatsPanel({ api, campaignId }: { api: Api; campaignId: string }) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .campaignStats(campaignId)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, campaignId]);

  if (error !== null) {
    return <p className="error">{error}</p>;
  }
  if (stats === null) {
    return <p className="muted">Loading stats…</p>;
  }
  return (
    <div className="stat-grid">
      <StatCard label="Sent" value={stats.totals.sent} />
      <StatCard label="Delivered" value={stats.totals.delivered} />
      <StatCard label="Bounced" value={stats.totals.bounced} />
      <StatCard label="Complaints" value={stats.totals.complained} />
      <StatCard label="Opens" value={stats.totals.uniqueOpens} />
      <StatCard label="Clicks" value={stats.totals.uniqueClicks} />
    </div>
  );
}

export function CampaignsView({ api }: { api: Api }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    (after: string | null) => {
      setLoading(true);
      api
        .listCampaigns(after)
        .then((result) => {
          setCampaigns((prev) => (after === null ? result.data : [...prev, ...result.data]));
          setCursor(result.pageInfo.nextCursor);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false));
    },
    [api],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  return (
    <section>
      {error !== null && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Updated</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => (
            <Fragment key={campaign.id}>
              <tr>
                <td>{campaign.name}</td>
                <td>
                  <span className={`status-pill ${campaign.status}`}>{campaign.status}</span>
                </td>
                <td className="muted">{new Date(campaign.updatedAt).toLocaleString()}</td>
                <td>
                  <button
                    className="link-button"
                    onClick={() =>
                      setExpanded((current) => (current === campaign.id ? null : campaign.id))
                    }
                  >
                    {expanded === campaign.id ? "Hide" : "Stats"}
                  </button>
                </td>
              </tr>
              {expanded === campaign.id && (
                <tr>
                  <td colSpan={4}>
                    <StatsPanel api={api} campaignId={campaign.id} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {campaigns.length === 0 && !loading && (
            <tr>
              <td colSpan={4} className="muted">
                No campaigns yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {cursor !== null && (
        <p>
          <button className="link-button" onClick={() => load(cursor)}>
            Load more
          </button>
        </p>
      )}
    </section>
  );
}
