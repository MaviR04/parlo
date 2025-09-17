import { useEffect, useMemo, useState } from "react";
import api from "../../../axios";

/**
 * Fetches and manages Insights data for a child & term.
 * Exposes:
 *  - topics: raw payload { overall, subjects: [...] }
 *  - activeSubject: selected subject string
 *  - setActiveSubject: setter for subject chip
 *  - loading / error
 */
export default function useInsights(childId, termId, enabled = true) {
  const [topics, setTopics] = useState(null);
  const [activeSubject, setActiveSubject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setErr] = useState(null);

  useEffect(() => {
    if (!enabled || !childId || !termId) return;
    setLoading(true);
    setErr(null);

    api
      .get(`/academics/topics/${childId}/${termId}`)
      .then((res) => {
        const data = res.data || null;
        setTopics(data);
        // set default subject if needed
        const first = data?.subjects?.[0]?.subject ?? null;
        setActiveSubject((prev) =>
          prev && data?.subjects?.some((s) => s.subject === prev) ? prev : first
        );
      })
      .catch(() => setErr("Failed to load topics"))
      .finally(() => setLoading(false));
  }, [childId, termId, enabled]);

  const activeSubjectData = useMemo(() => {
    if (!topics?.subjects?.length || !activeSubject) return null;
    return topics.subjects.find((s) => s.subject === activeSubject) ?? null;
  }, [topics, activeSubject]);

  return {
    topics,
    activeSubject,
    setActiveSubject,
    activeSubjectData,
    loading,
    error,
  };
}