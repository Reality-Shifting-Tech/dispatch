import { useEffect, useState } from "react";
import type { Api, PreparedCampaign } from "../api.js";

type Stage =
  | { kind: "preparing" }
  | { kind: "ready"; prepared: PreparedCampaign }
  | { kind: "sending" }
  | { kind: "sent"; recipientCount: number }
  | { kind: "error"; message: string };

/**
 * The safe-send flow mirrored in the console: prepare snapshots the audience
 * and returns a single-use confirmation token; confirming sends. Above the
 * key's approval threshold the operator must tick the approval box.
 */
export function SendPanel({
  api,
  campaignId,
  onSent,
}: {
  api: Api;
  campaignId: string;
  onSent: () => void;
}) {
  const [stage, setStage] = useState<Stage>({ kind: "preparing" });
  const [approved, setApproved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .prepareCampaign(campaignId)
      .then((prepared) => {
        if (!cancelled) {
          setStage({ kind: "ready", prepared });
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setStage({ kind: "error", message: err.message });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, campaignId]);

  if (stage.kind === "preparing") {
    return <p className="muted">Preparing audience snapshot…</p>;
  }
  if (stage.kind === "error") {
    return <p className="error">{stage.message}</p>;
  }
  if (stage.kind === "sent") {
    return <p>Campaign is sending to {stage.recipientCount} recipients.</p>;
  }

  const prepared = stage.kind === "ready" ? stage.prepared : null;
  return (
    <div className="send-panel">
      {prepared !== null && (
        <>
          <p>
            Ready to send to <strong>{prepared.included}</strong> recipients
            {prepared.excluded > 0 && ` (${prepared.excluded} excluded by consent/suppression)`}.
          </p>
          {prepared.approvalRequired && (
            <label className="approve-check">
              <input
                type="checkbox"
                checked={approved}
                onChange={(event) => setApproved(event.target.checked)}
              />{" "}
              This audience exceeds the key's approval threshold — I approve this send.
            </label>
          )}
        </>
      )}
      <div className="row-actions">
        <button
          className="primary"
          disabled={
            prepared === null ||
            stage.kind === "sending" ||
            (prepared.approvalRequired && !approved)
          }
          onClick={() => {
            if (prepared === null) {
              return;
            }
            setStage({ kind: "sending" });
            api
              .confirmSend(campaignId, prepared.confirmationToken, approved)
              .then((result) => {
                setStage({ kind: "sent", recipientCount: result.recipientCount });
                onSent();
              })
              .catch((err: Error) => setStage({ kind: "error", message: err.message }));
          }}
        >
          {stage.kind === "sending" ? "Confirming…" : "Confirm send"}
        </button>
      </div>
    </div>
  );
}
