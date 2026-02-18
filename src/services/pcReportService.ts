import { supabase } from '@/lib/supabase';
import type { PcReportSheet } from '@/types/sheets';

/**
 * PC Report Service
 * Handles all Supabase operations for the PC Report component.
 */

/**
 * Fetch all PC report records from Supabase
 */
export async function fetchPcReportRecords(): Promise<PcReportSheet[]> {
    try {
        const { data, error } = await supabase
            .from('pc_report')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            stage: r.stage || '',
            totalPending: Number(r.total_pending) || 0,
            totalComplete: Number(r.total_complete) || 0,
            pendingPmpl: Number(r.pending_pmpl) || 0,
            pendingPurab: Number(r.pending_purab) || 0,
            pendingPmmpl: Number(r.pending_pmmpl) || 0,
            pendingRefrasynth: Number(r.pending_refrasynth) || 0,
        }));
    } catch (error) {
        console.error('Error fetching PC report records:', error);
        throw error;
    }
}