import { useEffect, useState } from "react";
import api from "../../../axios";

export default function useOverview(childId, termId, enabled) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    api.get(`/activities/overview/${childId}/${termId}`)
      .then(res => { setData(res.data); setErr(null); })
      .catch(() => setErr("Failed to load activities overview"))
      .finally(() => setLoading(false));
  }, [childId, termId, enabled]);

  return { data, loading, err };
}