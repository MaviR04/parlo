import { useEffect, useState } from "react";
import api from "../../../axios";

export default function useBadges(childId, termId, enabled) {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoading(true);
    api.get(`/activities/badges/${childId}/${termId}`)
      .then(res => setData(res.data || {}))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [childId, termId, enabled]);

  return { data, loading };
}