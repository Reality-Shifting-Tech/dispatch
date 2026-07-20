import { useCallback, useEffect, useState } from "react";
import type { Api, Contact } from "../api.js";

export function ContactsView({ api }: { api: Api }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (after: string | null) => {
      api
        .listContacts(after)
        .then((result) => {
          setContacts((prev) => (after === null ? result.data : [...prev, ...result.data]));
          setCursor(result.pageInfo.nextCursor);
          setError(null);
        })
        .catch((err: Error) => setError(err.message));
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
            <th>Email</th>
            <th>Added</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id}>
              <td>{contact.emailOriginal}</td>
              <td className="muted">{new Date(contact.createdAt).toLocaleString()}</td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={2} className="muted">
                No contacts yet.
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
