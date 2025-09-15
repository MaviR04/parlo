export const startOfWeekMon = (d) => {
  const dt = new Date(d);
  const day = dt.getDay(); // Sun=0
  const diff = (day === 0 ? -6 : 1) - day;
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);

export const withinPreset = (isoDate, preset) => {
  if (!isoDate) return true;
  const d = new Date(isoDate);
  const now = new Date();
  d.setHours(0,0,0,0);

  if (preset === "This week")  return d >= startOfWeekMon(now);
  if (preset === "This month") return d >= startOfMonth(now);
  return true; // "This term" assumed server-scoped
};