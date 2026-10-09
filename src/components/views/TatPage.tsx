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

type Row = Record<string, any>;

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
  {
    key: 'dept_approval',
    name: 'Department Approval',
    table: 'indent',
    plannedCol: 'planned3',
    actualCol: 'actual3',
    note: 'Page ki tarah sirf Three Party / Regular indents. Pending = abhi vendor rank nahi mila, Complete = rank mil gaya (actual3 hamesha nahi bharta).',
  },
  {
    key: 'mgmt_approval',
    name: 'Management Approval',
    table: 'indent',
    plannedCol: 'planned4',
    actualCol: 'actual4',
    note: 'Page ki tarah sirf Three Party / Regular indents. Pending tab me wo indents nahi aate jinme kisi vendor ko rank nahi mila. Complete = vendor approve ho chuka.',
  },
  {
    key: 'create_po',
    name: 'Create PO',
    table: 'indent',
    plannedCol: 'planned5',
    actualCol: 'po_master.timestamp',
    note: 'Pending = "Pending PO to be Created" page (po_requred = Yes aur PO Master me nahi). Complete = PO ban gaya, actual = PO Master ka time. Kuch pending indents ka planned5 khali hai, unka delay nahi nikalta.',
  },
  {
    key: 'lifting',
    name: 'Lifting',
    table: 'indent',
    plannedCol: 'planned5',
    actualCol: 'store_in.timestamp',
    note: 'Lifting page PO ke hisaab se entry dikhata hai, isliye yahan bhi PO-wise ginti hai. Planned = indent.planned5. Lifting ka apna actual column nahi hai, isliye actual = us PO ke indents ki aakhri store_in entry ka time (jab saari lifting complete ho).',
  },
  {
    key: 'store_check',
    name: 'Store Check',
    table: 'store_in',
    plannedCol: 'planned6',
    actualCol: 'actual6',
    note: 'Store Check page ki tarah: har indent + product ki sirf latest entry. Pending vendor + bill no ke hisaab se group hota hai, Complete me latest entries jinka actual6 bhara hai.',
  },
  { key: 'hod_check', name: 'HOD Check', table: 'store_in', plannedCol: 'hod_planned', actualCol: 'hod_actual' },
  { key: 'bill_not_received', name: 'Bill Not Received', table: 'store_in', plannedCol: 'planned11', actualCol: 'actual11' },
  {
    key: 'process_for_payment',
    name: 'Process for Payment',
    table: 'store_in',
    plannedCol: 'hod_actual',
    actualCol: 'payments.planned',
    note: 'Process for Payment page ki tarah: PO Master aur store-in bills party + bill no se merge hote hain, pending = outstanding (Rs 1 se zyada). Planned = HOD approval ka time, Actual = aakhri payment ka time jab outstanding 0 ho jaye.',
  },
  {
    key: 'make_payment',
    name: 'Make Payment',
    table: 'payments',
    plannedCol: 'planned',
    actualCol: 'actual',
    note: 'Make Payment page ki tarah: planned bhara ho aur status Completed na ho = pending. Har indent + product ki sirf latest pending entry.',
  },
  {
    key: 'audit_data',
    name: 'Audit Data',
    table: 'tally_entry',
    plannedCol: 'planned1',
    actualCol: 'actual1',
    note: 'Audit Data page ki tarah PO number ke hisaab se group (Audit stage). Pending = audit abhi baaki, Complete = audit ho chuka.',
  },
];

type Entry = {
  ref: string;
  party: string;
  basePlanned: Date | null;
  planned: Date | null;
  actual: Date | null;
  delay: number | null;
  // set when a stage is complete without an actual timestamp (e.g. Management Approval)
  done?: boolean;
};

