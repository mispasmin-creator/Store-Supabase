import { Package2 } from 'lucide-react';
import Heading from '../element/Heading';
import { useEffect, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import type { PcReportSheet } from '@/types/sheets';
import { useAuth } from '@/context/AuthContext';
import { fetchPcReportRecords } from '@/services/pcReportService';
import { toast } from 'sonner';

export default function PcReportTable() {
    const { user } = useAuth();
    const [historyData, setHistoryData] = useState<PcReportSheet[]>([]);
    const [dataLoading, setDataLoading] = useState(true);

    const fetchHistory = async () => {
        setDataLoading(true);
        try {
            const records = await fetchPcReportRecords();
            setHistoryData(records);
        } catch (error) {
            console.error('Failed to fetch PC report records:', error);
            toast.error('Failed to load PC report data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [user.firmNameMatch]);

    // Columns for PcReportSheet
    const historyColumns: ColumnDef<PcReportSheet>[] = [
        { accessorKey: 'stage', header: 'Stage' },
        { accessorKey: 'totalPending', header: 'Total Pending' },
        { accessorKey: 'totalComplete', header: 'Total Complete' },
        { accessorKey: 'pendingPmpl', header: 'Pending PMPL' },
        { accessorKey: 'pendingPurab', header: 'Pending PURAB' },
        { accessorKey: 'pendingPmmpl', header: 'Pending PMMPL' },
        { accessorKey: 'pendingRefrasynth', header: 'Pending REFRASYNTH' },
    ];

    return (
        <div>
            <Heading heading="PC Report" subtext="View pending and completed stages report">
                <Package2 size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={historyData}
                columns={historyColumns}
                searchFields={['stage', 'totalPending', 'totalComplete']}
                dataLoading={dataLoading}
                className="h-[80dvh]"
            />
        </div>
    );
}
