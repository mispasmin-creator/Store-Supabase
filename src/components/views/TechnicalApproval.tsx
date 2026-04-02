import type { ColumnDef, Row } from '@tanstack/react-table';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '../ui/dialog';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { z } from 'zod';
import { type SubmitHandler, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Input } from '../ui/input';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface RateApprovalData {
    id: number;
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
    firmNameMatch?: string;
    plannedDate: string;
}

interface HistoryData {
    id: number;
    indentNo: string;
    indenter: string;
    firmNameMatch: string;
    department: string;
    product: string;
    vendors: [string, string, string, string, string, string, string, string, string, string, string][];
    date: string;
}

const technicalApprovalSchema = z.object({
    ranks: z.record(z.string()),
}).refine(data => {
    return Object.values(data.ranks).some(val => val !== '');
}, {
    message: "At least one rank must be assigned",
    path: ["ranks"],
});
type TechnicalApprovalValues = z.infer<typeof technicalApprovalSchema>;

const historyUpdateSchema = z.object({
    ranks: z.record(z.string()),
}).refine(data => {
    return Object.values(data.ranks).some(val => val !== '');
}, {
    message: "At least one rank must be assigned",
    path: ["ranks"],
});
type HistoryUpdateValues = z.infer<typeof historyUpdateSchema>;

