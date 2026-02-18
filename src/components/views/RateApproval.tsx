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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Users } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDate } from '@/lib/utils';
import { Input } from '../ui/input';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface RateApprovalData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    comparisonSheet: string;
    vendors: [string, string, string, string, string, string][];
    date: string;
    firmNameMatch?: string;
    plannedDate: string; // ✅ ADD THIS

}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    vendor: [string, string];
    date: string;
}

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
                .eq('vendor_type', 'Three Party');

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setTableData(
                rows.map((r) => ({
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    indenter: r.indenter_name || '',
                    department: r.department || '',
                    product: r.product_name || '',
                    comparisonSheet: r.comparison_sheet || '',
                    date: formatDate(new Date(r.timestamp)),
                    plannedDate: r.planned3 ? formatDate(new Date(r.planned3)) : 'Not Set',
                    vendors: [
                        [
                            r.vendor_name1 || '', 
                            r.rate1?.toString() || '0', 
                            r.payment_term1 || '',
                            r.select_rate_type1 || 'With Tax',
                            r.with_tax_or_not1 || 'Yes',
                            r.tax_value1?.toString() || '0'
                        ],
                        [
                            r.vendor_name2 || '', 
                            r.rate2?.toString() || '0', 
                            r.payment_term2 || '',
                            r.select_rate_type2 || 'With Tax',
                            r.with_tax_or_not2 || 'Yes',
                            r.tax_value2?.toString() || '0'
                        ],
                        [
                            r.vendor_name3 || '', 
                            r.rate3?.toString() || '0', 
                            r.payment_term3 || '',
                            r.select_rate_type3 || 'With Tax',
                            r.with_tax_or_not3 || 'Yes',
                            r.tax_value3?.toString() || '0'
                        ],
                    ],
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
                .not('actual3', 'is', null)
                .eq('vendor_type', 'Three Party');

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            setHistoryData(
                rows.map((r) => ({
                    indentNo: r.indent_number || '',
                    firmNameMatch: r.firm_name_match || '',
                    indenter: r.indenter_name || '',
                    department: r.department || '',
                    product: r.product_name || '',
                    date: new Date(r.timestamp).toDateString(),
                    vendor: [r.approved_vendor_name || '', r.approved_rate?.toString() || '0'],
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
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedIndent(indent);
                                        }}
                                    >
                                        Approve
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: 'Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'date', header: 'Date' },
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
        {
            accessorKey: 'comparisonSheet',
            header: 'Comparison Sheet',
            cell: ({ row }) => {
                const sheet = row.original.comparisonSheet;
                return sheet ? (
                    <a href={sheet} target="_blank" rel="noopener noreferrer">
                        Comparison Sheet
                    </a>
                ) : (
                    <></>
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
                        <div>
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedHistory(indent);
                                    }}
                                >
                                    Update
                                </Button>
                            </DialogTrigger>
                        </div>
                    );
                },
            },
        ] : []),
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'firmNameMatch', header: ' Firm Name' },
        { accessorKey: 'indenter', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        { accessorKey: 'product', header: 'Product' },
        { accessorKey: 'date', header: 'Date' },
        {
            accessorKey: 'vendor',
            header: 'Vendor',
            cell: ({ row }) => {
                const vendor = row.original.vendor;
                return (
                    <div className="grid place-items-center">
                        <div className="flex flex-col gap-1">
                            <span className="rounded-full text-xs px-3 py-1 bg-accent text-accent-foreground border border-accent-foreground">
                                {vendor[0]} - &#8377;{vendor[1]}
                            </span>
                        </div>
                    </div>
                );
            },
        },
    ];

    const schema = z.object({
        vendor: z.coerce.number(),
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: {
            vendor: undefined,
        },
    });

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            const selectedVendor = selectedIndent?.vendors[values.vendor];
            
            const updates = {
                actual3: new Date().toISOString(),
                approved_vendor_name: selectedVendor?.[0] || '',
                approved_rate: selectedVendor?.[1] || '0',
                approved_payment_term: selectedVendor?.[2] || '',
                with_tax_or_not4: selectedVendor?.[4] || 'Yes',
                tax_value4: selectedVendor?.[5] || '0',
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;
            
            toast.success(`Approved vendor for ${selectedIndent?.indentNo}`);
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

    const historyUpdateSchema = z.object({
        rate: z.coerce.number(),
    })

    const historyUpdateForm = useForm<z.infer<typeof historyUpdateSchema>>({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            rate: 0,
        },
    })

    useEffect(() => {
        if (selectedHistory) {
            historyUpdateForm.reset({ rate: parseInt(selectedHistory.vendor[1]) || 0 })
        }
    }, [selectedHistory, historyUpdateForm])

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            const { error } = await supabase
                .from('indent')
                .update({ approved_rate: values.rate.toString() })
                .eq('indent_number', selectedHistory?.indentNo);

            if (error) throw error;

            toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ rate: 0 });
            
            // Refresh history table
            fetchCompletedApprovals();
        } catch (err) {
            console.error('Error updating rate:', err);
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
                        heading="Three Party Rate Approval"
                        subtext="Approve rates for three party vendors"
                        tabs
                    >
                        <Users size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        <DataTable
                            data={tableData}
                            columns={columns}
                            searchFields={['product', 'department', 'indenter' ,'firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product', 'department', 'indenter','firmNameMatch']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="space-y-5"
                            >
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Rate Approval</DialogTitle>
                                    <DialogDescription>
                                        Update vendor for{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted py-2 px-5 rounded-md ">
                                    <div className="space-y-1">
                                        <p className="font-medium">Indenter</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.indenter}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Department</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.department}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="font-medium">Product</p>
                                        <p className="text-sm font-light">
                                            {selectedIndent.product}
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="vendor"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Select a vendor</FormLabel>
                                                <FormControl>
                                                    <RadioGroup onValueChange={field.onChange} value={field.value?.toString()}>
                                                        {selectedIndent.vendors.map(
                                                            (vendor, index) => {
                                                                return (
                                                                    <FormItem key={index}>
                                                                        <FormLabel className="flex items-center gap-4 border hover:bg-accent p-3 rounded-md cursor-pointer">
                                                                            <FormControl>
                                                                                <RadioGroupItem value={`${index}`} />
                                                                            </FormControl>
                                                                            <div className="font-normal w-full">
                                                                                <div className="flex justify-between items-center w-full">
                                                                                    <div className="flex-1">
                                                                                        <p className="font-medium text-base">
                                                                                            {vendor[0]}
                                                                                        </p>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            Payment Term: {vendor[2]}
                                                                                        </p>
                                                                                        
                                                                                        {vendor[3] === 'Basic Rate' && vendor[4] === 'No' ? (
                                                                                            <p className="text-xs text-orange-600 font-medium mt-1">
                                                                                                Without Tax - GST: {vendor[5]}%
                                                                                            </p>
                                                                                        ) : vendor[3] === 'With Tax' && vendor[4] === 'Yes' ? (
                                                                                            <p className="text-xs text-green-600 font-medium mt-1">
                                                                                                With Tax
                                                                                            </p>
                                                                                        ) : (
                                                                                            <p className="text-xs text-green-600 font-medium mt-1">
                                                                                                With Tax
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                    <div className="text-right">
                                                                                        <p className="text-base font-semibold">
                                                                                            &#8377;{vendor[1]}
                                                                                        </p>
                                                                                        {vendor[3] === 'Basic Rate' && vendor[4] === 'No' && (
                                                                                            <p className="text-xs text-muted-foreground">
                                                                                                Basic Rate
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                );
                                                            }
                                                        )}
                                                    </RadioGroup>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button type="submit" disabled={form.formState.isSubmitting}>
                                        {form.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {selectedHistory && (
                    <DialogContent>
                        <Form {...historyUpdateForm}>
                            <form onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)} className="space-y-7">
                                <DialogHeader className="space-y-1">
                                    <DialogTitle>Update Rate</DialogTitle>
                                    <DialogDescription>
                                        Update rate for{' '}
                                        <span className="font-medium">
                                            {selectedHistory.indentNo}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-3">
                                    <FormField
                                        control={historyUpdateForm.control}
                                        name="rate"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rate</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>

                                    <Button
                                        type="submit"
                                        disabled={historyUpdateForm.formState.isSubmitting}
                                    >
                                        {historyUpdateForm.formState.isSubmitting && (
                                            <Loader
                                                size={20}
                                                color="white"
                                                aria-label="Loading Spinner"
                                            />
                                        )}
                                        Update
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