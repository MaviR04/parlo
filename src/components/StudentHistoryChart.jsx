import { Scatter } from "react-chartjs-2";
import {
    Chart as ChartJS,
    LinearScale,
    PointElement,
    Tooltip,
    TimeScale,
    Legend,
    Title,
} from "chart.js";
import "chartjs-adapter-date-fns";

ChartJS.register(LinearScale, PointElement, Tooltip, TimeScale, Legend, Title);

export default function StudentHistoryChart({
    logs,
    selectedWeek,
    colorizeByRating = true,
    strictHover = true,
}) {
    const DAY = 86400000;

    const toMonday = (input) => {
        if (!input) return null;
        const d = new Date(input);
        const day = d.getDay(); // 0=Sun, 1=Mon
        const diff = (day === 0 ? -6 : 1) - day; // Move to Monday
        d.setDate(d.getDate() + diff);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
    };

    const fmtShort = (d) =>
        new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
            new Date(d)
        );

    const colorForRating = (r) => {
        if (!Number.isFinite(r)) return "rgba(0,0,0,0.25)";
        if (r >= 8) return "#10b981";
        if (r >= 6) return "#34d399";
        if (r === 5) return "#f59e0b";
        if (r >= 3) return "#f97316";
        return "#ef4444";
    };

    const weekMap = new Map();
    (logs || [])
        .filter((l) => l.week_start && l.rating != null)
        .forEach((l) => {
            const wkStart = toMonday(l.week_start);
            const wkEnd = new Date(wkStart.getTime() + 6 * DAY);
            const key = wkStart.toISOString().slice(0, 10);
            const rating = Number(l.rating);
            const chosen = weekMap.get(key);

            if (!chosen || (l.date && new Date(l.date) > new Date(chosen.date))) {
                weekMap.set(key, {
                    x: wkStart, // Dot exactly on Monday
                    y: rating,
                    week_start: wkStart,
                    week_end: wkEnd,
                    date: l.date ? new Date(l.date) : wkStart,
                    student: `${l.fname || ""} ${l.lname || ""}`.trim(),
                    type: l.type || "Session",
                    comment: l.comment || "—",
                    _rating: rating,
                });
            }
        });

    const points = Array.from(weekMap.values()).sort((a, b) => a.x - b.x);

    const clampToWeek = (yyyyMmDd) => {
        const s = toMonday(yyyyMmDd);
        const e = new Date(s.getTime() + 6 * DAY);
        return [
            new Date(s.getFullYear(), s.getMonth(), s.getDate(), 0, 0, 0, 0),
            new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59, 999),
        ];
    };

    let xMin, xMax;
    if (selectedWeek) {
        [xMin, xMax] = clampToWeek(selectedWeek);
    } else if (points.length === 1) {
        const mid = points[0].x;
        xMin = new Date(mid.getTime() - 7 * DAY);
        xMax = new Date(mid.getTime() + 7 * DAY);
    } else if (points.length > 1) {
        const first = points[0].week_start;
        const last = points[points.length - 1].week_end;
        xMin = new Date(first.getFullYear(), first.getMonth(), first.getDate(), 0, 0, 0, 0);
        xMax = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59, 999);
    }

    const radius =
        points.length > 24 ? 2 :
            points.length > 12 ? 3 : 5;

    const data = {
        datasets: [
            {
                label: "Ratings",
                data: points,
                showLine: false,
                pointRadius: radius,
                pointHoverRadius: Math.max(6, radius + 3),
                pointHitRadius: strictHover ? 3 : 14,
                pointBorderWidth: 1.5,
                pointBackgroundColor: colorizeByRating
                    ? (ctx) => colorForRating(ctx.raw?._rating)
                    : undefined,
                pointBorderColor: colorizeByRating
                    ? (ctx) => colorForRating(ctx.raw?._rating)
                    : undefined,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: strictHover
            ? { mode: "point", intersect: true }
            : { mode: "nearest", intersect: false },
        layout: { padding: { top: 36, right: 12, bottom: 8, left: 12 } },
        plugins: {
            datalabels: { display: false },
            legend: { display: false },
            tooltip: {
                callbacks: {
                    title: (items) => {
                        const p = items?.[0]?.raw;
                        if (!p?.week_start) return "";
                        return `Week of ${fmtShort(p.week_start)}`;
                    },
                    label: (ctx) =>
                        `Rating: ${Number.isFinite(ctx.parsed?.y) ? ctx.parsed.y : "—"}`,
                },
            },
        },
        scales: {
            x: {
                type: "time",
                time: {
                    unit: "week",
                    tooltipFormat: "MMM d",
                    displayFormats: { week: "MMM d" }
                },
                min: xMin,
                max: xMax,
                ticks: {
                    autoSkip: false,
                    callback: (value) => {
                        const start = new Date(value);
                        // Force Monday as start of week
                        const day = start.getDay();
                        if (day !== 1) {
                            start.setDate(start.getDate() - ((day + 6) % 7));
                        }
                        const end = new Date(start);
                        end.setDate(start.getDate() + 6);

                        const fmt = (d) =>
                            d.toLocaleString(undefined, { month: "short", day: "numeric" });

                        return `${fmt(start)} – ${fmt(end)}`;
                    }
                }
            },
            y: {
                min: 1,
                max: 9,
                ticks: { stepSize: 1, precision: 0 },
            },
        },
    };

    return (
        <div className="border rounded-lg p-3 bg-white" style={{ height: 360 }}>
            <Scatter data={data} options={options} />
        </div>
    );
}
