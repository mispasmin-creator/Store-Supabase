import { Package2, FileText, Building, DollarSign, Calendar as CalendarIcon, Upload, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { ColumnDef, Row } from '@tanstack/react-table';
import DataTable from '../element/DataTable';
import { useAuth } from '@/context/AuthContext';
import { useSheets } from '@/context/SheetsContext';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AdminFileUpdater from '../element/AdminFileUpdater';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { PuffLoader as Loader } from 'react-spinners';
import { toast } from 'sonner';
import { Input } from '../ui/input';
import { createPaymentEntry, uploadProductPhoto, updateStoreInReceiving } from '@/services/storeInService';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Separator } from '../ui/separator';
import { useMemo } from 'react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { format } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';


// ✅ UPDATED INTERFACE
interface PIPendingData {
    rowIndex: number;
    timestamp: string;
    partyName: string;
    poNumber: string;
    internalCode: string;
    product: string;
    description: string;
    quantity: number;
    unit: string;
    rate: number;
    gstPercent: number;
    discountPercent: number;
    amount: number;
    totalPoAmount: number;
    deliveryDate: string;
    paymentTerms: string;
    numberOfDays: string | number;
    firmNameMatch: string;
    totalPaidAmount: number;
    outstandingAmount: number;
    status: string;
    pdf?: string;
    file?: string;
    isPaymentRecord?: boolean;
    paymentForm?: string;
    billNo?: string;
    billAmount?: number;
    rowIds: number[];
    liftNumber?: string;
    advanceAmount?: number;
    advancePercent?: number;
}

interface POMasterRecord {
    rowIndex?: number;
    timestamp?: string;
    partyName?: string;
    poNumber?: string;
    internalCode?: string;
    product?: string;
    description?: string;
    quantity?: string | number;
    unit?: string;
    rate?: string | number;
    gstPercent?: string | number;
    discountPercent?: string | number;
    amount?: string | number;
    totalPoAmount?: string | number;
    deliveryDate?: string;
    paymentTerms?: string;
    numberOfDays?: string | number;
    firmNameMatch?: string;
    totalPaidAmount?: string | number;
    outstandingAmount?: string | number;
    status?: string;
    pdf?: string;
}

// Paisa-level rounding differences (e.g. from GST math) leave residues under ₹1
// that aren't real dues — treat those as fully paid.
const OUTSTANDING_TOLERANCE = 1;
const normalizeOutstanding = (value: number) =>
    Math.abs(value) < OUTSTANDING_TOLERANCE ? 0 : Math.round(value * 100) / 100;

