import { useCallback, useEffect, useState } from "react";
import type { Api, AudienceList } from "../api.js";

export function ListsView({ api }: { api: Api }) {
  const [lists, setLists] = useState<AudienceList[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (after: string | null) => {
      api
        .listLists(after)
        .then((result) => {
          setLists((prev) => (after === null ? result.data : [...prev, ...result.data]));
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
      <form
        className="row-actions"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length === 0) {
            return;
          }
          api
            .createList(name.trim(), description.trim())
            .then(() => {
              setName("");
              setDescription("");
              load(null);
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <input
          placeholder="New list name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <button className="primary" type="submit">
          Create list
        </button>
      </form>
      {error !== null && <p className="error">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {lists.map((list) => (
            <tr key={list.id}>
              <td>{list.name}</td>
              <td className="muted">{list.description}</td>
              <td className="muted">{new Date(list.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
          {lists.length === 0 && (
            <tr>
              <td colSpan={3} className="muted">
                No lists yet.
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
