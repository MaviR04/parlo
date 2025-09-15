export function computeStartCurrentTrend(weeklyData, epsilon = 0.25) {
  const vals = (weeklyData || [])
    .map(w => Number(w.week_avg ?? 0))
    .filter(v => !Number.isNaN(v));

  if (!vals.length) {
    return { first:0,last:0,delta:0,pct:0,trendLabel:"Steady",trendClass:"text-gray-600 font-semibold",fluctuated:false };
  }
  const first = vals[0];
  const last  = vals[vals.length - 1];
  const delta = last - first;
  const pct   = first === 0 ? 0 : (delta / first) * 100;

  let trendLabel = "Steady";
  let trendClass = "text-gray-600 font-semibold";
  if (delta >  epsilon) { trendLabel = "Improving"; trendClass = "text-green-600 font-semibold"; }
  if (delta < -epsilon) { trendLabel = "Declining"; trendClass = "text-red-600 font-semibold"; }

  const range = Math.max(...vals) - Math.min(...vals);
  const fluctuated = range >= 2;

  return { first, last, delta, pct, trendLabel, trendClass, fluctuated };
}