export default function PIApprovals() {
    const {
        poMasterSheet,
        paymentsSheet,
        storeInSheet,
        paymentHistorySheet,
        updateAll,
        allLoading: poMasterLoading
    } = useSheets();
    const { user } = useAuth();
    const [pendingData, setPendingData] = useState<PIPendingData[]>([]);
    const [completedData, setCompletedData] = useState<PIPendingData[]>([]);
    const [activeTab, setActiveTab] = useState('pending');
    const [selectedItem, setSelectedItem] = useState<PIPendingData | null>(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [filterTerm, setFilterTerm] = useState('All');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);

    // ✅ Memoized filtered data with Date range filtering
    const filteredData = useMemo(() => {
        let data = activeTab === 'pending' ? pendingData : completedData;

        // 1. Filter by Payment Terms
        if (filterTerm === 'Advance Terms') {
            data = data.filter(item => {
                const pt = (item.paymentTerms || '').toLowerCase();
                return pt.includes('advance') || pt.includes('pi');
            });
        } else if (filterTerm !== 'All') {
            data = data.filter(item => item.paymentTerms === filterTerm);
        }

        // 2. Filter by Date Range (using item.timestamp)
        if (startDate || endDate) {
            data = data.filter(item => {
                if (!item.timestamp) return false;
                const itemDate = new Date(item.timestamp);
                if (isNaN(itemDate.getTime())) return false;

                if (startDate) {
                    const start = new Date(startDate);
                    start.setHours(0, 0, 0, 0);
                    if (itemDate < start) return false;
                }

                if (endDate) {
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    if (itemDate > end) return false;
                }

                return true;
            });
        }

        return data;
    }, [pendingData, completedData, activeTab, filterTerm, startDate, endDate]);

    // ✅ Handle CSV Export
    const handleDownload = (data: PIPendingData[]) => {
        if (!data || data.length === 0) {
            toast.error('No data to export');
            return;
        }

        const headers = [
            'Bill No.',
            'PO Number',
            'Party Name',
            'Indent No.',
            'Product',
            'Total PO Amount',
            'Bill Amount',
            'Total Paid',
            'Outstanding',
            'Payment Terms',
            'Delivery Date',
            'Firm',
            'Status',
            'Date Entered'
        ];

        const csvRows = [
            headers.join(','),
            ...data.map((row) => [
                `"${String(row.billNo ?? '').replace(/"/g, '""')}"`,
                `"${String(row.poNumber ?? '').replace(/"/g, '""')}"`,
                `"${String(row.partyName ?? '').replace(/"/g, '""')}"`,
                `"${String(row.internalCode ?? '').replace(/"/g, '""')}"`,
                `"${String(row.product ?? '').replace(/"/g, '""')}"`,
                row.totalPoAmount || 0,
                row.billAmount || 0,
                row.totalPaidAmount || 0,
                row.outstandingAmount || 0,
                `"${String(row.paymentTerms ?? '').replace(/"/g, '""')}"`,
                `"${String(row.deliveryDate ?? '').replace(/"/g, '""')}"`,
                `"${String(row.firmNameMatch ?? '').replace(/"/g, '""')}"`,
                `"${String(row.status ?? '').replace(/"/g, '""')}"`,
                `"${String(row.timestamp ?? '').replace(/"/g, '""')}"`
            ].join(','))
        ];

        const csvContent = csvRows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `process-for-payment-debit-note-${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };


    // ✅ Get unique payment terms for the filter
    const uniquePaymentTerms = useMemo(() => {
        const terms = new Set<string>();
        [...pendingData, ...completedData].forEach(item => {
            if (item.paymentTerms) {
                terms.add(item.paymentTerms);
            }
        });
        return Array.from(terms).sort();
    }, [pendingData, completedData]);

    const stats = useMemo(() => {
        const totalOutstanding = filteredData.reduce((sum, item) => sum + item.outstandingAmount, 0);
        return {
            total: filteredData.length,
            totalAmount: totalOutstanding,
            pendingCount: filteredData.length
        };
    }, [filteredData]);



    useEffect(() => {
        try {
            // ✅ Use data from useSheets context
            const safePoMasterSheet: any[] = Array.isArray(poMasterSheet) ? poMasterSheet : [];
            const safePaymentsSheet: any[] = Array.isArray(paymentsSheet) ? paymentsSheet : [];
            const safeStoreInSheet: any[] = Array.isArray(storeInSheet) ? storeInSheet : [];

            // 1. Identify received PO numbers from store_in
            const receivedPoNumbersSet = new Set(
                safeStoreInSheet
                    .filter(s => s.actual6 && s.actual6.toString().trim() !== '')
                    .map(s => s.poNumber || s.po_number || '')
                    .filter(Boolean)
            );

            // 2. Identify PO-based pending items
            const poBasedPendingItems = safePoMasterSheet
                .filter((record: any) => {
                    // Firm filtering
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return false;

                    // Status filtering
                    const status = (record.status || record.indent_status || '').toString().trim().toLowerCase();
                    if (status === 'rejected' || status === 'cancelled') return false;

                    // Outstanding amount calculation
                    const totalPo = Math.round(Number(record.totalPoAmount || 0) * 100) / 100;

                    // Sum payments for this PO
                    const rawTotalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .filter((p: any) => {
                            const status = String(p.status1 || p.status || '').toLowerCase();
                            return status !== 'rejected' && status !== 'cancelled';
                        })
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);

                    const totalPaid = Math.round(rawTotalPaid * 100) / 100;
                    const outstanding = Math.round((totalPo - totalPaid) * 100) / 100;

                    return true; // Keep all so they can be split into Pending/Completed tabs
                })
                .map((record: any) => {
                    const totalPo = Math.round(Number(record.totalPoAmount || 0) * 100) / 100;
                    const rawTotalPaid = safePaymentsSheet
                        .filter((p: any) => (p.poNumber || p.po_number || p.po_no) === (record.poNumber || record.po_number || record.po_no))
                        .filter((p: any) => {
                            const status = String(p.status1 || p.status || '').toLowerCase();
                            return status !== 'rejected' && status !== 'cancelled';
                        })
                        .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);
                    
                    const totalPaid = Math.round(rawTotalPaid * 100) / 100;

                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.poNumber || s.po_number || '') === (record.poNumber || record.po_number || record.po_no || '')
                    );

                    return {
                        rowIndex: record.id || 0,
                        timestamp: record.timestamp || '',
                        partyName: record.partyName || record.party_name || '',
                        poNumber: record.poNumber || record.po_number || '',
                        internalCode: record.internalCode || record.internal_code || '',
                        product: record.product || '',
                        description: record.description || record.product || '',
                        quantity: Number(record.quantity || 0),
                        unit: record.unit || '',
                        rate: Number(record.rate || 0),
                        gstPercent: Number(record.gstPercent || record.gst_percent || 0),
                        discountPercent: Number(record.discountPercent || record.discount_percent || 0),
                        amount: Number(record.amount || 0),
                        totalPoAmount: totalPo,
                        deliveryDate: record.deliveryDate || record.delivery_date || '',
                        paymentTerms: record.paymentTerms || record.payment_terms || '',
                        numberOfDays: record.numberOfDays || record.number_of_days || 0,
                        firmNameMatch: record.firmNameMatch || '',
                        totalPaidAmount: totalPaid,
                        outstandingAmount: normalizeOutstanding(totalPo - totalPaid),
                        status: record.status || 'Pending',
                        pdf: record.pdf || '',
                        file: '',
                        isPaymentRecord: false,
                        billNo: linkedStoreIn?.billNo || linkedStoreIn?.bill_no || '',
                        billAmount: Number(linkedStoreIn?.billAmount || linkedStoreIn?.bill_amount || 0),
                        advanceAmount: Number(record.advanceAmount || record.advance_amount || 0),
                        advancePercent: Number(record.advancePercent || record.advance_percent || record.advance_percentage || record.number_of_days || 0),
                        rowIds: [record.id || 0],
                        liftNumber: linkedStoreIn?.liftNumber || linkedStoreIn?.lift_number || '',
                    };
                });

            // 3. Identify Payment-based pending items (Direct entries like Store In or Freight)
            const paymentBasedItems = safePaymentsSheet
                .filter((payment: any) => {
                    const status = String(payment?.status || '').toLowerCase();
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === "all" ||
                        (payment?.firmNameMatch || payment?.firm_name) === user?.firmNameMatch;

                    // Show payments that are pending and not yet scheduled
                    const isPending = status === 'pending';
                    const notScheduled = !payment?.planned || String(payment?.planned || '').trim() === '';

                    // ✅ Link with StoreIn to check Bill Type and HOD Status
                    // If Bill Type is "common", or HOD Status is "Rejected", DO NOT show in HOD Approval (Process for Payment)
                    const linkedStoreIn = safeStoreInSheet.find((s: any) =>
                        (s.indentNo || s.indentNumber) === (payment?.internalCode || payment?.internal_code)
                    );

                    if (linkedStoreIn) {
                        if (linkedStoreIn.typeOfBill && linkedStoreIn.typeOfBill.toLowerCase() !== 'independent') {
                            return false;
                        }
                        // ✅ HOD Status Check: Only show if Approved
                        if ((linkedStoreIn.hodStatus || linkedStoreIn.hod_status) !== 'Approved') {
                            return false;
                        }
                    }

                    // ✅ Relaxed Payment Terms for paymentBasedItems
                    const paymentTerms = (payment?.paymentTerms || payment?.payment_terms || '').toString().trim();
                    const paymentForm = (payment?.paymentForm || payment?.payment_form || '').toString().trim().toLowerCase();
                    const isPI = paymentTerms === "Partly PI / Party Advance" || paymentTerms === "Partly PI";
                    const isStoreIn = paymentForm === 'store_in';

                    if (!isPI && !isStoreIn && paymentTerms !== '') {
                        // If it's not PI AND not StoreIn AND it HAS some other term, maybe filter out? 
                        // But usually, if it's in payments table, it's there to be paid.
                        // Let's allow if it's pending.
                    }

                    return firmMatch && isPending && notScheduled;
                })
                .map((payment: any) => {
                    const linkedStoreIn = Array.isArray(safeStoreInSheet)
                        ? safeStoreInSheet.find(s =>
                            (s.indentNo || s.indentNumber) === (payment?.internalCode || payment?.internal_code)
                        )
                        : null;

                    return {
                        rowIndex: payment?.id || payment?.rowIndex || 0,
                        timestamp: payment?.timestamp || '',
                        partyName: payment?.partyName || payment?.party_name || '',
                        poNumber: payment?.poNumber || payment?.po_number || '',
                        internalCode: payment?.internalCode || payment?.internal_code || '',
                        product: payment?.product || payment?.product_name || '',
                        description: `${payment?.paymentForm || payment?.payment_form ? (payment.paymentForm || payment.payment_form).toUpperCase() + ' - ' : ''}${payment?.product || ''}`,
                        quantity: 0,
                        unit: '',
                        rate: 0,
                        gstPercent: 0,
                        discountPercent: 0,
                        amount: Number(payment?.payAmount || payment?.pay_amount || 0),
                        totalPoAmount: Number(payment?.totalPoAmount || payment?.total_po_amount || payment?.payAmount || payment?.pay_amount || 0),
                        deliveryDate: payment?.deliveryDate || payment?.delivery_date || '',
                        paymentTerms: payment?.paymentTerms || payment?.payment_terms || '',
                        numberOfDays: Number(payment?.numberOfDays || payment?.number_of_days || 0),
                        firmNameMatch: payment?.firmNameMatch || payment?.firm_name || '',
                        totalPaidAmount: Number(payment?.totalPaidAmount || payment?.total_paid_amount || 0),
                        outstandingAmount: normalizeOutstanding(Number(payment?.outstandingAmount || payment?.outstanding_amount || payment?.payAmount || payment?.pay_amount || 0)),
                        status: payment?.status || 'Pending',
                        pdf: payment?.pdf || '',
                        file: payment?.file || '',
                        isPaymentRecord: true,
                        billNo: payment?.billNo || payment?.bill_no || linkedStoreIn?.billNo || linkedStoreIn?.bill_no || '',
                        billAmount: Number(payment?.billAmount || payment?.bill_amount || linkedStoreIn?.billAmount || linkedStoreIn?.bill_amount || 0),
                        rowIds: [payment?.id || 0],
                        liftNumber: linkedStoreIn?.liftNumber || linkedStoreIn?.lift_number || '',
                    };
                });

            // 3. Store-In based items: directly from Get Purchase (GetLift) history
            const storeInBasedItems: PIPendingData[] = safeStoreInSheet
                .filter((record: any) => {
                    // Firm filtering
                    const firmMatch = !user || user.firmNameMatch?.toLowerCase() === 'all' ||
                        record.firmNameMatch === user.firmNameMatch;
                    if (!firmMatch) return false;

                    // Must have a bill number or bill amount
                    const hasBill = Number(record.billAmount || 0) > 0 || (record.billNo || '').trim() !== '';
                    if (!hasBill) return false;

                    // Must have a bill status (submitted from Get Purchase form)
                    const billStatus = (record.billStatus || '').trim();
                    if (!billStatus) return false;

                    return true;
                })
                .map((record: any) => {
                    const billAmt = Number(record.billAmount || 0);
                    return {
                        rowIndex: record.id || 0,
                        timestamp: record.timestamp || '',
                        partyName: record.vendorName || '',
                        poNumber: record.poNumber || '',
                        internalCode: record.indentNo || '',
                        product: record.productName || record.product || '',
                        description: record.productName || record.product || '',
                        quantity: Number(record.qty || 0),
                        unit: record.uom || '',
                        rate: Number(record.priceAsPerPo || 0),
                        gstPercent: 0,
                        discountPercent: 0,
                        amount: billAmt,
                        totalPoAmount: billAmt,
                        deliveryDate: '',
                        paymentTerms: record.paymentTerms || '',
                        numberOfDays: 0,
                        firmNameMatch: record.firmNameMatch || '',
                        totalPaidAmount: 0,
                        outstandingAmount: billAmt,
                        status: 'Pending',
                        billNo: record.billNo || '',
                        billAmount: billAmt,
                        pdf: '',
                        file: '',
                        isPaymentRecord: false,
                        rowIds: [record.id || 0],
                        liftNumber: record.liftNumber || '',
                    } as PIPendingData;
                });

            // Combine all three lists and remove duplicates by Party Name + billNo (or PO Number if bill is missing)
            const uniqueBillMap = new Map<string, PIPendingData>();

            // Process poBasedPendingItems first
            poBasedPendingItems.forEach(item => {
                const billKey = item.billNo || `NoBill-${item.poNumber}`;
                const uniqueKey = `${item.partyName || 'NoVendor'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...item });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...item.rowIds]));

                    // Concatenate unique products
                    const existingProducts = existing.product.split(', ').map(p => p.trim());
                    if (item.product && !existingProducts.includes(item.product.trim())) {
                        existing.product = [...existingProducts, item.product.trim()].join(', ');
                    }

                    // Sum advanceAmount across all items of same PO
                    existing.advanceAmount = parseFloat(((existing.advanceAmount ?? 0) + (item.advanceAmount ?? 0)).toFixed(2));
                }
            });

            // Process paymentBasedItems
            paymentBasedItems.forEach(paymentItem => {
                const billKey = paymentItem.billNo || (paymentItem.poNumber ? `NoBill-${paymentItem.poNumber}` : 'NoBill');
                const uniqueKey = `${paymentItem.partyName || 'NoVendor'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...paymentItem });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...paymentItem.rowIds]));

                    // Concatenate unique products
                    const existingProducts = (existing.product || '').split(', ').map(p => p.trim()).filter(Boolean);
                    const newProduct = paymentItem.product?.trim();
                    if (newProduct && !existingProducts.includes(newProduct)) {
                        existing.product = [...existingProducts, newProduct].join(', ');
                    }
                }
            });

            // Process storeInBasedItems (Get Purchase history)
            storeInBasedItems.forEach(storeItem => {
                const billKey = storeItem.billNo || (storeItem.poNumber ? `NoBill-${storeItem.poNumber}` : 'NoBill');
                const uniqueKey = `${storeItem.partyName || 'NoVendor'}-${billKey}`;

                if (!uniqueBillMap.has(uniqueKey)) {
                    uniqueBillMap.set(uniqueKey, { ...storeItem });
                } else {
                    const existing = uniqueBillMap.get(uniqueKey)!;
                    // Enrich existing with liftNumber and billAmount if missing
                    if (!existing.liftNumber) existing.liftNumber = storeItem.liftNumber;
                    if (!existing.billAmount) existing.billAmount = storeItem.billAmount;
                    existing.rowIds = Array.from(new Set([...existing.rowIds, ...storeItem.rowIds]));
                    const existingProducts = (existing.product || '').split(', ').map(p => p.trim()).filter(Boolean);
                    const newProduct = storeItem.product?.trim();
                    if (newProduct && !existingProducts.includes(newProduct)) {
                        existing.product = [...existingProducts, newProduct].join(', ');
                    }
                }
            });

            // Final processing: Split items based on Outstanding Amount
            const finalProcessedList = Array.from(uniqueBillMap.values()).filter(item => {
                return item.outstandingAmount > 0;
            });

            const finalCompletedList = Array.from(uniqueBillMap.values()).filter(item => {
                return item.outstandingAmount <= 0;
            });

            setPendingData(finalProcessedList);
            setCompletedData(finalCompletedList);
        } catch (error) {
            console.error('❌ Error in HOD Approval logic:', error);
            setPendingData([]);
        }
    }, [poMasterSheet, paymentsSheet, storeInSheet, paymentHistorySheet, user?.firmNameMatch]);

    const pendingColumns: ColumnDef<PIPendingData>[] = [
        {
            header: 'Action',
            cell: ({ row }: { row: Row<PIPendingData> }) => {
                const item = row.original;
                const paymentRecords = Array.isArray(paymentsSheet) ? paymentsSheet : [];
                const historyRecords = Array.isArray(paymentHistorySheet) ? paymentHistorySheet : [];

                // 1. Check if it exists in the payments table (already processed for payment)
                const isProcessTable = paymentRecords.some(p => {
                    const poMatch = (p.poNumber || p.po_number) === item.poNumber;
                    // Check for bill match in remark or direct match if available
                    const billMatch = item.billNo
                        ? (p.remark || '').includes(`Bill: ${item.billNo}`) || (p as any).billNo === item.billNo || (p as any).bill_no === item.billNo
                        : true;
                    // If it has a planned date or is pending/approved, it's processed
                    const statusVal = String(p.status1 || p.status || '').toLowerCase();
                    const isProcessedStatus = ['pending', 'approved', 'complete', 'completed', 'process'].includes(statusVal);

                    return poMatch && billMatch && isProcessedStatus;
                });

                // 2. Check if it exists in the payment history (already paid)
                const isInHistory = historyRecords.some(h => {
                    const poMatch = (h.po_number || (h as any).poNumber) === item.poNumber;
                    const billMatch = item.billNo
                        ? (h.bill_no || (h as any).billNo) === item.billNo
                        : true;
                    return poMatch && billMatch;
                });

                const isProcessed = isProcessTable || isInHistory;

                return (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isProcessed}
                        onClick={() => {
                            setSelectedItem(item);
                            setOpenDialog(true);
                        }}
                        className={`border-purple-200 text-purple-700 shadow-sm transition-all ${isProcessed
                            ? 'opacity-40 cursor-not-allowed grayscale'
                            : 'hover:bg-purple-50 hover:text-purple-800'
                            }`}
                    >
                        {isProcessed ? (
                            <>
                                <CheckCircle className="mr-2 h-3.5 w-3.5" />
                                Processed
                            </>
                        ) : (
                            <>
                                <FileText className="mr-2 h-3.5 w-3.5" />
                                Process Payment
                            </>
                        )}
                    </Button>
                );
            },
        },
        {
            accessorKey: 'billNo',
            header: 'Bill No.',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-purple-800">{row.original.billNo || '-'}</span>
            ),
        },
        {
            accessorKey: 'poNumber',
            header: 'PO Number',
            cell: ({ row }) => (
                <span className="font-medium text-gray-700">{row.original.poNumber || '-'}</span>
            ),
        },
        {
            accessorKey: 'partyName',
            header: 'Party Name',
            cell: ({ row }) => (
                <span className="font-medium">{row.original.partyName || '-'}</span>
            ),
        },
        {
            accessorKey: 'internalCode',
            header: 'Indent No.',
            cell: ({ row }) => (
                <div className="bg-slate-100 text-slate-700 py-1 px-2.5 rounded text-[11px] font-bold inline-block border border-slate-200 uppercase tracking-wider">
                    {row.original.internalCode || '-'}
                </div>
            ),
        },
        {
            accessorKey: 'product',
            header: 'Product',
            cell: ({ row }) => (
                <span className="text-sm font-medium text-slate-700">{row.original.product || '-'}</span>
            ),
        },
        {
            accessorKey: 'totalPoAmount',
            header: () => <div className="text-right">Total PO Amount</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold text-slate-900">
                    ₹{row.original.totalPoAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                </div>
            ),
        },
        {
            accessorKey: 'billAmount',
            header: () => <div className="text-right">Bill Amount</div>,
            cell: ({ row }) => (
                <div className="text-right font-semibold text-purple-700">
                    ₹{row.original.billAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) || '0'}
                </div>
            ),
        },
        {
            accessorKey: 'totalPaidAmount',
            header: () => <div className="text-right">Total Paid</div>,
            cell: ({ row }) => (
                <div className="text-right font-semibold text-emerald-600">
                    ₹{row.original.totalPaidAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                </div>
            ),
        },
        {
            accessorKey: 'outstandingAmount',
            header: () => <div className="text-right text-rose-600">Outstanding</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold text-rose-600">
                    ₹{row.original.outstandingAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                </div>
            ),
        },
        {
            accessorKey: 'pdf',
            header: 'PO/PI PDF',
            cell: ({ row }) => {
                const pdf = row.original.pdf;
                const poNumber = row.original.poNumber;
                const id = row.original.rowIndex;
                const isPayment = row.original.isPaymentRecord;
                return (
                    <div className="flex flex-col items-center justify-center gap-1">
                        {pdf ? (
                            <a href={pdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                View
                            </a>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                        {isPayment ? (
                            <AdminFileUpdater
                                tableName="payments"
                                columnName="pdf"
                                rowIdColumn="id"
                                rowIdValue={id}
                                bucketName="po_image"
                                currentFileUrl={pdf}
                                onUpdate={updateAll}
                            />
                        ) : (
                            poNumber && (
                                <AdminFileUpdater
                                    tableName="po_master"
                                    columnName="pdf"
                                    rowIdColumn="po_number"
                                    rowIdValue={poNumber}
                                    bucketName="po_image"
                                    currentFileUrl={pdf}
                                    onUpdate={updateAll}
                                />
                            )
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'file',
            header: 'Payment File',
            cell: ({ row }) => {
                const file = row.original.file;
                const id = row.original.rowIndex;
                const isPayment = row.original.isPaymentRecord;
                if (!isPayment) return <span className="text-gray-400">-</span>;
                return (
                    <div className="flex flex-col items-center justify-center gap-1">
                        {file ? (
                            <a href={file} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                                View
                            </a>
                        ) : (
                            <span className="text-gray-400">-</span>
                        )}
                        <AdminFileUpdater
                            tableName="payments"
                            columnName="file"
                            rowIdColumn="id"
                            rowIdValue={id}
                            bucketName="po_image"
                            currentFileUrl={file}
                            onUpdate={updateAll}
                        />
                    </div>
                );
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const outstanding = row.original.outstandingAmount || 0;
                let statusStr = row.original.status || 'Pending';
                
                // Override status to completed if outstanding is 0
                if (outstanding <= 0) {
                    statusStr = 'Completed';
                }

                const status = statusStr.toLowerCase();
                const isPending = status === 'pending';
                const isComplete = status === 'complete' || status === 'completed';

                return (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-tight ${isComplete
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : isPending
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}>
                        {isComplete && <CheckCircle className="mr-1 h-3 w-3" />}
                        {isPending && <AlertCircle className="mr-1 h-3 w-3" />}
                        {statusStr}
                    </span>
                );
            },
        },
        {
            accessorKey: 'paymentTerms',
            header: 'Payment Terms',
            cell: ({ row }) => (
                <span className="text-sm">{row.original.paymentTerms || '-'}</span>
            ),
        },
        {
            accessorKey: 'advanceAmount',
            header: () => <div className="text-right">Advance Amt</div>,
            cell: ({ row }) => {
                const item = row.original;
                const pt = (item.paymentTerms || '').toLowerCase();
                const isAdvanceTerm = pt.includes('partly') && (pt.includes('advance') || pt.includes('pi'));
                if (!isAdvanceTerm) return <span className="text-gray-400 text-sm text-right block">-</span>;
                return (
                    <div className="text-right">
                        <span className="font-semibold text-amber-700 text-sm">
                            ₹{(item.advanceAmount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                        </span>
                        {(item.advancePercent ?? 0) > 0 && (
                            <div className="text-[10px] text-amber-500 font-medium">{item.advancePercent}%</div>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: 'deliveryDate',
            header: 'Delivery Date',
            cell: ({ row }) => {
                const deliveryDate = row.original.deliveryDate;
                if (!deliveryDate) return <span className="text-sm">-</span>;

                try {
                    const date = new Date(deliveryDate);
                    if (isNaN(date.getTime())) {
                        return <span className="text-sm">{deliveryDate}</span>;
                    }
                    const formattedDate = `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getFullYear().toString().slice(-2)}`;
                    return <span className="text-sm">{formattedDate}</span>;
                } catch (error) {
                    return <span className="text-sm">{deliveryDate}</span>;
                }
            },
        },
        {
            accessorKey: 'firmNameMatch',
            header: 'Firm',
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    {row.original.firmNameMatch || '-'}
                </div>
            ),
        },
    ];

    // ✅ UPDATED SCHEMA - Pay Amount, File, Remarks
    const schema = z.object({
        payAmount: z.coerce.number().min(1, 'Amount must be greater than 0'),
    });

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: {
            payAmount: 0,
        },
    });

    useEffect(() => {
        if (!openDialog) {
            form.reset();
        } else if (selectedItem) {
            const defaultAmt = selectedItem.billAmount && selectedItem.billAmount > 0
                ? selectedItem.billAmount
                : selectedItem.outstandingAmount || 0;
            form.setValue('payAmount', defaultAmt);
        }
    }, [openDialog, selectedItem, form]);


    function generateUniqueNo(): string {
        const existingCount = Array.isArray(paymentsSheet) ? paymentsSheet.length : 0;
        return `PAY-${(existingCount + 1).toString().padStart(4, '0')}`;
    }

    function toIsoDate(value: unknown): string | null {
        const str = String(value || '').trim();
        if (!str) return null;
        const ddmmyyyy = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
        if (ddmmyyyy) {
            const [, day, month, year] = ddmmyyyy;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        const parsed = new Date(str);
        return isNaN(parsed.getTime()) ? null : parsed.toISOString().split('T')[0];
    }

    async function onSubmit(values: z.infer<typeof schema>) {
        try {
            if (!selectedItem) {
                toast.error('No item selected');
                return;
            }

            const isoNow = new Date().toISOString();
            const payAmount = Number(values.payAmount) || 0;
            const newOutstanding = (selectedItem.outstandingAmount || 0) - payAmount;
            const newStatus = newOutstanding <= 0 ? 'Complete' : 'Pending';
            const finalRemark = selectedItem.billNo
                ? `Bill: ${selectedItem.billNo}`
                : '';

            const uniqueNo = generateUniqueNo();

            const paymentData = {
                timestamp: isoNow,
                unique_no: uniqueNo,
                party_name: selectedItem.partyName,
                po_number: selectedItem.poNumber,
                total_po_amount: String(selectedItem.totalPoAmount || ''),
                internal_code: selectedItem.internalCode,
                product: selectedItem.product,
                delivery_date: toIsoDate(selectedItem.deliveryDate),
                payment_terms: selectedItem.paymentTerms || '',
                number_of_days: String(selectedItem.numberOfDays || '0'),
                pdf: selectedItem.pdf || '',
                pay_amount: String(payAmount),
                file: '',
                remark: finalRemark,
                total_paid_amount: String((selectedItem.totalPaidAmount || 0) + payAmount),
                outstanding_amount: String(newOutstanding),
                status: newStatus,
                planned: isoNow.split('T')[0],
                actual: null,
                firm_name: selectedItem.firmNameMatch || user?.firmNameMatch || '',
                status1: 'pending',
                payment_form: 'store_in',
            };

            const { error: insertError } = await supabase
                .from('payments')
                .insert([paymentData]);

            if (insertError) throw insertError;

            toast.success(`✅ Payment queued for: ${selectedItem.partyName}`);
            setOpenDialog(false);
            setTimeout(() => updateAll(), 1000);
        } catch (error) {
            toast.error(`Failed to process payment: ${(error as Error)?.message || 'Unknown error'}`);
            console.error('Payment error:', error);
        }
    }

    function onError(e: any) {
        console.log(e);
        toast.error('Please fill all required fields correctly');
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-purple-50 p-4 md:p-6">
            <div className="mx-auto max-w-7xl">
                {/* Header Section */}
                <div className="mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-purple-600 rounded-lg shadow">
                            <Package2 size={28} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Process for Payment</h1>
                            <p className="text-gray-600">Approved GRN need to process payments for pending purchase orders</p>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Pending Payments</p>
                                        <p className="text-2xl font-bold text-purple-600 mt-1">{stats.total}</p>
                                    </div>
                                    <FileText className="h-10 w-10 text-purple-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Total PO Amount</p>
                                        <p className="text-2xl font-bold text-green-600 mt-1">
                                            ₹{stats.totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                    <DollarSign className="h-10 w-10 text-green-500" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-white shadow border-0 hover:shadow-md transition-shadow">
                            <CardContent className="p-5">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-gray-600">Payment Status</p>
                                        <p className="text-2xl font-bold text-amber-600 mt-1">
                                            {stats.pendingCount > 0 ? 'Pending' : 'Completed'}
                                        </p>
                                    </div>
                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full ${stats.pendingCount > 0 ? 'bg-amber-100' : 'bg-green-100'
                                        }`}>
                                        {stats.pendingCount > 0 ? (
                                            <AlertCircle className="h-6 w-6 text-amber-600" />
                                        ) : (
                                            <CheckCircle className="h-6 w-6 text-green-600" />
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Main Content Card */}
                <Card className="bg-white shadow-lg border-0 mb-6">
                    <CardHeader className="">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-xl font-bold text-gray-800">Process for Payment</CardTitle>
                                <p className="text-gray-600 text-sm mt-1">Approved GRN need to process payments for pending purchase orders</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {stats.total === 0 ? (
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800 border border-green-300">
                                        <CheckCircle className="mr-1 h-3 w-3" />
                                        All Paid
                                    </div>
                                ) : (
                                    <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 border border-purple-300">
                                        <AlertCircle className="mr-1 h-3 w-3" />
                                        {stats.total} {activeTab === 'pending' ? 'Pending' : 'Completed'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                            <TabsList className="mb-4 grid w-full max-w-md grid-cols-2">
                                <TabsTrigger value="pending">Pending</TabsTrigger>
                                <TabsTrigger value="completed">Completed</TabsTrigger>
                            </TabsList>
                            <TabsContent value={activeTab}>
                                {(activeTab === 'pending' ? pendingData : completedData).length > 0 ? (
                                    <div className="space-y-4">
                                        {/* Date Range Filters Bar */}
                                <div className="flex flex-wrap items-center gap-3 bg-purple-50/50 p-3 rounded-lg border border-purple-100/50 mb-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold text-slate-700">Filter by Date Range:</span>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    data-empty={!startDate}
                                                    className="data-[empty=true]:text-muted-foreground min-w-[130px] justify-start text-left font-normal bg-white border-slate-200 h-9"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                                                    {startDate ? format(startDate, 'dd-MM-yyyy') : <span>From Date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                                            </PopoverContent>
                                        </Popover>

                                        <span className="text-slate-400 text-sm">to</span>

                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    data-empty={!endDate}
                                                    className="data-[empty=true]:text-muted-foreground min-w-[130px] justify-start text-left font-normal bg-white border-slate-200 h-9"
                                                >
                                                    <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                                                    {endDate ? format(endDate, 'dd-MM-yyyy') : <span>To Date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                                            </PopoverContent>
                                        </Popover>

                                        {(startDate || endDate) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    setStartDate(undefined);
                                                    setEndDate(undefined);
                                                }}
                                                className="h-9 w-9 text-slate-500 hover:text-slate-800"
                                                title="Clear Dates"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <DataTable
                                    data={filteredData}
                                    columns={pendingColumns}
                                    searchFields={['poNumber', 'partyName', 'product', 'internalCode', 'firmNameMatch']}
                                    dataLoading={poMasterLoading}
                                    className="border rounded-lg"
                                    extraActions={
                                        <div className="flex items-center gap-3">
                                            {/* Payment Terms Filter */}
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-slate-600 whitespace-nowrap">Payment Terms:</span>
                                                <Select value={filterTerm} onValueChange={setFilterTerm}>
                                                    <SelectTrigger className="w-[180px] h-9 bg-white border-slate-200">
                                                        <SelectValue placeholder="Select Term" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="All">All Terms</SelectItem>
                                                        <SelectItem value="Advance Terms">Advance Terms (PI/Advance)</SelectItem>
                                                        {uniquePaymentTerms.map(term => (
                                                            <SelectItem key={term} value={term}>
                                                                {term}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <Separator orientation="vertical" className="h-6" />

                                            {/* Export Button */}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownload(filteredData)}
                                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 h-9 font-medium flex items-center gap-2"
                                            >
                                                <Download className="h-4 w-4" />
                                                Export CSV
                                            </Button>
                                        </div>
                                    }
                                />
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Data Found</h3>
                                <p className="text-gray-500">
                                    {activeTab === 'pending' ? 'All payments have been processed or no pending items found.' : 'No completed items found.'}
                                </p>
                            </div>
                        )}
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>

                {/* Payment Dialog */}
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    {selectedItem && (
                        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit, onError)} className="space-y-6">
                                    <DialogHeader>
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="p-2 bg-purple-100 rounded-lg">
                                                <DollarSign className="h-6 w-6 text-purple-600" />
                                            </div>
                                            <div>
                                                <DialogTitle className="text-xl">Make Payment</DialogTitle>
                                                <DialogDescription>
                                                    Process payment for PO: <span className="font-semibold text-purple-600">{selectedItem.poNumber}</span>
                                                </DialogDescription>
                                            </div>
                                        </div>
                                    </DialogHeader>

                                    <Separator />

                                    {/* PO Details Card */}
                                    <Card className="bg-purple-50 border-purple-200">
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-base font-semibold text-purple-800 flex items-center gap-2">
                                                <Package2 className="h-4 w-4" />
                                                PO Details
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">PO Number</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.poNumber}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Party Name</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.partyName}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Indent No.</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.internalCode}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Product</p>
                                                    <p className="text-sm font-semibold text-gray-800">{selectedItem.product}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total PO Amount</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPoAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Total Paid</p>
                                                    <p className="text-sm font-semibold text-green-600">
                                                        ₹{selectedItem.totalPaidAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Outstanding</p>
                                                    <p className="text-sm font-semibold text-red-600">
                                                        ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 })}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-gray-600">Status</p>
                                                    <div className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                                        {selectedItem.status || 'Pending'}
                                                    </div>
                                                </div>

                                            </div>
                                        </CardContent>
                                    </Card>

                                    {/* ✅ UPDATED Form Fields - Only Pay Amount, File, Remarks */}
                                    <div className="space-y-4">


                                        {/* Bill Amount Display (Read-only) */}
                                        <div className="space-y-1.5 p-3 bg-purple-50 rounded-md border border-purple-100">
                                            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider">Bill Amount</p>
                                            <p className="text-lg font-bold text-purple-900 flex items-center gap-1.5">
                                                ₹{selectedItem.billAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) || '0'}
                                            </p>
                                        </div>

                                        {/* Amount to Pay (editable) */}
                                        <FormField
                                            control={form.control}
                                            name="payAmount"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="font-medium">
                                                        Amount to Pay <span className="text-red-500">*</span>
                                                        <span className="ml-2 text-xs text-gray-400 font-normal">
                                                            (Max: ₹{selectedItem.outstandingAmount?.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 0 }) || '0'})
                                                        </span>
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder="Enter amount to pay"
                                                            className="border-gray-300 focus:border-purple-500 text-lg font-semibold"
                                                            min={1}
                                                            max={selectedItem.outstandingAmount || undefined}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                    </div>

                                    <Separator />

                                    <DialogFooter className="gap-2">
                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                type="button"
                                                className="border-gray-300"
                                                disabled={form.formState.isSubmitting || uploadingFile}
                                            >
                                                Cancel
                                            </Button>
                                        </DialogClose>
                                        <Button
                                            type="submit"
                                            className="bg-purple-600 hover:bg-purple-700 shadow-sm"
                                            disabled={form.formState.isSubmitting || uploadingFile}
                                        >
                                            {form.formState.isSubmitting ? (
                                                <>
                                                    <Loader size={18} className="mr-2" />
                                                    Submitting...
                                                </>
                                            ) : (
                                                <>
                                                    <DollarSign className="mr-2 h-4 w-4" />
                                                    Submit Payment
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    )}
                </Dialog>
            </div>
        </div>
    );
}