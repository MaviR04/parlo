import { useEffect, useState } from "react";
import api from "../../../axios";

export default function useProgress(childId, termId, activityName, enabled) {
  const [list, setList] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingWeekly, setLoadingWeekly] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    setLoadingList(true);
    api.get(`/activities/progress/${childId}/${termId}`)
      .then(res => setList(res.data ?? []))
      .finally(() => setLoadingList(false));
  }, [childId, termId, enabled]);

  useEffect(() => {
    if (!enabled || !activityName) return;
    setLoadingWeekly(true);
    api.get(`/activities/progress/${childId}/${termId}/weekly?activity=${encodeURIComponent(activityName)}`)
      .then(res => setWeekly(res.data ?? []))
      .finally(() => setLoadingWeekly(false));
  }, [childId, termId, activityName, enabled]);

  return { list, weekly, loadingList, loadingWeekly };
}