const isDone = (r: Entry) => r.done ?? !!r.actual;

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
      // Read every row (not just the latest 100) so counts match the real pages.
      // PostgREST returns at most 1000 rows per request, so page through with range().
      const fetchAll = async (table: string, columns: string): Promise<Row[]> => {
        const pageSize = 1000;
        const all: Row[] = [];
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from(table as any)
            .select(columns)
            .order('id', { ascending: true })
            .range(from, from + pageSize - 1);
          if (error) throw error;
          all.push(...((data as Row[]) || []));
          if (!data || data.length < pageSize) break;
        }
        return all;
      };

      const [indentData, storeInData, paymentsData, tallyData, poMasterData] = await Promise.all([
        fetchAll(
          'indent',
          'id, indent_number, firm_name, approved_vendor_name, vendor_type, vendor1_rank, vendor2_rank, vendor3_rank, planned1, actual1, planned2, actual2, planned3, actual3, planned4, actual4, planned5, actual5, po_number, po_requred, lifting_status, approved_quantity, pending_po_qty, quantity, firm_name_match'
        ),
        fetchAll(
          'store_in',
          'id, indent_no, firm_name_match, qty, product_name, vendor_name, party_name, po_number, bill_no, bill_amount, bill_status, hod_status, timestamp, planned6, actual6, hod_planned, hod_actual, planned11, actual11'
        ),
        fetchAll('payments', 'id, unique_no, party_name, po_number, internal_code, product, pay_amount, status, status1, timestamp, planned, actual'),
        fetchAll('tally_entry', 'id, indent_number, party_name, po_number, planned1, actual1'),
        fetchAll('po_master', 'id, po_number, internal_code, party_name, total_po_amount, status, timestamp'),
      ]);

      const toDate = (v: any): Date | null => {
        if (!v) return null;
        const d = new Date(v);
        return isNaN(d.getTime()) ? null : d;
      };
      const times = (vals: any[]) => vals.map(toDate).filter((d): d is Date => d !== null).map(d => d.getTime());
      const minDate = (vals: any[]): Date | null => {
        const t = times(vals);
        return t.length ? new Date(Math.min(...t)) : null;
      };
      const maxDate = (vals: any[]): Date | null => {
        const t = times(vals);
        return t.length ? new Date(Math.max(...t)) : null;
      };
      const hasRank = (r: Row) => !!(r.vendor1_rank || r.vendor2_rank || r.vendor3_rank);
      const isThreePartyOrRegular = (r: Row) => r.vendor_type === 'Three Party' || r.vendor_type === 'Regular';

      const make = (ref: string, party: string, base: Date | null, actual: Date | null, extra: number, done?: boolean): Entry => {
        const planned = addDays(base, extra);
        return { ref, party, basePlanned: base, planned, actual, delay: delayDays(planned, actual), ...(done === undefined ? {} : { done }) };
      };

      const results: Record<string, Entry[]> = {};

      for (const stage of STAGES) {
        const extra = confMap[stage.key] ?? 0;
        const entries: Entry[] = [];
        const P = stage.plannedCol;
        const A = stage.actualCol;

        switch (stage.key) {
          // ── indent stages whose page uses: planned set, actual empty = pending; actual set = history ──
          case 'dept_indent_approval':
          case 'vendor_rate_update':
            indentData
              .filter(r => r[P])
              .forEach(r =>
                entries.push(make(r.indent_number || 'SI-—', r.approved_vendor_name || r.firm_name || '—', toDate(r[P]), toDate(r[A]), extra))
              );
            break;

          // Department Approval page: Three Party / Regular only. Pending = no vendor rank yet, history = ranked.
          case 'dept_approval':
            indentData
              .filter(r => r.planned3 && isThreePartyOrRegular(r) && (hasRank(r) || !r.actual3))
              .forEach(r =>
                entries.push(make(r.indent_number || 'SI-—', r.approved_vendor_name || r.firm_name || '—', toDate(r.planned3), toDate(r.actual3), extra, hasRank(r)))
              );
            break;

          // Management Approval page: Three Party / Regular only. Pending tab hides indents with no vendor rank.
          case 'mgmt_approval':
            indentData
              .filter(r => r.planned4 && isThreePartyOrRegular(r) && (r.approved_vendor_name || hasRank(r)))
              .forEach(r =>
                entries.push(make(r.indent_number || 'SI-—', r.approved_vendor_name || r.firm_name || '—', toDate(r.planned4), toDate(r.actual4), extra, !!r.approved_vendor_name))
              );
            break;

          // "Pending PO to be Created" page: po_requred = Yes and not yet in PO Master. Complete = PO made.
          case 'create_po': {
            const poCreatedAt = new Map<string, Date | null>();
            poMasterData.forEach(m => {
              const code = String(m.internal_code || '').trim();
              if (!code) return;
              const t = toDate(m.timestamp);
              const prev = poCreatedAt.get(code);
              if (prev === undefined || (t && (!prev || t < prev))) poCreatedAt.set(code, t);
            });
            indentData
              .filter(r => r.po_requred === 'Yes')
              .forEach(r => {
                const code = String(r.indent_number || '').trim();
                const created = poCreatedAt.has(code);
                entries.push(
                  make(r.indent_number || 'SI-—', r.approved_vendor_name || r.firm_name || '—', toDate(r.planned5), created ? poCreatedAt.get(code) ?? null : null, extra, created)
                );
              });
            break;
          }

          // Lifting page: grouped by PO; pending while lifting_status is not Complete and approved qty > received qty.
          case 'lifting': {
            const lastStoreIn: Record<string, string> = {};
            storeInData.forEach(s => {
              if (s.indent_no && s.timestamp && (!lastStoreIn[s.indent_no] || s.timestamp > lastStoreIn[s.indent_no])) {
                lastStoreIn[s.indent_no] = s.timestamp;
              }
            });
            const byPo = new Map<string, Row[]>();
            indentData
              .filter(r => r.planned5)
              .forEach(r => {
                const key = r.po_number || `NO_PO_${r.indent_number}`;
                byPo.set(key, [...(byPo.get(key) || []), r]);
              });
            // Same math as the Lifting page: received = store-in qty for that indent + firm;
            // approved = pending_po_qty, else approved_quantity, else quantity.
            const receivedByIndent = new Map<string, number>();
            storeInData.forEach(s => {
              const key = `${s.indent_no}|${s.firm_name_match}`;
              receivedByIndent.set(key, (receivedByIndent.get(key) || 0) + (Number(s.qty) || 0));
            });
            const isPendingRow = (r: Row) => {
              const status = r.lifting_status;
              if (!(status === 'Pending' || status === '' || status === null || status === undefined)) return false;
              if (r.actual5) return false;
              const approved = Number(r.pending_po_qty) > 0 ? Number(r.pending_po_qty) : Number(r.approved_quantity) > 0 ? Number(r.approved_quantity) : Number(r.quantity) || 0;
              const pendingQty = (approved || Number(r.quantity) || 0) - (receivedByIndent.get(`${r.indent_number}|${r.firm_name_match}`) || 0);
              return pendingQty > 0;
            };
            byPo.forEach((rows, po) => {
              const base = minDate(rows.map(r => r.planned5));
              let actual: Date | null = null;
              if (!rows.some(isPendingRow)) {
                actual = maxDate(rows.map(r => lastStoreIn[r.indent_number]).filter(Boolean));
                if (!actual) return; // neither pending nor completed on the page
              }
              entries.push(make(po.startsWith('NO_PO_') ? rows[0].indent_number : po, rows[0].approved_vendor_name || rows[0].firm_name || '—', base, actual, extra));
            });
            break;
          }

          // Store Check page: latest row per indent+product; pending is grouped by vendor + bill no; history = latest rows with actual6.
          case 'store_check': {
            const latest = new Map<string, Row>();
            storeInData.forEach(s => {
              const key = `${s.indent_no}-${s.product_name}`;
              const prev = latest.get(key);
              const t = toDate(s.timestamp)?.getTime() ?? 0;
              if (!prev || t > (toDate(prev.timestamp)?.getTime() ?? 0)) latest.set(key, s);
            });
            const pendingGroups = new Map<string, Row[]>();
            latest.forEach(s => {
              if (s.planned6 && !s.actual6 && (s.bill_status === 'Bill Received' || s.bill_status === 'Not Received')) {
                const key = `${s.vendor_name}-${String(s.bill_no || '')}`;
                pendingGroups.set(key, [...(pendingGroups.get(key) || []), s]);
              }
            });
            pendingGroups.forEach(rows =>
              entries.push(make(rows[0].indent_no || 'SI-—', rows[0].vendor_name || rows[0].party_name || '—', minDate(rows.map(r => r.planned6)), null, extra, false))
            );
            latest.forEach(s => {
              if (s.actual6) {
                entries.push(make(s.indent_no || 'SI-—', s.vendor_name || s.party_name || '—', toDate(s.planned6), toDate(s.actual6), extra, true));
              }
            });
            break;
          }

          // HOD Check and Bill Not Received pages: planned set, actual empty = pending; actual set = history.
          case 'hod_check':
          case 'bill_not_received':
            storeInData
              .filter(r => r[P])
              .forEach(r => entries.push(make(r.indent_no || 'SI-—', r.vendor_name || r.party_name || '—', toDate(r[P]), toDate(r[A]), extra)));
            break;

          // Process for Payment page: bills merged by party + bill no from PO Master and store-in bills; pending = outstanding > 0.
          case 'process_for_payment': {
            const norm = (v: number) => (Math.abs(v) < 1 ? 0 : Math.round(v * 100) / 100);
            const round2 = (v: number) => Math.round(v * 100) / 100;
            const paidByPo = new Map<string, number>();
            const lastPaidAt = new Map<string, Date>();
            paymentsData.forEach(p => {
              const st = String(p.status1 || p.status || '').toLowerCase();
              if (st === 'rejected' || st === 'cancelled' || !p.po_number) return;
              paidByPo.set(p.po_number, (paidByPo.get(p.po_number) || 0) + Number(p.pay_amount || 0));
              const t = toDate(p.timestamp);
              const prev = lastPaidAt.get(p.po_number);
              if (t && (!prev || t > prev)) lastPaidAt.set(p.po_number, t);
            });
            const storeByPo = new Map<string, Row[]>();
            storeInData.forEach(s => {
              if (s.po_number) storeByPo.set(s.po_number, [...(storeByPo.get(s.po_number) || []), s]);
            });
            type Bill = { ref: string; party: string; base: Date | null; outstanding: number; po: string };
            const bills = new Map<string, Bill>();
            [...poMasterData]
              .sort((a, b) => (toDate(a.timestamp)?.getTime() ?? 0) - (toDate(b.timestamp)?.getTime() ?? 0))
              .forEach(m => {
                const st = String(m.status || '').trim().toLowerCase();
                if (st === 'rejected' || st === 'cancelled') return;
                const linked = storeByPo.get(m.po_number) || [];
                const billNo = linked.map(s => s.bill_no).filter(Boolean).sort().pop() || '';
                const key = `${m.party_name || 'NoVendor'}-${billNo || `NoBill-${m.po_number}`}`;
                if (bills.has(key)) return;
                const outstanding = norm(round2(Number(m.total_po_amount || 0)) - round2(paidByPo.get(m.po_number) || 0));
                const base = maxDate(linked.map(s => s.hod_actual)) ?? minDate(linked.map(s => s.timestamp)) ?? toDate(m.timestamp);
                bills.set(key, { ref: billNo || m.po_number, party: m.party_name || '—', base, outstanding, po: m.po_number });
              });
            storeInData.forEach(s => {
              const billAmt = Number(s.bill_amount || 0);
              if (!(billAmt > 0 || String(s.bill_no || '').trim()) || !String(s.bill_status || '').trim()) return;
              const key = `${s.vendor_name || 'NoVendor'}-${s.bill_no || (s.po_number ? `NoBill-${s.po_number}` : 'NoBill')}`;
              if (bills.has(key)) return;
              bills.set(key, { ref: s.bill_no || s.po_number || s.indent_no || '—', party: s.vendor_name || '—', base: toDate(s.hod_actual) ?? toDate(s.timestamp), outstanding: norm(billAmt), po: s.po_number || '' });
            });
            bills.forEach(b => {
              const done = b.outstanding <= 0;
              entries.push(make(b.ref, b.party, b.base, done ? lastPaidAt.get(b.po) ?? null : null, extra, done));
            });
            break;
          }

          // Make Payment page: planned set and status is not Completed = pending; latest row per indent + product.
          case 'make_payment': {
            const seen = new Set<string>();
            [...paymentsData]
              .filter(p => p.planned)
              .sort((a, b) => b.id - a.id)
              .forEach(p => {
                const done = String(p.status || '').toLowerCase() === 'completed';
                if (!done) {
                  const key = `${p.internal_code}-${p.product}`;
                  if (seen.has(key)) return;
                  seen.add(key);
                }
                entries.push(make(p.unique_no || p.po_number || 'PMT-—', p.party_name || '—', toDate(p.planned), toDate(p.actual), extra, done));
              });
            break;
          }

          // Audit Data page: grouped by PO number. Pending = audit not done yet, complete = audit done.
          case 'audit_data': {
            const groups = new Map<string, Row[]>();
            tallyData
              .filter(r => r.planned1)
              .forEach(r => {
                const key = `${r.po_number || 'NO-PO'}-${r.actual1 ? 'done' : 'pending'}`;
                groups.set(key, [...(groups.get(key) || []), r]);
              });
            groups.forEach((rows, key) => {
              const done = key.endsWith('-done');
              entries.push(
                make(rows[0].po_number || rows[0].indent_number || 'SI-—', rows[0].party_name || '—', minDate(rows.map(r => r.planned1)), done ? maxDate(rows.map(r => r.actual1)) : null, extra, done)
              );
            });
            break;
          }
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
        pending: rows.filter(r => !isDone(r)).length,
        complete: rows.filter(isDone).length,
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
      .filter(r => (statusFilter === 'all' ? true : statusFilter === 'pending' ? !isDone(r) : isDone(r)))
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
                  {s === 'all' ? 'ALL' : s === 'pending' ? 'Pending' : 'Complete'}
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
                  <TableHead>Real planned</TableHead>
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
                      {r.actual ? (
                        formatDateTime(r.actual)
                      ) : isDone(r) ? (
                        <span className="text-muted-foreground">Done (actual time nahi)</span>
                      ) : (
                        <span className="text-amber-600 font-medium">Pending</span>
                      )}
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
