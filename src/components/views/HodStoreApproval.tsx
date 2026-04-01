import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    fetchStoreInRecords,
    updateStoreInHodApproval,
    type StoreInRecord,
} from '@/services/storeInService';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { UserCheck, X } from 'lucide-react';
import { Tabs, TabsContent } from '../ui/tabs';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { formatDateTime, parseCustomDate } from '@/lib/utils';
import { Pill } from '../ui/pill';

interface HodPendingData {
    liftNumber: string;
    indentNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    receivingStatus: string;
    receivedQuantity: number;
    damageOrder: string;
    quantityAsPerBill: string;
    priceAsPerPoCheck: string;
    remark: string;
    plannedHod: string;
    timestamp: string;
    firmNameMatch: string;
}

interface HodHistoryData {
    liftNumber: string;
    indentNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    hodStatus: string;
    hodRemark: string;
    hodDate: string;
    firmNameMatch: string;
}

const schema = z.object({
    status: z.enum(['Approved', 'Rejected']),
    remark: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default () => {
    const { user } = useAuth();
    const [storeInRecords, setStoreInRecords] = useState<StoreInRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [pendingData, setPendingData] = useState<HodPendingData[]>([]);
    const [historyData, setHistoryData] = useState<HodHistoryData[]>([]);
    const [selectedItem, setSelectedItem] = useState<HodPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            status: undefined,
            remark: '',
        },
    });

    const fetchAllData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchStoreInRecords();
            setStoreInRecords(records);
        } catch (error) {
            console.error('Failed to fetch store-in records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        const filteredByFirm = storeInRecords.filter((item) =>
            user.firmNameMatch?.toLowerCase() === "all" || item.firmNameMatch === user.firmNameMatch
        );

        setPendingData(
            filteredByFirm
                .filter((i) => i.plannedHod !== '' && i.actualHod === '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: Number(i.qty) || 0,
                    receivingStatus: i.receivingStatus || '',
                    receivedQuantity: Number(i.receivedQuantity) || 0,
                    damageOrder: i.damageOrder || '',
                    quantityAsPerBill: i.quantityAsPerBill || '',
                    priceAsPerPoCheck: i.priceAsPerPoCheck || '',
                    remark: i.remark || '',
                    plannedHod: i.plannedHod || '',
                    timestamp: i.timestamp || '',
                    firmNameMatch: i.firmNameMatch || '',
                }))
        );

        setHistoryData(
            filteredByFirm
                .filter((i) => i.plannedHod !== '' && i.actualHod !== '')
                .map((i) => ({
                    liftNumber: i.liftNumber || '',
                    indentNo: i.indentNo || '',
                    vendorName: i.vendorName || '',
                    productName: i.productName || '',
                    qty: Number(i.qty) || 0,
                    hodStatus: i.hodStatus || '',
                    hodRemark: i.hodRemark || '',
                    hodDate: i.actualHod ? formatDateTime(new Date(i.actualHod)) : '',
                    firmNameMatch: i.firmNameMatch || '',
                }))
        );
    }, [storeInRecords, user.firmNameMatch]);

    async function onSubmit(values: FormValues) {
        if (!selectedItem) return;
        try {
            const currentDateTime = new Date().toISOString();

            // Trigger stage 7 if rejected by HOD OR if store reports issues
            const hasStoreIssues =
                selectedItem.damageOrder === 'No' ||
                selectedItem.quantityAsPerBill === 'No' ||
                selectedItem.priceAsPerPoCheck === 'No';

            const triggerStage7 = values.status === 'Rejected' || hasStoreIssues;

            await updateStoreInHodApproval(selectedItem.liftNumber, {
                actualHod: currentDateTime,
                hodStatus: values.status,
                hodRemark: values.remark || '',
                triggerStage7: triggerStage7
            });

            toast.success(`HOD ${values.status} for ${selectedItem.liftNumber}`);
            setOpenDialog(false);
            fetchAllData();
        } catch (error) {
            console.error('Error in onSubmit:', error);
            toast.error('Failed to update HOD approval');
        }
    }

    const pendingColumns: ColumnDef<HodPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }) => (
                <DialogTrigger asChild>
                    <Button variant="outline" onClick={() => setSelectedItem(row.original)}>
                        Check
                    </Button>
                </DialogTrigger>
            ),
        },
        { accessorKey: 'liftNumber', header: 'Lift No.' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'productName', header: 'Product' },
        { accessorKey: 'vendorName', header: 'Vendor' },
        { accessorKey: 'qty', header: 'Order Qty' },
        { accessorKey: 'receivedQuantity', header: 'Rec. Qty' },
        {
            accessorKey: 'damageOrder',
            header: 'Physical Good?',
            cell: ({ getValue }) => {
                const val = getValue() as string;
                return (
                    <Pill variant={val === 'Yes' ? 'default' : 'reject'}>
                        {val || 'N/A'}
                    </Pill>
                );
            }
        },
    ];

    const historyColumns: ColumnDef<HodHistoryData>[] = [
        { accessorKey: 'liftNumber', header: 'Lift No.' },
        { accessorKey: 'indentNo', header: 'Indent No.' },
        { accessorKey: 'productName', header: 'Product' },
        {
            accessorKey: 'hodStatus', header: 'HOD Status',
            cell: ({ getValue }) => {
                const val = (getValue() || '') as string;
                return (
                    <Pill variant={val === 'Approved' ? 'default' : 'reject'}>
                        {val}
                    </Pill>
                );
            }
        },
        { accessorKey: 'hodRemark', header: 'Remark' },
        { accessorKey: 'hodDate', header: 'Date' },
    ];

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="HOD Check"
                        subtext="Validate store receiving results"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <UserCheck size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable data={pendingData} columns={pendingColumns} searchFields={['liftNumber', 'indentNo', 'productName']} dataLoading={dataLoading} />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable data={historyData} columns={historyColumns} searchFields={['liftNumber', 'indentNo', 'productName']} dataLoading={dataLoading} />
                    </TabsContent>
                </Tabs>

                {selectedItem && (
                    <DialogContent className="sm:max-w-2xl">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <DialogHeader>
                                    <DialogTitle>HOD Approval for {selectedItem.liftNumber}</DialogTitle>
                                    <DialogDescription>Review store receiving details before finalization.</DialogDescription>
                                </DialogHeader>

                                <div className="grid grid-cols-2 gap-4 bg-muted p-4 rounded-lg text-sm">
                                    <div><p className="font-bold">Product:</p> {selectedItem.productName}</div>
                                    <div><p className="font-bold">Vendor:</p> {selectedItem.vendorName}</div>
                                    <div><p className="font-bold">Order Qty:</p> {selectedItem.qty}</div>
                                    <div><p className="font-bold">Rec. Qty:</p> {selectedItem.receivedQuantity}</div>

                                    <div className="col-span-2 pt-2 border-t font-semibold">Store Check Results:</div>
                                    <div><p className="font-medium">Physical Good?</p>
                                        <Pill variant={selectedItem.damageOrder === 'Yes' ? 'default' : 'reject'}>{selectedItem.damageOrder}</Pill>
                                    </div>
                                    <div><p className="font-medium">Qty Match?</p>
                                        <Pill variant={selectedItem.quantityAsPerBill === 'Yes' ? 'default' : 'reject'}>{selectedItem.quantityAsPerBill}</Pill>
                                    </div>
                                    <div><p className="font-medium">Rate Match?</p>
                                        <Pill variant={selectedItem.priceAsPerPoCheck === 'Yes' ? 'default' : 'reject'}>{selectedItem.priceAsPerPoCheck}</Pill>
                                    </div>
                                    <div className="col-span-2"><p className="font-medium">Store Remark:</p> {selectedItem.remark || 'None'}</div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>HOD Decision</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select outcome" /></SelectTrigger></FormControl>
                                                <SelectContent>
                                                    <SelectItem value="Approved">Approve</SelectItem>
                                                    <SelectItem value="Rejected">Reject</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="remark"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>HOD Remark</FormLabel>
                                            <FormControl><Input placeholder="Optional remark" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter>
                                    <DialogClose asChild><Button variant="outline">Back</Button></DialogClose>
                                    <Button type="submit">Submit Decision</Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
};
