import { useEffect, useState } from "react";

type Health = "loading" | "ok" | "unreachable";

export function App() {
  const [health, setHealth] = useState<Health>("loading");

  useEffect(() => {
    fetch("/health/live")
      .then((res) => setHealth(res.ok ? "ok" : "unreachable"))
      .catch(() => setHealth("unreachable"));
  }, []);

  return (
    <main>
      <h1>dispatch</h1>
      <p>API status: {health}</p>
    </main>
  );
}
