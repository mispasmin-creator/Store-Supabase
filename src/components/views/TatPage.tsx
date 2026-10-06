import { useEffect, useMemo, useState } from 'react';
import { Timer, Save, RotateCcw, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import Heading from '../element/Heading';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { supabase } from '@/lib/supabase';
import { formatDateTime } from '@/lib/dateUtils';

type Stage = {
  key: string;
  name: string;
  table: string;
  plannedCol: string;
  actualCol: string;
  note?: string;
};

const STAGES: Stage[] = [
  { key: 'dept_indent_approval', name: 'Department Indent Approval', table: 'indent', plannedCol: 'planned1', actualCol: 'actual1' },
  { key: 'vendor_rate_update', name: 'Vendor Rate Update', table: 'indent', plannedCol: 'planned2', actualCol: 'actual2' },
  { key: 'mgmt_approval', name: 'Management Approval', table: 'indent', plannedCol: 'planned4', actualCol: 'actual4' },
  { key: 'create_po', name: 'Create PO', table: 'indent', plannedCol: 'planned5', actualCol: 'actual5' },
  { key: 'store_check', name: 'Store Check', table: 'store_in', plannedCol: 'planned6', actualCol: 'actual6' },
  { key: 'hod_check', name: 'HOD Check', table: 'store_in', plannedCol: 'hod_planned', actualCol: 'hod_actual' },
  { key: 'bill_not_received', name: 'Bill Not Received', table: 'store_in', plannedCol: 'planned11', actualCol: 'actual11' },
  {
    key: 'process_for_payment',
    name: 'Process for Payment',
    table: 'store_in',
    plannedCol: 'hod_actual',
    actualCol: 'payments.planned',
    note: 'Is stage me Planned = HOD approval time (store_in.hod_actual) aur Actual = Process click time (payments.planned).',
  },
  { key: 'make_payment', name: 'Make Payment', table: 'payments', plannedCol: 'planned', actualCol: 'actual' },
  { key: 'audit_data', name: 'Audit Data', table: 'tally_entry', plannedCol: 'planned1', actualCol: 'actual1' },
];

type Entry = {
  ref: string;
  party: string;
  basePlanned: Date | null;
  planned: Date | null;
  actual: Date | null;
  delay: number | null;
};

const DAY = 24 * 60 * 60 * 1000;

const addDays = (d: Date | null, days: number): Date | null => {
  if (!d) return null;
  return new Date(d.getTime() + days * DAY);
};

const delayDays = (planned: Date | null, actual: Date | null): number | null => {
  if (!planned || !actual) return null;
  return (actual.getTime() - planned.getTime()) / DAY;
};

function DelayBadge({ days }: { days: number | null }) {
  if (days === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (days <= 0) {
    return <span className="rounded px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">On time</span>;
  }
  const tone = days > 3 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
  return <span className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}>{days.toFixed(1)} din late</span>;
}

export default function TatPage() {
  const [config, setConfig] = useState<Record<string, number>>({});
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>(STAGES[0].key);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'complete'>('all');
  const [stageRows, setStageRows] = useState<Record<string, Entry[]>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchTatConfig = async () => {
    try {
      const { data, error } = await supabase.from('tat_config').select('stage_key, extra_days');
      if (error) throw error;
      const confMap: Record<string, number> = {};
      data?.forEach(row => {
        confMap[row.stage_key] = row.extra_days ?? 0;
      });
      setConfig(confMap);
      return confMap;
    } catch (err) {
      console.error('Error fetching tat_config:', err);
      return {};
    }
  };

  const fetchStageData = async (confMap: Record<string, number>) => {
    setLoading(true);
    try {
      // 🚀 Optimization: Fetch all 4 tables in PARALLEL with ONLY required columns
      const [indentRes, storeInRes, paymentsRes, tallyRes] = await Promise.all([
        supabase
          .from('indent')
          .select('indent_number, firm_name, approved_vendor_name, timestamp, planned1, actual1, planned2, actual2, planned4, actual4, planned5, actual5')
          .order('id', { ascending: false })
          .limit(100),
        supabase
          .from('store_in')
          .select('indent_no, vendor_name, party_name, timestamp, planned6, actual6, hod_planned, hod_actual, planned11, actual11')
          .order('id', { ascending: false })
          .limit(100),
        supabase
          .from('payments')
          .select('unique_no, party_name, po_number, timestamp, planned, actual')
          .order('id', { ascending: false })
          .limit(100),
        supabase
          .from('tally_entry')
          .select('indent_number, party_name, timestamp, planned1, actual1')
          .order('id', { ascending: false })
          .limit(100),
      ]);

      const indentData = (indentRes.data as Record<string, any>[]) || [];
      const storeInData = (storeInRes.data as Record<string, any>[]) || [];
      const paymentsData = (paymentsRes.data as Record<string, any>[]) || [];
      const tallyData = (tallyRes.data as Record<string, any>[]) || [];

      const results: Record<string, Entry[]> = {};

      for (const stage of STAGES) {
        const extra = confMap[stage.key] ?? 0;
        let entries: Entry[] = [];

        if (stage.table === 'indent') {
          entries = indentData.map(r => {
            const baseStr = r[stage.plannedCol] || r.timestamp;
            const basePlanned = baseStr ? new Date(baseStr) : null;
            const planned = addDays(basePlanned, extra);
            const actStr = r[stage.actualCol];
            const actual = actStr ? new Date(actStr) : null;
            return {
              ref: r.indent_number || 'SI-—',
              party: r.approved_vendor_name || r.firm_name || '—',
              basePlanned,
              planned,
              actual,
              delay: delayDays(planned, actual),
            };
          });
        } else if (stage.table === 'store_in') {
          entries = storeInData.map(r => {
            const baseStr = r[stage.plannedCol] || r.timestamp;
            const basePlanned = baseStr ? new Date(baseStr) : null;
            const planned = addDays(basePlanned, extra);
            const actStr = r[stage.actualCol];
            const actual = actStr ? new Date(actStr) : null;
            return {
              ref: r.indent_no || 'SI-—',
              party: r.vendor_name || r.party_name || '—',
              basePlanned,
              planned,
              actual,
              delay: delayDays(planned, actual),
            };
          });
        } else if (stage.table === 'payments') {
          entries = paymentsData.map(r => {
            const baseStr = r.planned || r.timestamp;
            const basePlanned = baseStr ? new Date(baseStr) : null;
            const planned = addDays(basePlanned, extra);
            const actStr = r.actual;
            const actual = actStr ? new Date(actStr) : null;
            return {
              ref: r.unique_no || r.po_number || 'PMT-—',
              party: r.party_name || '—',
              basePlanned,
              planned,
              actual,
              delay: delayDays(planned, actual),
            };
          });
        } else if (stage.table === 'tally_entry') {
          entries = tallyData.map(r => {
            const baseStr = r[stage.plannedCol] || r.timestamp;
            const basePlanned = baseStr ? new Date(baseStr) : null;
            const planned = addDays(basePlanned, extra);
            const actStr = r[stage.actualCol];
            const actual = actStr ? new Date(actStr) : null;
            return {
              ref: r.indent_number || 'SI-—',
              party: r.party_name || '—',
              basePlanned,
              planned,
              actual,
              delay: delayDays(planned, actual),
            };
          });
        }

        results[stage.key] = entries;
      }

      setStageRows(results);
    } catch (err) {
      console.error('Error fetching stage data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAll = async () => {
    const conf = await fetchTatConfig();
    await fetchStageData(conf);
  };

  useEffect(() => {
    loadAll();
  }, []);

  const extraOf = (key: string) => config[key] ?? 0;

  const summary = useMemo(() => {
    return STAGES.map(stage => {
      const extra = config[stage.key] ?? 0;
      const rows = stageRows[stage.key] || [];
      const delayed = rows.filter(r => r.delay !== null && r.delay > 0);
      return {
        stage,
        extra,
        pending: rows.filter(r => !r.actual).length,
        complete: rows.filter(r => !!r.actual).length,
        delayed: delayed.length,
        avgDelay: delayed.length ? delayed.reduce((s, r) => s + (r.delay ?? 0), 0) / delayed.length : 0,
      };
    });
  }, [STAGES, config, stageRows]);

  const selectedStage = STAGES.find(s => s.key === selected)!;
  const selectedExtra = extraOf(selected);

  const detailRows = useMemo(() => {
    const rows = stageRows[selected] || [];
    return rows
      .filter(r => (statusFilter === 'all' ? true : statusFilter === 'pending' ? !r.actual : !!r.actual))
      .sort((a, b) => (a.planned?.getTime() ?? 0) - (b.planned?.getTime() ?? 0));
  }, [stageRows, selected, statusFilter]);

  async function syncStagePlannedInSupabase(stg: Stage, days: number) {
    try {
      const table = stg.table;
      const plannedCol = stg.plannedCol;
      const actualCol = stg.actualCol.includes('.') ? stg.actualCol.split('.')[1] : stg.actualCol;

      // Fetch pending records from main table
      const { data: rows, error: fetchErr } = await supabase
        .from(table as any)
        .select(`id, timestamp, ${plannedCol}`)
        .is(actualCol, null)
        .limit(200);

      if (fetchErr || !rows || rows.length === 0) return;

      // Update each pending row's planned column in Supabase
      const updates = (rows as Record<string, any>[]).map(row => {
        const baseStr = row[plannedCol] || row.timestamp;
        if (!baseStr) return null;

        const baseDate = new Date(baseStr);
        if (isNaN(baseDate.getTime())) return null;

        const newPlannedDate = new Date(baseDate.getTime() + days * DAY);
        return supabase
          .from(table as any)
          .update({ [plannedCol]: newPlannedDate.toISOString() })
          .eq('id', row.id);
      }).filter(Boolean);

      await Promise.all(updates);
    } catch (err) {
      console.error(`Error syncing planned column for ${stg.key}:`, err);
    }
  }

  async function handleSave(key: string) {
    const raw = draft[key];
    if (raw === undefined) return;
    const days = Number(raw);
    if (!Number.isInteger(days) || days < 0 || days > 60) {
      toast.error('Extra days 0 se 60 ke beech ek poora number hona chahiye');
      return;
    }

    const stg = STAGES.find(s => s.key === key);
    if (!stg) return;

    setSavingKey(key);
    try {
      // 1. Update tat_config table in Supabase
      const { error } = await supabase
        .from('tat_config')
        .upsert({
          stage_key: stg.key,
          stage_name: stg.name,
          table_name: stg.table,
          planned_column: stg.plannedCol,
          actual_column: stg.actualCol,
          extra_days: days,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      // 2. Direct Sync in Supabase Main Table Column (indent / store_in / payments / tally_entry)
      await syncStagePlannedInSupabase(stg, days);

      const nextConfig = { ...config, [key]: days };
      setConfig(nextConfig);
      setDraft(d => {
        const { [key]: _removed, ...rest } = d;
        return rest;
      });

      toast.success(`${stg.name}: Supabase ${stg.table}.${stg.plannedCol} me +${days} din update ho gaya`);
      await fetchStageData(nextConfig);
    } catch (err: any) {
      console.error('Error saving extra days to Supabase:', err);
      toast.error('Supabase update me error aaya: ' + (err.message || err));
    } finally {
      setSavingKey(null);
    }
  }

  async function handleResetAll() {
    try {
      const updates = STAGES.map(s => ({
        stage_key: s.key,
        stage_name: s.name,
        table_name: s.table,
        planned_column: s.plannedCol,
        actual_column: s.actualCol,
        extra_days: 0,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('tat_config').upsert(updates);
      if (error) throw error;

      const resetConf: Record<string, number> = {};
      STAGES.forEach(s => (resetConf[s.key] = 0));
      setConfig(resetConf);
      setDraft({});
      toast.success('Saare extra days 0 kar diye gaya');
      await fetchStageData(resetConf);
    } catch (err: any) {
      console.error('Reset error:', err);
      toast.error('Reset error: ' + err.message);
    }
  }

  return (
    <div>
      <Heading heading="TAT Management" subtext="Live Supabase data: Planned, Actual aur Delay tracking with Extra Days adjustment.">
        <Timer size={50} className="text-primary" />
      </Heading>

      <div className="grid gap-4 m-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Stage-wise TAT (Supabase Live)
              {loading && <RefreshCw size={16} className="animate-spin text-primary ml-2" />}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadAll} disabled={loading}>
                <RefreshCw size={14} className="mr-1" /> Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetAll} disabled={loading}>
                <RotateCcw size={14} className="mr-1" /> Sab 0 karo
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead>Table / Planned column</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Complete</TableHead>
                  <TableHead className="text-right">Delayed</TableHead>
                  <TableHead className="text-right">Avg delay</TableHead>
                  <TableHead>Extra days</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map(row => {
                  const draftValue = draft[row.stage.key];
                  const changed = draftValue !== undefined && Number(draftValue) !== row.extra;
                  const isSaving = savingKey === row.stage.key;
                  return (
                    <TableRow
                      key={row.stage.key}
                      className={`cursor-pointer ${selected === row.stage.key ? 'bg-primary/5' : ''}`}
                      onClick={() => setSelected(row.stage.key)}
                    >
                      <TableCell className="font-medium">{row.stage.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.stage.table}.{row.stage.plannedCol}
                      </TableCell>
                      <TableCell className="text-right font-semibold">{row.pending}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">{row.complete}</TableCell>
                      <TableCell className={`text-right ${row.delayed ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                        {row.delayed}
                      </TableCell>
                      <TableCell className="text-right">{row.avgDelay ? `${row.avgDelay.toFixed(1)} din` : '—'}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={60}
                            className="h-8 w-20"
                            value={draftValue ?? String(row.extra)}
                            onChange={e => setDraft(d => ({ ...d, [row.stage.key]: e.target.value }))}
                          />
                          <Button size="sm" className="h-8" disabled={!changed || isSaving} onClick={() => handleSave(row.stage.key)}>
                            <Save size={14} className="mr-1" /> {isSaving ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              {selectedStage.name}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                extra days: +{selectedExtra} ({selectedStage.table}.{selectedStage.plannedCol})
              </span>
            </CardTitle>
            <div className="flex gap-1">
              {(['all', 'pending', 'complete'] as const).map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'Sab' : s === 'pending' ? 'Pending' : 'Complete'}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {selectedStage.note && (
              <p className="mb-3 rounded-md bg-muted p-2 text-xs text-muted-foreground">{selectedStage.note}</p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indent / Ref</TableHead>
                  <TableHead>Party</TableHead>
                  <TableHead>Asli planned</TableHead>
                  <TableHead>Planned (+{selectedExtra} din)</TableHead>
                  <TableHead>Actual</TableHead>
                  <TableHead>Delay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.map((r, idx) => (
                  <TableRow key={r.ref + idx}>
                    <TableCell className="font-medium">{r.ref}</TableCell>
                    <TableCell>{r.party}</TableCell>
                    <TableCell className={selectedExtra ? 'text-muted-foreground line-through text-xs font-mono' : 'text-xs font-mono'}>
                      {formatDateTime(r.basePlanned)}
                    </TableCell>
                    <TableCell className={selectedExtra ? 'font-bold text-primary text-xs font-mono' : 'text-xs font-mono'}>
                      {formatDateTime(r.planned)}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {r.actual ? formatDateTime(r.actual) : <span className="text-amber-600 font-medium">Pending</span>}
                    </TableCell>
                    <TableCell>
                      <DelayBadge days={r.delay} />
                    </TableCell>
                  </TableRow>
                ))}
                {detailRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      {loading ? 'Data load ho raha hai...' : 'Is stage me koi record nahi mila'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
