import { useEffect, useMemo, useState } from "react";
import api from "../../../axios";
import { withinPreset } from "../utils/date";

export default function useLogs(childId, termId, { preset, search, category, page, perPage }) {
  const [raw, setRaw] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tagCategories, setTagCategories] = useState([]);
  const [categoryColor, setCategoryColor] = useState({});

  // load logs
  useEffect(() => {
    setLoading(true);
    api.get(`/activities/logs/${childId}/${termId}`)
      .then(res => setRaw(res.data || []))
      .catch(() => setRaw([]))
      .finally(() => setLoading(false));
  }, [childId, termId]);

  // load tag catalog for chips
  useEffect(() => {
    api.get("/activities/tags")
      .then(res => {
        const tags = res.data || [];
        const cats = [...new Set(tags.map(t => t.category).filter(Boolean))];
        const colorMap = {};
        for (const c of cats) {
          const t = tags.find(x => x.category === c && x.color);
          colorMap[c] = t?.color || "#6B7280";
        }
        setTagCategories(cats);
        setCategoryColor(colorMap);
      })
      .catch(() => { setTagCategories([]); setCategoryColor({}); });
  }, []);

  const filtered = useMemo(() => {
    return raw.filter(log => {
      const byDate = withinPreset(log.date, preset);
      const byCat  = !category ? true : (log.tags || []).some(t => t.category === category);
      const byText = search ? (log.comment || "").toLowerCase().includes(search.toLowerCase()) : true;
      return byDate && byCat && byText;
    });
  }, [raw, preset, category, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const start = (page - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  return { loading, tagCategories, categoryColor, pageItems, total: filtered.length, totalPages };
}