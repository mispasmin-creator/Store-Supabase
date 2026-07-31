import {
    PackageCheck, ClipboardList, CheckSquare, UserCog, Users, Clock,
    ArrowUpCircle, CheckCircle2, UserCheck, Truck, CreditCard, FileX,
    Send, BarChart2, FileWarning, RefreshCw, Activity, ShieldCheck
} from 'lucide-react';
import Heading from '../element/Heading';
import type { PcReportSheet } from '@/types/sheets';
import { useSheets } from '@/context/SheetsContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

// ── Stage icon + color config ──────────────────────────────
const STAGE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
    'Store Issue': { icon: <ClipboardList size={18} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
    'Department Indent Approval': { icon: <CheckSquare size={18} />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
    'Vendor Rate Update': { icon: <UserCog size={18} />, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
    'Department Approval': { icon: <Users size={18} />, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
    'Management Approval': { icon: <ShieldCheck size={18} />, color: 'text-fuchsia-600', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200' },
    'Pending PO': { icon: <Clock size={18} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
    'Lifting': { icon: <ArrowUpCircle size={18} />, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
    'Store Check': { icon: <CheckCircle2 size={18} />, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/30' },
    'HOD Check': { icon: <UserCheck size={18} />, color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200' },
    'Freight Payment': { icon: <Truck size={18} />, color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' },
    'Make Payment': { icon: <CreditCard size={18} />, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
    'Reject For GRN': { icon: <FileX size={18} />, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
    'Send Debit Note': { icon: <Send size={18} />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200' },
    'Audit Data': { icon: <BarChart2 size={18} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
    'Bill Not Received': { icon: <FileWarning size={18} />, color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
    'Process for Payment': { icon: <RefreshCw size={18} />, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
};

// ── Firm config ────────────────────────────────────────────
const FIRMS: { key: keyof PcReportSheet; label: string; hex: string; pill: string; card: string }[] = [
    { key: 'pendingPmpl', label: 'PMPL', hex: '#3b82f6', pill: 'bg-blue-100 text-blue-700', card: 'bg-blue-50 border-blue-200' },
    { key: 'pendingPurab', label: 'PURAB', hex: '#8b5cf6', pill: 'bg-violet-100 text-violet-700', card: 'bg-violet-50 border-violet-200' },
    { key: 'pendingPmmpl', label: 'PMMPL', hex: '#f97316', pill: 'bg-orange-100 text-orange-700', card: 'bg-orange-50 border-orange-200' },
    { key: 'pendingRefrasynth', label: 'REFRASYNTH', hex: '#14b8a6', pill: 'bg-teal-100 text-teal-700', card: 'bg-teal-50 border-teal-200' },
];

// ── Single stage card ──────────────────────────────────────
function StageCard({ stage }: { stage: PcReportSheet }) {
    const cfg = STAGE_CONFIG[stage.stage] ?? { icon: <Activity size={18} />, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200' };
    const pending = Number(stage.totalPending) || 0;
    const complete = Number(stage.totalComplete) || 0;
    const total = pending + complete;
    const pct = total > 0 ? Math.round((complete / total) * 100) : 100;
    const allClear = pending === 0;
    const numColor = allClear ? 'text-green-600' : pending > 15 ? 'text-red-600' : pending > 7 ? 'text-orange-500' : 'text-amber-500';

    return (
        <div className={`rounded-xl border ${cfg.border} bg-white p-4 transition-all duration-200 hover:shadow-md flex flex-col gap-2`}>
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${cfg.bg} ${cfg.color} shrink-0`}>{cfg.icon}</div>
                {allClear && (
                    <span className="text-[9px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">✓ Clear</span>
                )}
            </div>

            {/* Stage name */}
            <p className="font-semibold text-sm leading-tight text-foreground">{stage.stage}</p>

            {/* Counts */}
            <div className="flex items-end justify-between">
                <div>
                    <p className={`text-3xl font-black leading-none ${numColor}`}>{pending}</p>
                    <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Pending</p>
                </div>
                <div className="text-right">
                    <p className="text-xl font-bold text-green-600 leading-none">{complete}</p>
                    <p className="text-[9px] uppercase font-semibold text-muted-foreground mt-0.5">Done</p>
                </div>
            </div>

            {/* Progress bar */}
            <div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${allClear ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="text-[9px] text-muted-foreground mt-0.5">{pct}% complete</p>
            </div>

            {/* Firm breakdown pills */}
            <div className="flex flex-wrap gap-1 min-h-[18px]">
                {FIRMS.map(f => {
                    const count = Number(stage[f.key] || 0);
                    if (count === 0) return null;
                    return (
                        <span key={f.label} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${f.pill}`}>
                            {f.label}: {count}
                        </span>
                    );
                })}
                {allClear && (
                    <span className="text-[9px] text-muted-foreground italic">All firms clear</span>
                )}
            </div>
        </div>
    );
}

// ── Main component ─────────────────────────────────────────
export default function PcReportTable() {
    const { pcReportSheet, allLoading } = useSheets();

    const summary = useMemo(() => {
        const totalPending = pcReportSheet.reduce((s, r) => s + (Number(r.totalPending) || 0), 0);
        const totalComplete = pcReportSheet.reduce((s, r) => s + (Number(r.totalComplete) || 0), 0);
        const total = totalPending + totalComplete;
        const overallPct = total > 0 ? Math.round((totalComplete / total) * 100) : 0;
        const clearStages = pcReportSheet.filter(r => Number(r.totalPending) === 0).length;
        const worstStage = [...pcReportSheet].sort((a, b) => Number(b.totalPending) - Number(a.totalPending))[0];

        const firmTotals = FIRMS.map(f => ({
            ...f,
            total: pcReportSheet.reduce((s, r) => s + (Number(r[f.key]) || 0), 0),
        }));

        return { totalPending, totalComplete, total, overallPct, clearStages, worstStage, firmTotals };
    }, [pcReportSheet]);

    const chartData = useMemo(() =>
        [...pcReportSheet]
            .sort((a, b) => Number(b.totalPending) - Number(a.totalPending))
            .map(r => ({
                name: r.stage.length > 16 ? r.stage.slice(0, 15) + '…' : r.stage,
                pending: Number(r.totalPending) || 0,
                complete: Number(r.totalComplete) || 0,
            })),
        [pcReportSheet]
    );

    return (
        <div>
            <Heading heading="PC Report" subtext="View real-time pending and completed stages report">
                <PackageCheck size={50} className="text-primary" />
            </Heading>

            <div className="grid gap-4 m-3">

                {/* ── Overall Summary KPIs ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Overall progress */}
                    <div className="col-span-2 md:col-span-1 rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col justify-between">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Overall Progress</p>
                        <p className="text-5xl font-black text-primary mt-1">{summary.overallPct}%</p>
                        <div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden mt-2 mb-1">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${summary.overallPct}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground">{summary.totalComplete} of {summary.total} tasks done</p>
                        </div>
                    </div>

                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Total Pending</p>
                        <p className="text-4xl font-black text-red-600">{summary.totalPending}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">across all stages</p>
                    </div>

                    <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Total Completed</p>
                        <p className="text-4xl font-black text-green-600">{summary.totalComplete}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">all time</p>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Stages Clear</p>
                        <p className="text-4xl font-black text-emerald-600">{summary.clearStages}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">of {pcReportSheet.length} total stages</p>
                    </div>

                    <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 md:col-span-3 lg:col-span-1">
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Most Backlogged</p>
                        <p className="text-base font-black text-orange-600 leading-tight">{summary.worstStage?.stage || '—'}</p>
                        <p className="text-2xl font-black text-orange-500 mt-1">{Number(summary.worstStage?.totalPending) || 0} <span className="text-sm font-medium text-muted-foreground">pending</span></p>
                    </div>
                </div>

                {/* ── Firm-wise Summary ── */}
                <div>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Firm-wise Total Pending</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {summary.firmTotals.map(f => (
                            <div key={f.label} className={`rounded-xl border p-4 ${f.card}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-bold text-muted-foreground">{f.label}</p>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${f.pill}`}>Firm</span>
                                </div>
                                <p className="text-4xl font-black" style={{ color: f.hex }}>{f.total}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">total pending tasks</p>
                                {/* Mini per-stage bar */}
                                <div className="mt-3 space-y-1">
                                    {pcReportSheet
                                        .filter(r => Number(r[f.key] || 0) > 0)
                                        .slice(0, 3)
                                        .map((r, i) => (
                                            <div key={i} className="flex justify-between text-[9px]">
                                                <span className="text-muted-foreground truncate flex-1 pr-1">{r.stage}</span>
                                                <span className="font-bold shrink-0" style={{ color: f.hex }}>{Number(r[f.key])}</span>
                                            </div>
                                        ))
                                    }
                                    {pcReportSheet.filter(r => Number(r[f.key] || 0) > 0).length > 3 && (
                                        <p className="text-[9px] text-muted-foreground italic">
                                            +{pcReportSheet.filter(r => Number(r[f.key] || 0) > 0).length - 3} more stages
                                        </p>
                                    )}
                                    {f.total === 0 && (
                                        <p className="text-[9px] text-green-600 font-semibold">✓ All clear</p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Stage Cards ── */}
                <div>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stage-wise Breakdown</h2>
                    {allLoading ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="rounded-xl border bg-muted/30 h-44 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                            {pcReportSheet.map((stage, i) => (
                                <StageCard key={i} stage={stage} />
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Pending Chart ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Pending Count by Stage</CardTitle>
                            <p className="text-xs text-muted-foreground">Sorted highest to lowest · Green = clear, Amber = low, Orange = medium, Red = high</p>
                        </CardHeader>
                        <CardContent className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 70 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        angle={-40}
                                        textAnchor="end"
                                        tick={{ fontSize: 10 }}
                                        axisLine={false}
                                        tickLine={false}
                                        interval={0}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip
                                        formatter={(v: any, name: string) => [v, name === 'pending' ? 'Pending' : 'Completed']}
                                    />
                                    <Bar dataKey="pending" radius={[4, 4, 0, 0]} name="Pending">
                                        {chartData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={
                                                    entry.pending === 0 ? '#22c55e' :
                                                        entry.pending > 15 ? '#ef4444' :
                                                            entry.pending > 7 ? '#f97316' : '#f59e0b'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Firm comparison chart */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Firm Comparison</CardTitle>
                            <p className="text-xs text-muted-foreground">Total pending per firm</p>
                        </CardHeader>
                        <CardContent className="h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={summary.firmTotals.map(f => ({ name: f.label, pending: f.total, fill: f.hex }))}
                                    margin={{ top: 8, right: 8, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fontWeight: 600 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                    <Tooltip formatter={(v: any) => [v, 'Pending']} />
                                    <Bar dataKey="pending" radius={[6, 6, 0, 0]} name="Pending">
                                        {summary.firmTotals.map((f, i) => (
                                            <Cell key={i} fill={f.hex} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Quick Table Summary ── */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Full Stage Table</CardTitle>
                        <p className="text-xs text-muted-foreground">Complete data with firm-wise breakdown</p>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-2 px-3 font-semibold text-muted-foreground text-xs uppercase">Stage</th>
                                    <th className="text-center py-2 px-3 font-semibold text-red-600 text-xs uppercase">Pending</th>
                                    <th className="text-center py-2 px-3 font-semibold text-green-600 text-xs uppercase">Complete</th>
                                    {FIRMS.map(f => (
                                        <th key={f.label} className="text-center py-2 px-3 text-xs uppercase font-bold" style={{ color: f.hex }}>{f.label}</th>
                                    ))}
                                    <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs uppercase">Done %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pcReportSheet.map((r, i) => {
                                    const pending = Number(r.totalPending) || 0;
                                    const complete = Number(r.totalComplete) || 0;
                                    const total = pending + complete;
                                    const pct = total > 0 ? Math.round((complete / total) * 100) : 100;
                                    const allClear = pending === 0;
                                    return (
                                        <tr key={i} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${allClear ? 'opacity-60' : ''}`}>
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    <span className={`${STAGE_CONFIG[r.stage]?.color || 'text-gray-500'}`}>
                                                        {STAGE_CONFIG[r.stage]?.icon}
                                                    </span>
                                                    <span className="font-medium">{r.stage}</span>
                                                    {allClear && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">Clear</span>}
                                                </div>
                                            </td>
                                            <td className="text-center py-2 px-3">
                                                <span className={`font-black text-base ${allClear ? 'text-green-600' : pending > 10 ? 'text-red-600' : 'text-orange-500'}`}>
                                                    {pending}
                                                </span>
                                            </td>
                                            <td className="text-center py-2 px-3 font-semibold text-green-600">{complete}</td>
                                            {FIRMS.map(f => (
                                                <td key={f.label} className="text-center py-2 px-3">
                                                    <span className={Number(r[f.key] || 0) > 0 ? `font-bold ${f.pill.split(' ')[1]}` : 'text-muted-foreground'}>
                                                        {Number(r[f.key] || 0) || '—'}
                                                    </span>
                                                </td>
                                            ))}
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                                        <div className={`h-full rounded-full ${allClear ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs font-semibold w-8 text-right">{pct}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="border-t-2 bg-muted/30">
                                    <td className="py-2 px-3 font-bold text-xs uppercase">Total</td>
                                    <td className="text-center py-2 px-3 font-black text-red-600">{summary.totalPending}</td>
                                    <td className="text-center py-2 px-3 font-black text-green-600">{summary.totalComplete}</td>
                                    {FIRMS.map(f => (
                                        <td key={f.label} className="text-center py-2 px-3 font-black" style={{ color: f.hex }}>
                                            {summary.firmTotals.find(ft => ft.label === f.label)?.total}
                                        </td>
                                    ))}
                                    <td className="py-2 px-3 font-black text-primary text-center">{summary.overallPct}%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