export default () => {
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<RateApprovalData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [tableData, setTableData] = useState<RateApprovalData[]>([]);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [dataLoading, setDataLoading] = useState(false);

    // Fetch pending three party approvals from Supabase
    const fetchPendingApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .is('actual3', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setTableData(
                rows.filter(r => !r.vendor1_rank && !r.vendor2_rank && !r.vendor3_rank)
                    .map((r): RateApprovalData => ({
                        id: r.id,
                        indentNo: r.indent_number || '',
                        firmNameMatch: r.firm_name_match || '',
                        indenter: r.indenter_name || '',
                        department: r.department || '',
                        product: r.product_name || '',
                        comparisonSheet: r.comparison_sheet || '',
                        date: formatDateTime(new Date(r.timestamp)).replace(/\//g, '-'),
                        plannedDate: r.planned3 ? formatDate(new Date(r.planned3)) : 'Not Set',
                        vendors: [
                            [
                                r.vendor_name1 || '',
                                r.rate1?.toString() || '0',
                                r.payment_term1 || '',
                                r.select_rate_type1 || 'With Tax',
                                r.with_tax_or_not1 || 'Yes',
                                r.tax_value1?.toString() || '0',
                                r.quotation_no1 || '',
                                r.quotation_date1 || '',
                                r.vendor1_rank || '',
                                r.delivery_time1 || '',
                                r.make1 || ''
                            ],
                            [
                                r.vendor_name2 || '',
                                r.rate2?.toString() || '0',
                                r.payment_term2 || '',
                                r.select_rate_type2 || 'With Tax',
                                r.with_tax_or_not2 || 'Yes',
                                r.tax_value2?.toString() || '0',
                                r.quotation_no2 || '',
                                r.quotation_date2 || '',
                                r.vendor2_rank || '',
                                r.delivery_time2 || '',
                                r.make2 || ''
                            ],
                            [
                                r.vendor_name3 || '',
                                r.rate3?.toString() || '0',
                                r.payment_term3 || '',
                                r.select_rate_type3 || 'With Tax',
                                r.with_tax_or_not3 || 'Yes',
                                r.tax_value3?.toString() || '0',
                                r.quotation_no3 || '',
                                r.quotation_date3 || '',
                                r.vendor3_rank || '',
                                r.delivery_time3 || '',
                                r.make3 || ''
                            ],
                        ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
                    }))
            );
        } catch (err) {
            console.error('Error fetching pending approvals:', err);
            toast.error('Failed to fetch pending approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
    }, [user.firmNameMatch]);


    // Fetch completed three party approvals from Supabase
    const fetchCompletedApprovals = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned3', 'is', null)
                .in('vendor_type', ['Three Party', 'Regular']);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setHistoryData(
                rows.filter(r => r.vendor1_rank || r.vendor2_rank || r.vendor3_rank)
                    .map((r): HistoryData => ({
                        id: r.id,
                        indentNo: r.indent_number || '',
                        firmNameMatch: r.firm_name_match || '',
                        indenter: r.indenter_name || '',
                        department: r.department || '',
                        product: r.product_name || '',
                        date: r.actual3 ? formatDate(new Date(r.actual3)) : formatDate(new Date(r.timestamp)),
                        vendors: [
                            [
                                r.vendor_name1 || '',
                                r.rate1?.toString() || '0',
                                r.payment_term1 || '',
                                r.select_rate_type1 || 'With Tax',
                                r.with_tax_or_not1 || 'Yes',
                                r.tax_value1?.toString() || '0',
                                r.quotation_no1 || '',
                                r.quotation_date1 || '',
                                r.vendor1_rank || '',
                                r.delivery_time1 || '',
                                r.make1 || ''
                            ],
                            [
                                r.vendor_name2 || '',
                                r.rate2?.toString() || '0',
                                r.payment_term2 || '',
                                r.select_rate_type2 || 'With Tax',
                                r.with_tax_or_not2 || 'Yes',
                                r.tax_value2?.toString() || '0',
                                r.quotation_no2 || '',
                                r.quotation_date2 || '',
                                r.vendor2_rank || '',
                                r.delivery_time2 || '',
                                r.make2 || ''
                            ],
                            [
                                r.vendor_name3 || '',
                                r.rate3?.toString() || '0',
                                r.payment_term3 || '',
                                r.select_rate_type3 || 'With Tax',
                                r.with_tax_or_not3 || 'Yes',
                                r.tax_value3?.toString() || '0',
                                r.quotation_no3 || '',
                                r.quotation_date3 || '',
                                r.vendor3_rank || '',
                                r.delivery_time3 || '',
                                r.make3 || ''
                            ],
                        ].filter(vendor => vendor[0] !== '') as [string, string, string, string, string, string, string, string, string, string, string][],
                    }))
            );
        } catch (err) {
            console.error('Error fetching completed approvals:', err);
            toast.error('Failed to fetch completed approvals');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchPendingApprovals();
        fetchCompletedApprovals();
    }, [user.firmNameMatch]);

    const columns: ColumnDef<RateApprovalData>[] = [
        ...(user.threePartyApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<RateApprovalData> }) => {
                        const indent = row.original;
                        return (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setSelectedIndent(indent);
                                    setOpenDialog(true);
                                }}
                            >
                                Approve
                            </Button>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        {
            accessorKey: 'plannedDate',
            header: 'Planned Date', // ✅ ADD THIS COLUMN
            cell: ({ getValue }) => {
                const plannedDate = getValue() as string;
                return (
                    <div className={`${plannedDate === 'Not Set' ? 'text-muted-foreground italic' : ''}`}>
                        {plannedDate}
                    </div>
                );
            }
        },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor, index) => (
                                <span key={index} className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                    {vendor[0]} - &#8377;{vendor[1]}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            },
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction ? [
            {
                header: 'Action',
                cell: ({ row }: { row: Row<HistoryData> }) => {
                    const indent = row.original;

                    return (
                        <Button
                            variant="outline"
                            onClick={() => {
                                setSelectedHistory(indent);
                                setOpenDialog(true);
                            }}
                        >
                            Update
                        </Button>
                    );
                },
            },
        ] : []),
        { accessorKey: 'date', header: 'Timestamp' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: ' Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        {
            accessorKey: 'vendors',
            header: 'Vendors',
            cell: ({ row }) => {
                const vendors = row.original.vendors;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            {vendors.map((vendor, index) => {
                                const rank = vendor[8]; // rank is at index 8
                                return (
                                    <span key={index} className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                        {vendor[0]} - &#8377;{vendor[1]}
                                        {rank && (
                                            <span className="ml-2 bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                                {rank}
                                            </span>
                                        )}
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                );
            },
        },
    ];

    const form = useForm<TechnicalApprovalValues>({
        resolver: zodResolver(technicalApprovalSchema),
        defaultValues: {
            ranks: {},
        },
    });

    const onSubmit: SubmitHandler<TechnicalApprovalValues> = async (values) => {
        try {
            const hasRank = Object.values(values.ranks).some(v => v !== '');
            if (!hasRank) {
                toast.error('Please assign at least one technical rank');
                return;
            }

            const updates: any = {
                actual3: new Date().toISOString(),
                planned4: new Date().toISOString(),
            };

            // Map ranks back to their original vendor index logic.
            // Our vendors array has original elements [0], [1], [2] in `selectedIndent.vendors`.
            selectedIndent?.vendors.forEach((_, idx) => {
                const rankVal = values.ranks[idx.toString()] || '';
                // Assume vendor[0] was vendor1, vendor[1] was vendor2...
                if (idx === 0) updates.vendor1_rank = rankVal;
                if (idx === 1) updates.vendor2_rank = rankVal;
                if (idx === 2) updates.vendor3_rank = rankVal;
            });

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedIndent?.id);

            if (error) throw error;

            toast.success(`Completed Department Approval for ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            form.reset();

            // Refresh both tables
            fetchPendingApprovals();
            fetchCompletedApprovals();
        } catch (error) {
            console.error('Error approving vendor:', error);
            toast.error('Failed to update vendor');
        }
    }



    const historyUpdateForm = useForm<HistoryUpdateValues>({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            ranks: {},
        },
    })

    useEffect(() => {
        if (selectedHistory) {
            const initialRanks: Record<string, string> = {};
            selectedHistory.vendors.forEach((v, idx) => {
                initialRanks[idx.toString()] = v[8] || ''; // rank is at index 8
            });
            historyUpdateForm.reset({ ranks: initialRanks });
        }
    }, [selectedHistory, historyUpdateForm])

    const onSubmitHistoryUpdate: SubmitHandler<HistoryUpdateValues> = async (values) => {
        try {
            const hasRank = Object.values(values.ranks).some(v => v !== '');
            if (!hasRank) {
                toast.error('Please assign at least one technical rank');
                return;
            }

            const updates: any = {};
            selectedHistory?.vendors.forEach((_, idx) => {
                const rankVal = values.ranks[idx.toString()] || '';
                if (idx === 0) updates.vendor1_rank = rankVal;
                if (idx === 1) updates.vendor2_rank = rankVal;
                if (idx === 2) updates.vendor3_rank = rankVal;
            });

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('id', selectedHistory?.id);

            if (error) throw error;

            toast.success(`Updated ranks for ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ ranks: {} });

            // Refresh history table
            fetchCompletedApprovals();
        } catch (err) {
            console.error('Error updating ranks:', err);
            toast.error('Failed to update vendor');
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Department Approval"
                        subtext="Set the technical details of the vendors"
                        tabs
                        pendingCount={tableData.length}
                        historyCount={historyData.length}
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter', 'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent className="w-[95vw] md:max-w-3xl">
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader>
                                    <DialogTitle>Department Approval</DialogTitle>
                                    <DialogDescription>
                                        Assign T1, T2, T3 ranks for vendor quotes in Indent <span className="font-bold text-foreground">{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Indent Info Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border text-sm bg-muted/20">
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Indenter</p>
                                        <p>{selectedIndent.indenter}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Department</p>
                                        <p>{selectedIndent.department}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Product</p>
                                        <p className="truncate" title={selectedIndent.product}>{selectedIndent.product}</p>
                                    </div>
                                </div>

                                {/* Minimal Vendor Table */}
                                <div className="rounded-md border overflow-hidden text-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Vendor</th>
                                                <th className="px-4 py-3 font-medium text-right">Effective Rate</th>
                                                <th className="px-4 py-3 font-medium text-center">Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {(() => {
                                                const processedVendors = selectedIndent.vendors.map((v, i) => {
                                                    const rate = parseFloat(v[1]) || 0;
                                                    const tax = parseFloat(v[5]) || 0;
                                                    const total = v[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;
                                                    return { vendor: v, originalIndex: i, total };
                                                }).sort((a, b) => a.total - b.total);

                                                return processedVendors.map(({ vendor, originalIndex, total }) => (
                                                    <tr key={originalIndex} className="hover:bg-muted/10 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-foreground">{vendor[0]}</div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {vendor[6] ? `Quote: ${vendor[6]}` : ''} | {vendor[2]}
                                                                {vendor[9] ? ` | Delivery: ${vendor[9]} days` : ''}
                                                                {vendor[10] ? ` | Make: ${vendor[10]}` : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="font-bold text-primary">
                                                                &#8377;{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {vendor[3]} {vendor[3] === 'Basic Rate' ? `(+${vendor[5]}% tax)` : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center w-48">
                                                            <FormField
                                                                control={form.control}
                                                                name={`ranks.${originalIndex}`}
                                                                render={({ field }) => {
                                                                    const currentRanks = form.watch('ranks');
                                                                    const takenRanks = Object.entries(currentRanks)
                                                                        .filter(([idx, val]) => idx !== originalIndex.toString() && val !== '')
                                                                        .map(([_, val]) => val);

                                                                    return (
                                                                        <FormItem className="space-y-0">
                                                                            <FormControl>
                                                                                <div className="flex justify-center gap-1">
                                                                                    {['T1', 'T2', 'T3'].map((rank) => {
                                                                                        const isActive = field.value === rank;
                                                                                        const isTaken = takenRanks.includes(rank);

                                                                                        return (
                                                                                            <Button
                                                                                                key={rank}
                                                                                                type="button"
                                                                                                variant={isActive ? "default" : "outline"}
                                                                                                size="sm"
                                                                                                className={`h-8 w-12 px-0 text-xs font-bold transition-all ${isActive ? 'scale-110 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                                                                                                disabled={isTaken && !isActive}
                                                                                                onClick={() => {
                                                                                                    if (isActive) {
                                                                                                        field.onChange('');
                                                                                                    } else {
                                                                                                        field.onChange(rank);
                                                                                                    }
                                                                                                }}
                                                                                            >
                                                                                                {rank}
                                                                                            </Button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    );
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Save Approval
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent className="w-[95vw] md:max-w-3xl">
                        <Form {...historyUpdateForm}>
                            <form
                                onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)}
                                className="space-y-6"
                            >
                                <DialogHeader>
                                    <DialogTitle>Update Technical Ranks</DialogTitle>
                                    <DialogDescription>
                                        Update T1, T2, T3 ranks for vendor quotes in Indent <span className="font-bold text-foreground">{selectedHistory.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                {/* Indent Info Summary */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-md border text-sm bg-muted/20">
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Indenter</p>
                                        <p>{selectedHistory.indenter}</p>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Department</p>
                                        <p>{selectedHistory.department}</p>
                                    </div>
                                    <div className="md:col-span-2">
                                        <p className="font-semibold text-muted-foreground mb-1 text-xs uppercase">Product</p>
                                        <p className="truncate" title={selectedHistory.product}>{selectedHistory.product}</p>
                                    </div>
                                </div>

                                {/* Minimal Vendor Table */}
                                <div className="rounded-md border overflow-hidden text-sm">
                                    <table className="w-full text-left">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-4 py-3 font-medium">Vendor</th>
                                                <th className="px-4 py-3 font-medium text-right">Effective Rate</th>
                                                <th className="px-4 py-3 font-medium text-center">Rank</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {(() => {
                                                const processedVendors = selectedHistory.vendors.map((v, i) => {
                                                    const rate = parseFloat(v[1]) || 0;
                                                    const tax = parseFloat(v[5]) || 0;
                                                    const total = v[3] === 'Basic Rate' ? rate * (1 + tax / 100) : rate;
                                                    return { vendor: v, originalIndex: i, total };
                                                }).sort((a, b) => a.total - b.total);

                                                return processedVendors.map(({ vendor, originalIndex, total }) => (
                                                    <tr key={originalIndex} className="hover:bg-muted/10 transition-colors">
                                                        <td className="px-4 py-3">
                                                            <div className="font-semibold text-foreground">{vendor[0]}</div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {vendor[6] ? `Quote: ${vendor[6]}` : ''} | {vendor[2]}
                                                                {vendor[9] ? ` | Delivery: ${vendor[9]} days` : ''}
                                                                {vendor[10] ? ` | Make: ${vendor[10]}` : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="font-bold text-primary">
                                                                &#8377;{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground">
                                                                {vendor[3]} {vendor[3] === 'Basic Rate' ? `(+${vendor[5]}% tax)` : ''}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center w-48">
                                                            <FormField
                                                                control={historyUpdateForm.control}
                                                                name={`ranks.${originalIndex}`}
                                                                render={({ field }) => {
                                                                    const currentRanks = historyUpdateForm.watch('ranks') || {};
                                                                    const takenRanks = Object.entries(currentRanks)
                                                                        .filter(([idx, val]) => idx !== originalIndex.toString() && val !== '')
                                                                        .map(([_, val]) => val);

                                                                    return (
                                                                        <FormItem className="space-y-0">
                                                                            <FormControl>
                                                                                <div className="flex justify-center gap-1">
                                                                                    {['T1', 'T2', 'T3'].map((rank) => {
                                                                                        const isActive = field.value === rank;
                                                                                        const isTaken = takenRanks.includes(rank);

                                                                                        return (
                                                                                            <Button
                                                                                                key={rank}
                                                                                                type="button"
                                                                                                variant={isActive ? "default" : "outline"}
                                                                                                size="sm"
                                                                                                className={`h-8 w-11 px-0 transition-all ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                                                                                                disabled={isTaken}
                                                                                                onClick={() => field.onChange(isActive ? '' : rank)}
                                                                                            >
                                                                                                {rank}
                                                                                            </Button>
                                                                                        );
                                                                                    })}
                                                                                </div>
                                                                            </FormControl>
                                                                        </FormItem>
                                                                    );
                                                                }}
                                                            />
                                                        </td>
                                                    </tr>
                                                ));
                                            })()}
                                        </tbody>
                                    </table>
                                </div>

                                <DialogFooter className="gap-2 sm:gap-0 mt-2">
                                    <DialogClose asChild>
                                        <Button variant="outline" type="button">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={historyUpdateForm.formState.isSubmitting}>
                                        {historyUpdateForm.formState.isSubmitting && <Loader size={16} color="white" className="mr-2" />}
                                        Save Changes
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};