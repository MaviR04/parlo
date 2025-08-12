import { Pie } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// Map tag.color (e.g. "gold", "green") -> canvas-friendly fill/border
const colorHexMap = {
    blue: { fill: "#bfdbfe", border: "#2563eb" }, // blue-200 / blue-600
    green: { fill: "#bbf7d0", border: "#16a34a" }, // green-200 / green-600
    gold: { fill: "#fef08a", border: "#ca8a04" }, // yellow-200/600 (gold)
    red: { fill: "#fecaca", border: "#dc2626" }, // red-200 / red-600
    orange: { fill: "#fed7aa", border: "#ea580c" }, // orange-200 / orange-600
    purple: { fill: "#e9d5ff", border: "#9333ea" }, // purple-200 / purple-600
    pink: { fill: "#fbcfe8", border: "#db2777" }, // pink-200 / pink-600
    teal: { fill: "#99f6e4", border: "#0d9488" }, // teal-200 / teal-600
    indigo: { fill: "#c7d2fe", border: "#4f46e5" }, // indigo-200 / indigo-600
    gray: { fill: "#e5e7eb", border: "#4b5563" }, // gray-200 / gray-600
    brown: { fill: "#d4d4d4", border: "#525252" }, // neutral-300 / neutral-600
};
const getColors = (name) => colorHexMap[name] || { fill: "#e5e7eb", border: "#4b5563" };

// date-only formatter
const fmtDay = (d) =>
    new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(d));

export default function BadgeDistributionPie({
    tags,
    logs,
    weeks,                 // ["YYYY-MM-DD", ...] (optional)
    selectedTagIds,
    onToggleTag,
    onSliceClick,
}) {
    const allowed = weeks ? new Set(weeks) : null;

    const countByTag = new Map(); // tagid -> count
    for (const log of logs || []) {
        if (allowed) {
            const wk = log.week_start && new Date(log.week_start);
            const key = wk && `${wk.getFullYear()}-${String(wk.getMonth() + 1).padStart(2, "0")}-${String(
                wk.getDate()
            ).padStart(2, "0")}`;
            if (wk && !allowed.has(key)) continue;
        }
        for (const tid of Array.isArray(log.tagids) ? log.tagids : []) {
            countByTag.set(tid, (countByTag.get(tid) || 0) + 1);
        }
    }

    const labels = [];
    const fillColors = [];
    const borderColors = [];
    const values = [];
    const tagOrder = [];

    for (const t of tags || []) {
        const v = countByTag.get(t.tagid) || 0;
        if (v <= 0) continue;
        const { fill, border } = getColors(t.color);
        labels.push(t.name);
        fillColors.push(fill);
        borderColors.push(border);
        values.push(v);
        tagOrder.push(t.tagid);
    }

    const data = {
        labels,
        datasets: [
            {
                data: values,
                backgroundColor: fillColors,
                borderColor: borderColors,
                borderWidth: 2,
                hoverOffset: 8,
                cutout: "55%",
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                displayColors: true,
                callbacks: {
                    title: (items) => items[0]?.label ?? "",
                    label: (ctx) => {
                        const val = ctx.parsed ?? 0;
                        const total = values.reduce((a, b) => a + b, 0) || 1;
                        const pct = Math.round((val / total) * 100);
                        return `${val} (${pct}%)`;
                    },
                    footer: () =>
                        weeks?.length === 1 ? `Week of ${fmtDay(weeks[0])}` : undefined,
                },
            },
        },
        onClick: (_, elems) => {
            const el = elems?.[0];
            if (!el) return;
            const tagid = tagOrder[el.index];
            (onSliceClick || onToggleTag)?.(tagid);
        },
    };

    return (
        <div className="flex flex-col gap-3">
            {/* clickable legend chips */}
            <div className="flex flex-wrap gap-2">
                {tagOrder.map((tid, i) => {
                    const t = tags.find((x) => x.tagid === tid);
                    const pressed = selectedTagIds?.has(tid);
                    const { fill, border } = getColors(t?.color);
                    return (
                        <button
                            key={tid}
                            onClick={() => onToggleTag?.(tid)}
                            className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs transition ${pressed ? "ring-2 ring-offset-1 ring-blue-500 font-semibold" : "hover:bg-gray-100"
                                }`}
                            title={`Filter: ${t?.name || "Tag"}`}
                            style={{ borderColor: border }}
                        >
                            <span
                                className="w-3.5 h-3.5 inline-block rounded border"
                                style={{ background: fill, borderColor: border }}
                            />
                            <span className="truncate max-w-[140px]">{t?.name || t?.tagid}</span>
                        </button>
                    );
                })}
            </div>

            <div className="w-full" style={{ height: 300 }}>
                {values.length ? (
                    <Pie data={data} options={options} />
                ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-sm border rounded">
                        No badges found for the selected range.
                    </div>
                )}
            </div>
        </div>
    );
}
