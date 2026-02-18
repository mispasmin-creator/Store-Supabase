import { useSheets } from '@/context/SheetsContext';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { useEffect, useState } from 'react';
import DataTable from '../element/DataTable';
import { Button } from '../ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
    DialogTrigger,
    DialogHeader,
    DialogFooter,
    DialogClose,
} from '../ui/dialog';
import { z } from 'zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel } from '../ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Tabs, TabsContent } from '../ui/tabs';
import { UserCheck, PenSquare, X, Search } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Heading from '../element/Heading';
import { Pill } from '../ui/pill';
import { formatDate } from '@/lib/utils';
import { supabase, supabaseEnabled } from '@/lib/supabase';

interface VendorUpdateData {
    indentNo: string;
    firmNameMatch?: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    vendorType: 'Three Party' | 'Regular';
    planned2: string;
    actual2: string;
    specifications: string;
}

interface HistoryData {
    indentNo: string;
    indenter: string;
    department: string;
    product: string;
    quantity: number;
    uom: string;
    rate: number;
    vendorType: 'Three Party' | 'Regular';
    date: string;
    planned2: string;
    actual2: string;
    specifications: string;
    firmNameMatch?: string;
}

export default () => {
    const { masterSheet: options } = useSheets();
    const { user } = useAuth();

    const [selectedIndent, setSelectedIndent] = useState<VendorUpdateData | null>(null);
    const [selectedHistory, setSelectedHistory] = useState<HistoryData | null>(null);
    const [historyData, setHistoryData] = useState<HistoryData[]>([]);
    const [tableData, setTableData] = useState<VendorUpdateData[]>([]);
    const [filteredTableData, setFilteredTableData] = useState<VendorUpdateData[]>([]);
    const [filteredHistoryData, setFilteredHistoryData] = useState<HistoryData[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingRow, setEditingRow] = useState<string | null>(null);
    const [editValues, setEditValues] = useState<Partial<HistoryData>>({});
    const [dataLoading, setDataLoading] = useState(false);

    // Filter states
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [selectedUOM, setSelectedUOM] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>('');
    const [selectedHistoryUOM, setSelectedHistoryUOM] = useState<string>('');
    const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
    const [searchTermVendor, setSearchTermVendor] = useState('');

    // Fetch pending vendor updates from Supabase
    const fetchPendingVendorUpdates = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned2', 'is', null)
                .is('actual2', null);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            const mappedData = rows.map((r) => ({
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name_match || '',
                indenter: r.indenter_name || '',
                department: r.department || '',
                product: r.product_name || '',
                quantity: r.approved_quantity || r.quantity || 0,
                uom: r.uom || '',
                vendorType: (r.vendor_type || 'Regular') as VendorUpdateData['vendorType'],
                planned2: r.planned2 || '',
                actual2: r.actual2 || '',
                specifications: r.specifications || '',
            }));

            setTableData(mappedData);
            setFilteredTableData(mappedData);
        } catch (err) {
            console.error('Error fetching pending vendor updates:', err);
            toast.error('Failed to fetch pending vendor updates');
        } finally {
            setDataLoading(false);
        }
    };

    // Fetch completed vendor updates from Supabase
    const fetchCompletedVendorUpdates = async () => {
        if (!supabaseEnabled) return;

        try {
            setDataLoading(true);
            let query = supabase
                .from('indent')
                .select('*')
                .not('planned2', 'is', null)
                .not('actual2', 'is', null);

            if (user.firmNameMatch.toLowerCase() !== 'all') {
                query = query.eq('firm_name', user.firmNameMatch);
            }

            const { data, error } = await query.order('indent_number', { ascending: false });

            if (error) throw error;

            const rows = (data ?? []) as any[];
            const mappedData = rows.map((r) => ({
                date: formatDate(new Date(r.actual2)),
                indentNo: r.indent_number || '',
                firmNameMatch: r.firm_name_match || '',
                indenter: r.indenter_name || '',
                department: r.department || '',
                product: r.product_name || '',
                quantity: r.quantity || 0,
                uom: r.uom || '',
                rate: parseFloat(r.approved_rate) || 0,
                vendorType: (r.vendor_type || 'Regular') as HistoryData['vendorType'],
                planned2: r.planned2 || '',
                actual2: r.actual2 || '',
                specifications: r.specifications || '',
            }));

            setHistoryData(mappedData);
            setFilteredHistoryData(mappedData);
        } catch (err) {
            console.error('Error fetching completed vendor updates:', err);
            toast.error('Failed to fetch completed vendor updates');
        } finally {
            setDataLoading(false);
        }
    };

    // Fetch data on mount and when firm name changes
    useEffect(() => {
        fetchPendingVendorUpdates();
        fetchCompletedVendorUpdates();
    }, [user.firmNameMatch]);

    // Filter pending data by date, UOM, and search query
    useEffect(() => {
        let filtered = [...tableData];

        if (selectedDate) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.planned2).toISOString().split('T')[0];
                return itemDate === selectedDate;
            });
        }

        if (selectedUOM && selectedUOM !== '__all__') {
            filtered = filtered.filter(item => item.uom === selectedUOM);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.indentNo.toLowerCase().includes(query) ||
                item.firmNameMatch?.toLowerCase().includes(query) ||
                item.indenter.toLowerCase().includes(query) ||
                item.department.toLowerCase().includes(query) ||
                item.product.toLowerCase().includes(query) ||
                item.specifications.toLowerCase().includes(query)
            );
        }

        setFilteredTableData(filtered);
    }, [selectedDate, selectedUOM, searchQuery, tableData]);

    // Filter history data by date, UOM, and search query
    useEffect(() => {
        let filtered = [...historyData];

        if (selectedHistoryDate) {
            filtered = filtered.filter(item => {
                const itemDate = new Date(item.actual2).toISOString().split('T')[0];
                return itemDate === selectedHistoryDate;
            });
        }

        if (selectedHistoryUOM && selectedHistoryUOM !== '__all__') {
            filtered = filtered.filter(item => item.uom === selectedHistoryUOM);
        }

        if (historySearchQuery.trim()) {
            const query = historySearchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                item.indentNo.toLowerCase().includes(query) ||
                item.firmNameMatch?.toLowerCase().includes(query) ||
                item.indenter.toLowerCase().includes(query) ||
                item.department.toLowerCase().includes(query) ||
                item.product.toLowerCase().includes(query) ||
                item.specifications.toLowerCase().includes(query)
            );
        }

        setFilteredHistoryData(filtered);
    }, [selectedHistoryDate, selectedHistoryUOM, historySearchQuery, historyData]);

    // Get unique UOMs for filter dropdown
    const uniqueUOMs = Array.from(new Set(tableData.map(item => item.uom))).sort();
    const uniqueHistoryUOMs = Array.from(new Set(historyData.map(item => item.uom))).sort();

    const handleEditClick = (row: HistoryData) => {
        setEditingRow(row.indentNo);
        setEditValues({
            quantity: row.quantity,
            uom: row.uom,
            vendorType: row.vendorType,
        });
    };

    const handleCancelEdit = () => {
        setEditingRow(null);
        setEditValues({});
    };

    const handleSaveEdit = async (indentNo: string) => {
        try {
            const updates = {
                quantity: editValues.quantity,
                uom: editValues.uom,
                vendor_type: editValues.vendorType,
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', indentNo);

            if (error) throw error;

            toast.success(`Updated indent ${indentNo}`);
            fetchCompletedVendorUpdates();
            setEditingRow(null);
            setEditValues({});
        } catch (err) {
            console.error('Error updating indent:', err);
            toast.error('Failed to update indent');
        }
    };

    const handleInputChange = (field: keyof HistoryData, value: any) => {
        setEditValues((prev) => ({ ...prev, [field]: value }));
    };

    // Clear all filters function
    const clearAllFilters = () => {
        setSelectedDate('');
        setSelectedUOM('');
        setSearchQuery('');
    };

    const clearAllHistoryFilters = () => {
        setSelectedHistoryDate('');
        setSelectedHistoryUOM('');
        setHistorySearchQuery('');
    };

    // Upload file to Supabase Storage
    const uploadFileToSupabase = async (file: File, indentNumber: string): Promise<string> => {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${indentNumber}_comparison_${Date.now()}.${fileExt}`;
            const filePath = `comparison-sheets/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(filePath);

            return publicUrl;
        } catch (error) {
            console.error('File upload error:', error);
            throw error;
        }
    };

    // Creating table columns
    const columns: ColumnDef<VendorUpdateData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<VendorUpdateData> }) => {
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
                                        Update
                                    </Button>
                                </DialogTrigger>
                            </div>
                        );
                    },
                },
            ]
            : []),
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[200px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
        },
        {
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const status = row.original.vendorType;
                const variant = status === 'Regular' ? 'primary' : 'secondary';
                return <Pill variant={variant}>{status}</Pill>;
            },
        },
        {
            accessorKey: 'planned2',
            header: 'Planned Date',
            cell: ({ row }) => formatDateTime(row.original.planned2)
        },
    ];

    const historyColumns: ColumnDef<HistoryData>[] = [
        ...(user.updateVendorAction
            ? [
                {
                    header: 'Action',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const indent = row.original;

                        return (
                            <div>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        disabled={indent.vendorType === 'Three Party'}
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
            ]
            : []),
        {
            accessorKey: 'date',
            header: 'Date',
        },
        {
            accessorKey: 'indentNo',
            header: 'Indent No.',
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm Name',
        },
        {
            accessorKey: 'indenter',
            header: 'Indenter',
        },
        {
            accessorKey: 'department',
            header: 'Department',
        },
        {
            accessorKey: 'specifications',
            header: 'Specifications',
            cell: ({ getValue }) => (
                <div className="max-w-[200px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ getValue }) => (
                <div className="max-w-[150px] break-words whitespace-normal">
                    {getValue() as string}
                </div>
            ),
        },
        {
            accessorKey: 'quantity',
            header: 'Quantity',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        type="number"
                        value={editValues.quantity ?? row.original.quantity}
                        onChange={(e) => handleInputChange('quantity', Number(e.target.value))}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.quantity}
                        {user.updateVendorAction && (
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
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                const rate = row.original.rate;
                const vendorType = row.original.vendorType;

                if (!rate && vendorType === 'Three Party') {
                    return <span className="text-muted-foreground">Not Decided</span>;
                }
                return <>&#8377;{rate}</>;
            },
        },
        {
            accessorKey: 'uom',
            header: 'UOM',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Input
                        value={editValues.uom ?? row.original.uom}
                        onChange={(e) => handleInputChange('uom', e.target.value)}
                        className="w-20"
                    />
                ) : (
                    <div className="flex items-center gap-2">
                        {row.original.uom}
                        {user.updateVendorAction && editingRow !== row.original.indentNo && (
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
            accessorKey: 'vendorType',
            header: 'Vendor Type',
            cell: ({ row }) => {
                const isEditing = editingRow === row.original.indentNo;
                return isEditing ? (
                    <Select
                        value={editValues.vendorType ?? row.original.vendorType}
                        onValueChange={(value) => handleInputChange('vendorType', value)}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Regular">Regular</SelectItem>
                            <SelectItem value="Three Party">Three Party</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <div className="flex items-center gap-2">
                        <Pill
                            variant={
                                row.original.vendorType === 'Regular' ? 'primary' : 'secondary'
                            }
                        >
                            {row.original.vendorType}
                        </Pill>
                        {user.updateVendorAction && editingRow !== row.original.indentNo && (
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
            accessorKey: 'planned2',
            header: 'Planned Date',
            cell: ({ row }) =>
                row.original.planned2
                    ? formatDateTime(row.original.planned2)
                    : '-',
        },
        {
            accessorKey: 'actual2',
            header: 'Actual Date',
            cell: ({ row }) =>
                row.original.actual2
                    ? formatDateTime(row.original.actual2)
                    : '-',
        },
        ...(user.updateVendorAction
            ? [
                {
                    id: 'editActions',
                    cell: ({ row }: { row: Row<HistoryData> }) => {
                        const isEditing = editingRow === row.original.indentNo;
                        return isEditing ? (
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(row.original.indentNo)}
                                >
                                    Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                    Cancel
                                </Button>
                            </div>
                        ) : null;
                    },
                },
            ]
            : []),
    ];

    // Creating Regular Vendor form
    const regularSchema = z.object({
        vendorName: z.string().min(1, "Vendor name is required"),
        rateType: z.enum(['basic', 'withTax']),
        rate: z.coerce.number().gt(0, "Rate must be greater than 0"),
        withTax: z.enum(['yes', 'no']).optional(),
        gstPercent: z.coerce.number().optional(),
        paymentTerm: z.string().min(1, "Payment term is required"),
    });

    type RegularFormValues = z.infer<typeof regularSchema>;

    const regularForm = useForm<RegularFormValues>({
        resolver: zodResolver(regularSchema),
        defaultValues: {
            vendorName: '',
            rateType: 'basic',
            rate: 0,
            withTax: 'no',
            gstPercent: 0,
            paymentTerm: '',
        },
    });
    const watchRateType = regularForm.watch('rateType');
    const watchWithTax = regularForm.watch('withTax');

    async function onSubmitRegular(values: z.infer<typeof regularSchema>) {
        try {
            const rateTypeText = values.rateType === 'basic' ? 'Basic Rate' : 'With Tax';
            let withTaxOrNot = '';
            let taxValue = 0;
            let finalRate = values.rate;

            if (values.rateType === 'basic') {
                if (values.withTax === 'yes') {
                    withTaxOrNot = 'Yes';
                    taxValue = 0;
                } else if (values.withTax === 'no') {
                    withTaxOrNot = 'No';
                    taxValue = values.gstPercent || 0;
                    finalRate = values.rate * (1 + taxValue / 100);
                }
            } else {
                withTaxOrNot = 'Yes';
                taxValue = 0;
            }

            const updates = {
                actual2: new Date().toISOString(),
                planned3: new Date().toISOString(), // Set planned3 for three party approval workflow
                vendor_name1: values.vendorName,
                select_rate_type1: rateTypeText,
                rate1: values.rate.toString(),
                with_tax_or_not1: withTaxOrNot,
                tax_value1: taxValue.toString(),
                payment_term1: values.paymentTerm,
                approved_vendor_name: values.vendorName,
                approved_rate: finalRate.toString(),
                approved_payment_term: values.paymentTerm,
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;

            toast.success(`Updated vendor of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            regularForm.reset();
            fetchPendingVendorUpdates();
            fetchCompletedVendorUpdates();
        } catch (error) {
            console.error('Error updating vendor:', error);
            toast.error('Failed to update vendor');
        }
    }

    // Creating Three Party Vendor form
    const threePartySchema = z.object({
        comparisonSheet: z.instanceof(File).optional(),
        productCode: z.string().optional(),
        vendors: z
            .array(
                z.object({
                    vendorName: z.string().nonempty(),
                    rateType: z.enum(['basic', 'withTax']),
                    rate: z.coerce.number().gt(0),
                    withTax: z.enum(['yes', 'no']).optional(),
                    gstPercent: z.coerce.number().optional(),
                    paymentTerm: z.string().nonempty(),
                    whatsappNumber: z.string().nonempty(),
                    emailId: z.string().email().nonempty(),
                })
            )
            .max(3)
            .min(3),
    });

    const threePartyForm = useForm<z.infer<typeof threePartySchema>>({
        resolver: zodResolver(threePartySchema),
        defaultValues: {
            productCode: '',
            vendors: [
                {
                    vendorName: '',
                    rateType: undefined,
                    rate: 0,
                    withTax: 'no',
                    gstPercent: 0,
                    paymentTerm: '',
                    whatsappNumber: '',
                    emailId: '',
                },
                {
                    vendorName: '',
                    rateType: undefined,
                    rate: 0,
                    withTax: 'no',
                    gstPercent: 0,
                    paymentTerm: '',
                    whatsappNumber: '',
                    emailId: '',
                },
                {
                    vendorName: '',
                    rateType: undefined,
                    rate: 0,
                    withTax: 'no',
                    gstPercent: 0,
                    paymentTerm: '',
                    whatsappNumber: '',
                    emailId: '',
                },
            ],
        },
    });

    const { fields } = useFieldArray({
        control: threePartyForm.control,
        name: 'vendors',
    });

    async function onSubmitThreeParty(values: z.infer<typeof threePartySchema>) {
        try {
            let url: string = '';

            if (values.comparisonSheet) {
                url = await uploadFileToSupabase(values.comparisonSheet, selectedIndent?.indentNo || '');
            }

            const processVendorData = (vendor: typeof values.vendors[0]) => {
                const rateTypeText = vendor.rateType === 'basic' ? 'Basic Rate' : 'With Tax';
                let withTaxOrNot = '';
                let taxValue = 0;

                if (vendor.rateType === 'basic') {
                    if (vendor.withTax === 'yes') {
                        withTaxOrNot = 'Yes';
                        taxValue = 0;
                    } else if (vendor.withTax === 'no') {
                        withTaxOrNot = 'No';
                        taxValue = vendor.gstPercent || 0;
                    }
                } else {
                    withTaxOrNot = 'Yes';
                    taxValue = 0;
                }

                return {
                    rateType: rateTypeText,
                    rate: vendor.rate,
                    withTaxOrNot,
                    taxValue,
                };
            };

            const vendor1Data = processVendorData(values.vendors[0]);
            const vendor2Data = processVendorData(values.vendors[1]);
            const vendor3Data = processVendorData(values.vendors[2]);

            const updates = {
                actual2: new Date().toISOString(),
                planned3: new Date().toISOString(), // Set planned3 for three party approval workflow

                // Vendor 1
                vendor_name1: values.vendors[0].vendorName,
                select_rate_type1: vendor1Data.rateType,
                rate1: vendor1Data.rate.toString(),
                with_tax_or_not1: vendor1Data.withTaxOrNot,
                tax_value1: vendor1Data.taxValue.toString(),
                payment_term1: values.vendors[0].paymentTerm,
                whatsapp_number1: values.vendors[0].whatsappNumber,
                email_id1: values.vendors[0].emailId,

                // Vendor 2
                vendor_name2: values.vendors[1].vendorName,
                select_rate_type2: vendor2Data.rateType,
                rate2: vendor2Data.rate.toString(),
                with_tax_or_not2: vendor2Data.withTaxOrNot,
                tax_value2: vendor2Data.taxValue.toString(),
                payment_term2: values.vendors[1].paymentTerm,
                whatsapp_number2: values.vendors[1].whatsappNumber,
                email_id2: values.vendors[1].emailId,

                // Vendor 3
                vendor_name3: values.vendors[2].vendorName,
                select_rate_type3: vendor3Data.rateType,
                rate3: vendor3Data.rate.toString(),
                with_tax_or_not3: vendor3Data.withTaxOrNot,
                tax_value3: vendor3Data.taxValue.toString(),
                payment_term3: values.vendors[2].paymentTerm,
                whatsapp_number3: values.vendors[2].whatsappNumber,
                email_id3: values.vendors[2].emailId,

                comparison_sheet: url,
                product_code: values.productCode || '',
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedIndent?.indentNo);

            if (error) throw error;

            toast.success(`Updated vendors of ${selectedIndent?.indentNo}`);
            setOpenDialog(false);
            threePartyForm.reset();
            fetchPendingVendorUpdates();
            fetchCompletedVendorUpdates();
        } catch (error) {
            console.error('Error updating vendors:', error);
            toast.error('Failed to update vendors');
        }
    }

    const formatDateTime = (isoString?: string) => {
        if (!isoString) return '-';
        const date = new Date(isoString);
        const day = date.getDate().toString().padStart(2, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        const seconds = date.getSeconds().toString().padStart(2, "0");
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    // History Update form
    const historyUpdateSchema = z.object({
        rate: z.coerce.number(),
    });

    const historyUpdateForm = useForm({
        resolver: zodResolver(historyUpdateSchema),
        defaultValues: {
            rate: 0,
        },
    });

    useEffect(() => {
        if (selectedHistory) {
            historyUpdateForm.reset({ rate: selectedHistory.rate });
        }
    }, [selectedHistory]);

    async function onSubmitHistoryUpdate(values: z.infer<typeof historyUpdateSchema>) {
        try {
            const updates = {
                rate1: values.rate.toString(),
                approved_rate: values.rate.toString(),
            };

            const { error } = await supabase
                .from('indent')
                .update(updates)
                .eq('indent_number', selectedHistory?.indentNo);

            if (error) throw error;

            toast.success(`Updated rate of ${selectedHistory?.indentNo}`);
            setOpenDialog(false);
            historyUpdateForm.reset({ rate: undefined });
            fetchCompletedVendorUpdates();
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
                        heading="Vendor Rate Update"
                        subtext="Update vendors for Regular and Three Party indents"
                        tabs
                    >
                        <UserCheck size={50} className="text-primary" />
                    </Heading>
                    <TabsContent value="pending">
                        {/* Compact Centered Filters for Pending Tab */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-center p-4 bg-muted/30 rounded-lg border">
                            {/* Date Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="w-32 sm:w-36"
                                        placeholder="Select Date"
                                    />
                                    {selectedDate && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedDate('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* UOM Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Select value={selectedUOM} onValueChange={setSelectedUOM}>
                                        <SelectTrigger className="w-32 sm:w-36">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All UOMs</SelectItem>
                                            {uniqueUOMs.map((uom) => (
                                                <SelectItem key={uom} value={uom}>
                                                    {uom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedUOM && selectedUOM !== '__all__' && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedUOM('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Search Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-md">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="flex-1"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSearchQuery('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Clear All Button */}
                            {(selectedDate || selectedUOM || searchQuery) && (
                                <Button
                                    variant="outline"
                                    onClick={clearAllFilters}
                                    className="w-full sm:w-auto"
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>

                        <DataTable
                            data={filteredTableData}
                            columns={columns}
                            searchFields={[]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>

                    <TabsContent value="history">
                        {/* Compact Centered Filters for History Tab */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-4 items-center justify-center p-4 bg-muted/30 rounded-lg border">
                            {/* Date Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="date"
                                        value={selectedHistoryDate}
                                        onChange={(e) => setSelectedHistoryDate(e.target.value)}
                                        className="w-32 sm:w-36"
                                        placeholder="Select Date"
                                    />
                                    {selectedHistoryDate && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedHistoryDate('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* UOM Filter */}
                            <div className="w-full sm:w-auto">
                                <div className="flex gap-2 items-center">
                                    <Select value={selectedHistoryUOM} onValueChange={setSelectedHistoryUOM}>
                                        <SelectTrigger className="w-32 sm:w-36">
                                            <SelectValue placeholder="Select UOM" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="__all__">All UOMs</SelectItem>
                                            {uniqueHistoryUOMs.map((uom) => (
                                                <SelectItem key={uom} value={uom}>
                                                    {uom}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {selectedHistoryUOM && selectedHistoryUOM !== '__all__' && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setSelectedHistoryUOM('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Search Filter */}
                            <div className="w-full sm:w-auto flex-1 max-w-md">
                                <div className="flex gap-2 items-center">
                                    <Input
                                        type="text"
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        placeholder="Search..."
                                        className="flex-1"
                                    />
                                    {historySearchQuery && (
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            onClick={() => setHistorySearchQuery('')}
                                            className="h-9 w-9"
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Clear All Button */}
                            {(selectedHistoryDate || selectedHistoryUOM || historySearchQuery) && (
                                <Button
                                    variant="outline"
                                    onClick={clearAllHistoryFilters}
                                    className="w-full sm:w-auto"
                                >
                                    Clear All
                                </Button>
                            )}
                        </div>

                        <DataTable
                            data={filteredHistoryData}
                            columns={historyColumns}
                            searchFields={[]}
                            dataLoading={dataLoading}
                        />
                    </TabsContent>
                </Tabs>

                {/* Regular Vendor Dialog */}
                {selectedIndent && selectedIndent.vendorType === 'Regular' && (
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <Form {...regularForm}>
                            <form
                                onSubmit={regularForm.handleSubmit(onSubmitRegular, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Update Regular Vendor</DialogTitle>
                                    <DialogDescription>
                                        Update vendor for indent{' '}
                                        <span className="font-medium">{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4">
                                    <FormField
                                        control={regularForm.control}
                                        name="vendorName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Vendor Name</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select vendor" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <div className="flex items-center border-b px-3 pb-3">
                                                            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                            <input
                                                                placeholder="Search vendors..."
                                                                value={searchTermVendor}
                                                                onChange={(e) => setSearchTermVendor(e.target.value)}
                                                                onKeyDown={(e) => e.stopPropagation()}
                                                                className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                            />
                                                        </div>
                                                        {options?.vendorNames
                                                            ?.filter((v) =>
                                                                v.toLowerCase().includes(searchTermVendor.toLowerCase())
                                                            )
                                                            .map((v, i) => (
                                                                <SelectItem key={i} value={v}>
                                                                    {v}
                                                                </SelectItem>
                                                            ))}
                                                        {options?.vendorNames?.length === 0 && (
                                                            <SelectItem value="no-vendors" disabled>
                                                                No vendors available
                                                            </SelectItem>
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={regularForm.control}
                                        name="rateType"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Rate Type</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select rate type" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="basic">Basic Rate</SelectItem>
                                                        <SelectItem value="withTax">With Tax</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={regularForm.control}
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

                                    {watchRateType === 'basic' && (
                                        <>
                                            <FormField
                                                control={regularForm.control}
                                                name="withTax"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>With Tax?</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="yes">Yes</SelectItem>
                                                                <SelectItem value="no">No</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            {watchWithTax === 'no' && (
                                                <FormField
                                                    control={regularForm.control}
                                                    name="gstPercent"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>GST %</FormLabel>
                                                            <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select GST %" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="0">0%</SelectItem>
                                                                    <SelectItem value="5">5%</SelectItem>
                                                                    <SelectItem value="12">12%</SelectItem>
                                                                    <SelectItem value="18">18%</SelectItem>
                                                                    <SelectItem value="28">28%</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}
                                        </>
                                    )}

                                    <FormField
                                        control={regularForm.control}
                                        name="paymentTerm"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Payment Term</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={regularForm.formState.isSubmitting}>
                                        {regularForm.formState.isSubmitting && (
                                            <Loader size={20} color="white" aria-label="Loading Spinner" />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {/* Three Party Vendor Dialog */}
                {selectedIndent && selectedIndent.vendorType === 'Three Party' && (
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <Form {...threePartyForm}>
                            <form
                                onSubmit={threePartyForm.handleSubmit(onSubmitThreeParty, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Update Three Party Vendors</DialogTitle>
                                    <DialogDescription>
                                        Update vendors for indent{' '}
                                        <span className="font-medium">{selectedIndent.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="grid gap-4">
                                    <FormField
                                        control={threePartyForm.control}
                                        name="productCode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Product Code (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={threePartyForm.control}
                                        name="comparisonSheet"
                                        render={({ field: { value, onChange, ...field } }) => (
                                            <FormItem>
                                                <FormLabel>Comparison Sheet (Optional)</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="file"
                                                        onChange={(e) => onChange(e.target.files?.[0])}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {fields.map((field, index) => (
                                        <div key={field.id} className="border p-4 rounded-lg">
                                            <h3 className="font-semibold mb-3">Vendor {index + 1}</h3>
                                            <div className="grid gap-3">
                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.vendorName`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Vendor Name</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select vendor" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <div className="flex items-center border-b px-3 pb-3">
                                                                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                                                        <input
                                                                            placeholder="Search vendors..."
                                                                            value={searchTermVendor}
                                                                            onChange={(e) => setSearchTermVendor(e.target.value)}
                                                                            onKeyDown={(e) => e.stopPropagation()}
                                                                            className="flex h-10 w-full rounded-md border-0 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
                                                                        />
                                                                    </div>
                                                                    {options?.vendorNames
                                                                        ?.filter((v) =>
                                                                            v.toLowerCase().includes(searchTermVendor.toLowerCase())
                                                                        )
                                                                        .map((v, i) => (
                                                                            <SelectItem key={i} value={v}>
                                                                                {v}
                                                                            </SelectItem>
                                                                        ))}
                                                                    {options?.vendorNames?.length === 0 && (
                                                                        <SelectItem value="no-vendors" disabled>
                                                                            No vendors available
                                                                        </SelectItem>
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.rateType`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Rate Type</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select rate type" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="basic">Basic Rate</SelectItem>
                                                                    <SelectItem value="withTax">With Tax</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.rate`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Rate</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                {threePartyForm.watch(`vendors.${index}.rateType`) === 'basic' && (
                                                    <>
                                                        <FormField
                                                            control={threePartyForm.control}
                                                            name={`vendors.${index}.withTax`}
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>With Tax?</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                                        <FormControl>
                                                                            <SelectTrigger>
                                                                                <SelectValue placeholder="Select" />
                                                                            </SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            <SelectItem value="yes">Yes</SelectItem>
                                                                            <SelectItem value="no">No</SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {threePartyForm.watch(`vendors.${index}.withTax`) === 'no' && (
                                                            <FormField
                                                                control={threePartyForm.control}
                                                                name={`vendors.${index}.gstPercent`}
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormLabel>GST %</FormLabel>
                                                                        <Select onValueChange={(val) => field.onChange(Number(val))} value={field.value?.toString()}>
                                                                            <FormControl>
                                                                                <SelectTrigger>
                                                                                    <SelectValue placeholder="Select GST %" />
                                                                                </SelectTrigger>
                                                                            </FormControl>
                                                                            <SelectContent>
                                                                                <SelectItem value="0">0%</SelectItem>
                                                                                <SelectItem value="5">5%</SelectItem>
                                                                                <SelectItem value="12">12%</SelectItem>
                                                                                <SelectItem value="18">18%</SelectItem>
                                                                                <SelectItem value="28">28%</SelectItem>
                                                                            </SelectContent>
                                                                        </Select>
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        )}
                                                    </>
                                                )}

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.paymentTerm`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Payment Term</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.whatsappNumber`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>WhatsApp Number</FormLabel>
                                                            <FormControl>
                                                                <Input {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={threePartyForm.control}
                                                    name={`vendors.${index}.emailId`}
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Email ID</FormLabel>
                                                            <FormControl>
                                                                <Input type="email" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={threePartyForm.formState.isSubmitting}>
                                        {threePartyForm.formState.isSubmitting && (
                                            <Loader size={20} color="white" aria-label="Loading Spinner" />
                                        )}
                                        Update
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                )}

                {/* History Update Dialog */}
                {selectedHistory && (
                    <DialogContent>
                        <Form {...historyUpdateForm}>
                            <form
                                onSubmit={historyUpdateForm.handleSubmit(onSubmitHistoryUpdate, onError)}
                                className="grid gap-5"
                            >
                                <DialogHeader className="grid gap-2">
                                    <DialogTitle>Update Rate</DialogTitle>
                                    <DialogDescription>
                                        Update rate for indent{' '}
                                        <span className="font-medium">{selectedHistory.indentNo}</span>
                                    </DialogDescription>
                                </DialogHeader>

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

                                <DialogFooter>
                                    <DialogClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={historyUpdateForm.formState.isSubmitting}>
                                        {historyUpdateForm.formState.isSubmitting && (
                                            <Loader size={20} color="white" aria-label="Loading Spinner" />
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
