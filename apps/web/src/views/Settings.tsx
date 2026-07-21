import { Fragment, useCallback, useEffect, useState } from "react";
import type { Api, Relay, SenderIdentity } from "../api.js";

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; secret?: boolean }[]> = {
  ses: [
    { key: "region", label: "AWS region" },
    { key: "accessKeyId", label: "Access key id" },
    { key: "secretAccessKey", label: "Secret access key", secret: true },
  ],
  resend: [{ key: "apiKey", label: "API key", secret: true }],
  smtp: [
    { key: "host", label: "SMTP host" },
    { key: "port", label: "Port" },
    { key: "user", label: "Username" },
    { key: "pass", label: "Password", secret: true },
  ],
};

function RelayForm({ api, onCreated }: { api: Api; onCreated: () => void }) {
  const [type, setType] = useState<"ses" | "resend" | "smtp">("ses");
  const [name, setName] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [warmupDays, setWarmupDays] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="campaign-form"
      onSubmit={(event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        api
          .createRelay({
            type,
            name: name.trim() || `${type} relay`,
            credentials,
            ...(warmupDays.length > 0 ? { warmupDays: Number(warmupDays) } : {}),
          })
          .then(() => {
            setName("");
            setCredentials({});
            setWarmupDays("");
            setBusy(false);
            onCreated();
          })
          .catch((err: Error) => {
            setError(err.message);
            setBusy(false);
          });
      }}
    >
      <div className="row-actions">
        <select
          value={type}
          onChange={(event) => setType(event.target.value as "ses" | "resend" | "smtp")}
        >
          <option value="ses">AWS SES v2</option>
          <option value="resend">Resend</option>
          <option value="smtp">SMTP</option>
        </select>
        <input placeholder="Relay name" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Warmup days (optional)"
          value={warmupDays}
          onChange={(e) => setWarmupDays(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      <div className="row-actions">
        {(CREDENTIAL_FIELDS[type] ?? []).map((field) => (
          <input
            key={field.key}
            type={field.secret ? "password" : "text"}
            placeholder={field.label}
            value={credentials[field.key] ?? ""}
            onChange={(e) =>
              setCredentials((current) => ({ ...current, [field.key]: e.target.value }))
            }
            required
          />
        ))}
      </div>
      {error !== null && <p className="error">{error}</p>}
      <div className="row-actions">
        <button className="primary" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add relay"}
        </button>
      </div>
    </form>
  );
}

function RelaysSection({ api }: { api: Api }) {
  const [relays, setRelays] = useState<Relay[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listRelays(null)
      .then((page) => setRelays(page.data))
      .catch((err: Error) => setError(err.message));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="row-actions">
        <h3>Relays</h3>
        <button className="link-button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Add relay"}
        </button>
      </div>
      {showForm && (
        <RelayForm
          api={api}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
      {notice !== null && <p className="muted">{notice}</p>}
      {error !== null && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {relays.map((relay) => (
            <tr key={relay.id}>
              <td>{relay.name}</td>
              <td className="muted">{relay.type}</td>
              <td>
                <span className={`status-pill ${relay.status}`}>{relay.status}</span>
              </td>
              <td>
                <button
                  className="link-button"
                  onClick={() => {
                    api
                      .testRelay(relay.id)
                      .then((result) => {
                        setNotice(
                          result.health.ok
                            ? `${relay.name}: connection ok.`
                            : `${relay.name}: ${result.health.detail}`,
                        );
                        load();
                      })
                      .catch((err: Error) => setError(err.message));
                  }}
                >
                  Test connection
                </button>
              </td>
            </tr>
          ))}
          {relays.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No relays yet — add one to start sending.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

function IdentitiesSection({ api }: { api: Api }) {
  const [identities, setIdentities] = useState<SenderIdentity[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ domain: "", fromEmail: "", fromName: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .listIdentities(null)
      .then((page) => setIdentities(page.data))
      .catch((err: Error) => setError(err.message));
  }, [api]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section>
      <div className="row-actions">
        <h3>Sender identities</h3>
        <button className="link-button" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Close" : "Add identity"}
        </button>
      </div>
      {showForm && (
        <form
          className="campaign-form"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            api
              .createIdentity(form)
              .then(() => {
                setForm({ domain: "", fromEmail: "", fromName: "" });
                setShowForm(false);
                load();
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <div className="row-actions">
            <input
              placeholder="Domain (example.com)"
              value={form.domain}
              onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
              required
            />
            <input
              placeholder="From email"
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              required
            />
            <input
              placeholder="From name"
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
              required
            />
            <button className="primary" type="submit">
              Add identity
            </button>
          </div>
        </form>
      )}
      {notice !== null && <p className="muted">{notice}</p>}
      {error !== null && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>From</th>
            <th>Domain</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {identities.map((identity) => (
            <Fragment key={identity.id}>
              <tr>
                <td>
                  {identity.fromName} <span className="muted">&lt;{identity.fromEmail}&gt;</span>
                </td>
                <td className="muted">{identity.domain}</td>
                <td>
                  <span className={`status-pill ${identity.verificationStatus}`}>
                    {identity.verificationStatus}
                  </span>
                </td>
                <td>
                  <button
                    className="link-button"
                    onClick={() =>
                      setExpanded((current) => (current === identity.id ? null : identity.id))
                    }
                  >
                    DNS
                  </button>{" "}
                  {identity.verificationStatus !== "verified" && (
                    <button
                      className="link-button"
                      onClick={() => {
                        api
                          .verifyIdentity(identity.id)
                          .then(() => {
                            setNotice(`${identity.fromEmail} verified.`);
                            load();
                          })
                          .catch((err: Error) => setError(err.message));
                      }}
                    >
                      Verify
                    </button>
                  )}
                </td>
              </tr>
              {expanded === identity.id && (
                <tr>
                  <td colSpan={4}>
                    <table>
                      <tbody>
                        {identity.dnsRecords.map((record) => (
                          <tr key={`${record.type}-${record.name}`}>
                            <td className="muted">{record.type}</td>
                            <td>{record.name}</td>
                            <td className="muted">{record.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {identities.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                No sender identities yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  );
}

export function SettingsView({ api }: { api: Api }) {
  return (
    <>
      <RelaysSection api={api} />
      <IdentitiesSection api={api} />
    </>
  );
}
