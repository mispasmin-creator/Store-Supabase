import { type ColumnDef, type Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useEffect, useState, useMemo } from 'react';
import { DownloadOutlined } from "@ant-design/icons";

import {
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    Dialog,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';
import { z } from 'zod';
import { useForm, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { toast } from 'sonner';
import { PuffLoader as Loader } from 'react-spinners';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ClipboardCheck, PenSquare, CheckSquare } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { Input } from '../ui/input';
import {
    fetchIndentRecords,
    updateIndentApproval,
    updateIndentSpecifications,
    updateIndentHistoryFields,
    type IndentRecord
} from '@/services/indentService';

export default function ApproveIndent() {
    const { user } = useAuth();
    const [allData, setAllData] = useState<IndentRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedIndent, setSelectedIndent] = useState<IndentRecord | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<IndentRecord>>({});
    const [downloading, setDownloading] = useState(false);

    const fetchData = async () => {
        setDataLoading(true);
        try {
            const records = await fetchIndentRecords();
            // Filter by firm name
            const filteredByFirm = records.filter(item => {
                return user.firmNameMatch.toLowerCase() === "all" || item.firm_name_match === user.firmNameMatch;
            });
            setAllData(filteredByFirm);
        } catch (error) {
            console.error('Failed to fetch indent records:', error);
            toast.error('Failed to load data');
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [user.firmNameMatch]);

    const pendingData = useMemo(() => {
        return allData.filter(i => i.planned1 && !i.actual1);
    }, [allData]);

    const historyData = useMemo(() => {
        return allData.filter(i => i.planned1 && i.actual1);
    }, [allData]);

    const handleDownload = (data: any[]) => {
        if (!data || data.length === 0) {
            toast.error("No data to download");
            return;
        }

        const headers = Object.keys(data[0]);
        const csvRows = [
            headers.join(","),
            ...data.map(row =>
                headers.map(h => `"${String(row[h] ?? "").replace(/"/g, '""')}"`).join(",")
            )
        ];
        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `approve-indent-data-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleEditClick = (row: IndentRecord) => {
        setEditingRow(row.indent_number);
        setEditValues({
            approved_quantity: row.approved_quantity,
            uom: row.uom,
            vendor_type: row.vendor_type,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (indentNumber: string) => {
        try {
            await updateIndentHistoryFields(indentNumber, {
                approved_quantity: Number(editValues.approved_quantity),
                uom: editValues.uom,
                vendor_type: editValues.vendor_type,
            });

            toast.success(`Updated indent ${indentNumber}`);
            fetchData();
            setEditingRow(null);
            setEditValues({});
        } catch (err) {
            console.error('Error updating indent:', err);
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof IndentRecord, value: any) => {
        setEditValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSpecificationUpdate = async (indentNumber: string, value: string) => {
        try {
            await updateIndentSpecifications(indentNumber, value);
            toast.success(`Updated specifications for ${indentNumber}`);
            fetchData();
        } catch (err) {
            console.error('Error updating specifications:', err);
            toast.error('Failed to update specifications');
        }
    };

    const columns: ColumnDef<IndentRecord>[] = [
        ...(user.indentApprovalAction
            ? [
                {
                    header: 'Action',
                    id: 'action',
                    cell: ({ row }: { row: Row<IndentRecord> }) => {
                        const indent = row.original;
                        return (
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setSelectedIndent(indent);
                                        setOpenDialog(true);
                                    }}
                                >
                                    Approve
                                </Button>
                            </DialogTrigger>
                        );
                    },
                },
            ]
            : []),
        { accessorKey: 'indent_number', header: 'Indent No.' },
        { accessorKey: 'firm_name_match', header: 'Firm Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        { accessorKey: 'quantity', header: 'Quantity' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ row, getValue }) => {
                const [value, setValue] = useState(getValue() as string);
                const [isEditing, setIsEditing] = useState(false);
                const indentNumber = row.original.indent_number;

                const handleBlur = async () => {
                    setIsEditing(false);
                    if (value !== getValue()) {
                        await handleSpecificationUpdate(indentNumber, value);
                    }
                };

                return (
                    <div className="max-w-[150px]">
                        {isEditing ? (
                            <Input
                                value={value}
                                onChange={(e) => setValue(e.target.value)}
                                onBlur={handleBlur}
                                autoFocus
                                className="border-1 focus:border-2"
                            />
                        ) : (
                            <div
                                className="break-words whitespace-normal cursor-pointer p-2 hover:bg-gray-50 rounded"
                                onClick={() => setIsEditing(true)}
                                tabIndex={0}
                            >
                                {value || 'Click to edit...'}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'vendor_type',
            header: 'Vendor Type',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.vendor_type;
                return (
                    <Pill
                        variant={
                            status === 'Reject'
                                ? 'reject'
                                : status === 'Regular'
                                    ? 'primary'
                                    : 'secondary'
                        }
                    >
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'attachment',
            header: 'Attachment',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const attachment = row.original.attachment;
                return attachment ? (
                    <a href={attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        Attachment
                    </a>
                ) : null;
            },
        },
        {
            accessorKey: 'timestamp',
            header: 'Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        }
    ];

    const historyColumns: ColumnDef<IndentRecord>[] = [
        { accessorKey: 'indent_number', header: 'Indent No.' },
        { accessorKey: 'firm_name_match', header: 'Firm Name' },
        { accessorKey: 'indenter_name', header: 'Indenter' },
        { accessorKey: 'department', header: 'Department' },
        {
            accessorKey: 'product_name',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'approved_quantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indent_number;
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.approved_quantity ?? row.original.approved_quantity}
                        onChange={(e) => handleInputChange('approved_quantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.approved_quantity}
                        {user.indentApprovalAction && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indent_number;
                return isEditing ? (
                    <Input
                        value={editValues.uom ?? row.original.uom}
                        onChange={(e) => handleInputChange('uom', e.target.value)}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.uom}
                        {user.indentApprovalAction && editingRow !== row.original.indent_number && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'vendor_type',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indent_number;
                return isEditing ? (
                    <Select
                        value={editValues.vendor_type ?? row.original.vendor_type}
                        onValueChange={(value) => handleInputChange('vendor_type', value)}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                            <SelectItem value="Reject">Reject</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-2">
                        <Pill
                            variant={
                                row.original.vendor_type === 'Reject'
                                    ? 'reject'
                                    : row.original.vendor_type === 'Regular'
                                        ? 'primary'
                                        : 'secondary'
                            }
                        >
                            {row.original.vendor_type}
                        </Pill>
                        {user.indentApprovalAction && editingRow !== row.original.indent_number && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-4 w-4"
                                onClick={() => handleEditClick(row.original)}
                            >
                                <PenSquare className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'indent_status',
            header: 'Priority',
            cell: ({ row }: { row: Row<IndentRecord> }) => {
                const status = row.original.indent_status;
                return (
                    <Pill variant={status === 'Critical' ? 'reject' : 'secondary'}>
                        {status}
                    </Pill>
                );
            },
        },
        {
            accessorKey: 'no_day',
            header: 'Days',
            cell: ({ getValue }) => (
                <div className="text-center">
                    {getValue() as number}
                </div>
            ),
        },
        {
            accessorKey: 'timestamp',
            header: 'Request Date',
            cell: ({ row }) => row.original.timestamp ? formatDate(new Date(row.original.timestamp)) : '-',
        },
        {
            accessorKey: 'actual1',
            header: 'Approval Date',
            cell: ({ row }) => row.original.actual1 ? formatDate(new Date(row.original.actual1)) : '-',
        },
        {
            accessorKey: 'planned1',
            header: 'Planned Date',
            cell: ({ row }) => row.original.planned1 ? formatDate(new Date(row.original.planned1)) : '-',
        },
        ...(user.indentApprovalAction
            ? [
                {
                    id: 'editActions',
                    cell: ({ row }: { row: Row<IndentRecord> }) => {
                        const isEditing = editingRow === row.original.indent_number;
                        return isEditing ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(row.original.indent_number)}
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                >
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                },
            ]
            : []),
    ];

    const schema = z.object({
        approval: z.enum(['Reject', 'Three Party', 'Regular'], {
            required_error: "Please select an approval status",
        }),
        approvedQuantity: z.coerce.number().optional(),
    }).superRefine((data, ctx) => {
        if (data.approval !== 'Reject') {
            if (!data.approvedQuantity || data.approvedQuantity <= 0) {
                ctx.addIssue({
                    path: ['approvedQuantity'],
                    code: z.ZodIssueCode.custom,
                    message: "Approved quantity must be greater than 0",
                });
            }
        }
    });

    const form = useForm<z.infer<typeof schema>>({
        resolver: zodResolver(schema),
        defaultValues: { approvedQuantity: undefined, approval: 'Regular' },
    });

    useEffect(() => {
        if (selectedIndent) {
            form.setValue("approvedQuantity", selectedIndent.quantity);
            form.setValue("approval", 'Regular');
        }
    }, [selectedIndent, form]);

    const handleReject = async () => {
        if (!selectedIndent) return;
        try {
            const currentDateTime = new Date().toISOString();
            await updateIndentApproval(selectedIndent.indent_number, {
                actual1: currentDateTime,
                vendor_type: 'Reject',
                approved_quantity: 0,
            });
            toast.success(`Rejected indent ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            setSelectedIndent(null);
            fetchData();
        } catch (err) {
            console.error('Error rejecting indent:', err);
            toast.error('Failed to reject indent');
        }
    };

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedIndent) return;

            const currentDateTime = new Date().toISOString();

            await updateIndentApproval(selectedIndent.indent_number, {
                actual1: currentDateTime,
                vendor_type: values.approval,
                approved_quantity: values.approvedQuantity ?? selectedIndent.quantity,
                // Set planned2 for approved indents (not rejected)
                ...(values.approval !== 'Reject' && { planned2: currentDateTime }),
            });

            toast.success(`Updated approval status of ${selectedIndent.indent_number}`);
            setOpenDialog(false);
            form.reset();
            setSelectedIndent(null);
            fetchData();
        } catch (err) {
            console.error('Error approving indent:', err);
            toast.error('Failed to approve indent');
        }
    }

    function onError(e: FieldErrors<z.infer<typeof schema>>) {
        console.log(e);
        toast.error('Please fill all required fields');
    }

    return (
        <div>
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <Tabs defaultValue="pending">
                    <Heading
                        heading="Department Indent Approval"
                        subtext="Update Indent status to Approve or Reject them"
                        tabs
                        pendingCount={pendingData.length}
                        historyCount={historyData.length}
                    >
                        <CheckSquare size={50} className="text-primary" />
                    </Heading>

                    <TabsContent value="pending">
                        <DataTable
                            data={pendingData}
                            columns={columns}
                            searchFields={['product_name', 'department', 'indenter_name', 'vendor_type', 'firm_name_match']}
                            dataLoading={dataLoading}
                            extraActions={
                                <Button
                                    variant="default"
                                    onClick={() => handleDownload(pendingData)}
                                    style={{
                                        background: "linear-gradient(90deg, #4CAF50, #2E7D32)",
                                        border: "none",
                                        borderRadius: "8px",
                                        padding: "0 16px",
                                        fontWeight: "bold",
                                        boxShadow: "0 4px 8px rgba(0,0,0,0.15)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                    }}
                                >
                                    <DownloadOutlined />
                                    {downloading ? "Downloading..." : "Download"}
                                </Button>
                            }
                        />
                    </TabsContent>
                    <TabsContent value="history">
                        <DataTable
                            data={historyData}
                            columns={historyColumns}
                            searchFields={['product_name', 'department', 'indenter_name', 'vendor_type', 'firm_name_match']}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {selectedIndent && (
                    <DialogContent>
                        <Form {...form}>
                            <form
                                onSubmit={form.handleSubmit(onSubmit, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Approve Indent</DialogTitle>
                                    <DialogDescription>
                                        Approve indent{' '}
                                        <span className="font-medium">
                                            {selectedIndent.indent_number}
                                        </span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-3">
                                    <FormField
                                        control={form.control}
                                        name="approvedQuantity"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Approved Quantity</FormLabel>
                                                <FormControl>
                                                    <Input {...field} type="number" placeholder="Enter quantity to approve" />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <DialogFooter className="flex justify-between items-center w-full">
                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={handleReject}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            Reject Indent
                                        </Button>
                                    </div>

                                    <div className="flex gap-2">
                                        <DialogClose asChild>
                                            <Button variant="outline">Close</Button>
                                        </DialogClose>

                                        <Button
                                            type="submit"
                                            disabled={form.formState.isSubmitting}
                                        >
                                            {form.formState.isSubmitting && (
                                                <Loader
                                                    size={20}
                                                    color="white"
                                                    aria-label="Loading Spinner"
                                                />
                                            )}
                                            Approve
                                        </Button>
                                    </div>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}