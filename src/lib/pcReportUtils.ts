import type { PoMasterSheet } from '@/types';
import type { PcReportSheet, IndentSheet, StoreInSheet, IssueSheet, FullkittingSheet, TallyEntrySheet, PaymentsSheet } from '@/types/sheets';

const FIRMS = ['PMPL', 'PURAB', 'PMMPL', 'REFRASYNTH'] as const;

const has = (v: any): boolean => v !== undefined && v !== null && String(v).trim() !== '';
const firmOf = (item: any): string =>
    String(item?.firmNameMatch || item?.firm_name_match || item?.firm_name || '').trim().toUpperCase();

type Row = Record<string, string | number>;
type RowFn = (item: any, group: any[]) => Row;

/**
 * Counts pending / complete rows for one stage.
 * The pending filters mirror the sidebar badge / page filters exactly so the
 * PC Report numbers always agree with the actual pages.
 * `keyFn` de-duplicates pending rows the same way the page does (one card per unique key);
 * `completeKeyFn` does the same for the history rows (defaults to no de-duplication).
 * `rowFn` builds the export row (page's Pending-tab columns); it also gets every row of its group.
 */
const buildStage = (
    stage: string,
    data: any[],
    pendingFilter: (item: any) => boolean,
    completeFilter: (item: any) => boolean,
    keyFn?: (item: any, index: number) => string,
    completeKeyFn?: (item: any, index: number) => string,
    rowFn?: RowFn
): PcReportSheet => {
    const uniqueCount = (filter: (item: any) => boolean, keyFn?: (item: any, index: number) => string) => {
        const rows = data.filter(filter);
        if (!keyFn) return { total: rows.length, byFirm: rows.map(firmOf), groups: rows.map(r => [r]) };
        const seen = new Map<string, any[]>();
        rows.forEach((r, i) => {
            const k = keyFn(r, i);
            const g = seen.get(k);
            if (g) g.push(r);
            else seen.set(k, [r]);
        });
        const groups = [...seen.values()];
        return { total: groups.length, byFirm: groups.map(g => firmOf(g[0])), groups };
    };

    const pending = uniqueCount(pendingFilter, keyFn);
    const complete = uniqueCount(completeFilter, completeKeyFn);
    const firmCount = (firm: string) => pending.byFirm.filter(f => f === firm).length;

    return {
        stage,
        totalPending: pending.total,
        totalComplete: complete.total,
        pendingPmpl: firmCount(FIRMS[0]),
        pendingPurab: firmCount(FIRMS[1]),
        pendingPmmpl: firmCount(FIRMS[2]),
        pendingRefrasynth: firmCount(FIRMS[3]),
        pendingRows: rowFn ? pending.groups.map(g => ({ ...rowFn(g[0], g), __firm: firmOf(g[0]) })) : []
    };
};

// ==================== Export rows: same columns / order as each page's Pending tab ====================
// (the "Action" column is left out; keys starting with "__" are internal and never printed)
const str = (v: any) => (v === undefined || v === null ? '' : String(v));
const num = (v: any) => Number(v) || 0;
const uniq = (values: any[]) => [...new Set(values.map(str).map(s => s.trim()).filter(Boolean))];

const fmtDate = (v: any): string => {
    if (!has(v)) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? str(v) : d.toLocaleDateString('en-GB');
};
const fmtDateTime = (v: any): string => {
    if (!has(v)) return '';
    const d = new Date(v);
    return isNaN(d.getTime()) ? str(v) : d.toLocaleString('en-GB');
};

const issueRow: RowFn = i => ({
    'Issue No': str(i.issueNo), 'Issue To': str(i.issueTo), 'Group Head': str(i.groupHead), 'UOM': str(i.uom),
    'Product Name': str(i.productName), 'Quantity': str(i.quantity), 'Department': str(i.department),
    'Location': str(i.location), 'Planned Date': fmtDateTime(i.planned1)
});

const indentApprovalRow: RowFn = i => ({
    'Indent No.': str(i.indentNumber), 'Product': str(i.productName), 'Area of Use': str(i.areaOfUse),
    'Req Qty': str(i.quantity), 'Approve Qty': str(i.approvedQuantity), 'UOM': str(i.uom), 'Firm Name': str(i.firmNameMatch),
    'Indenter': str(i.indenterName), 'Department': str(i.department), 'Specifications': str(i.specifications),
    'Vendor Type': str(i.vendorType), 'Priority': str(i.indentStatus), 'Days': str(i.noDay),
    'Attachment': str(i.attachment), 'Date': fmtDateTime(i.timestamp), 'Planned Date': fmtDateTime(i.planned1)
});

const vendorUpdateRow: RowFn = i => ({
    'Indent No.': str(i.indentNumber), 'Firm Name': str(i.firmNameMatch), 'Indenter': str(i.indenterName),
    'Department': str(i.department), 'Specifications': str(i.specifications), 'Product': str(i.productName),
    'Area of Use': str(i.areaOfUse), 'Quantity': str(i.approvedQuantity || i.quantity), 'UOM': str(i.uom),
    'Vendor Type': str(i.vendorType), 'Planned Date': fmtDateTime(i.planned2)
});

const vendorsText = (i: any) =>
    [1, 2, 3]
        .map(n => ({ name: str(i[`vendorName${n}`]), rate: str(i[`rate${n}`]), rank: str(i[`vendor${n}_rank`]) }))
        .filter(v => v.name)
        .map(v => `${v.name} (Rate: ${v.rate || 0}${v.rank ? `, Rank: ${v.rank}` : ''})`)
        .join('; ');

const approvalRow = (plannedKey: 'planned3' | 'planned4'): RowFn => i => ({
    'Timestamp': fmtDateTime(i.timestamp), 'Indent No.': str(i.indentNumber), 'Firm Name': str(i.firmNameMatch),
    'Indenter': str(i.indenterName), 'Department': str(i.department), 'Product': str(i.productName),
    'Quantity': str(i.approvedQuantity || i.quantity), 'UOM': str(i.uom), 'Area of Use': str(i.areaOfUse),
    'Planned Date': fmtDateTime(i[plannedKey]), 'Vendors': vendorsText(i)
});

const pendingPoRow: RowFn = i => ({
    'Timestamp': fmtDateTime(i.timestamp), 'Planned Date': fmtDate(i.planned5),
    'Expected Date': fmtDate(i.expectedReqDate || i.deliveryDate), 'Indent Number': str(i.indentNumber),
    'Firm Name': str(i.firmNameMatch), 'Product': str(i.productName),
    'Pending PO Qty': str(num(i.rawPendingPoQty) || num(i.quantity)), 'Rate': str(num(i.approvedRate) || num(i.rate1)),
    'UOM': str(i.uom), 'Vendor Name': str(i.approvedVendorName || i.vendorName1),
    'Payment Term': str(i.approvedPaymentTerm || i.paymentTerm1), 'Specifications': str(i.specifications),
    'PO Required': str(i.poRequredDb)
});

const storeCheckRow: RowFn = (i, g) => ({
    'Timestamp': fmtDateTime(i.timestamp), 'PO Number': str(i.poNumber), 'Vendor Name': str(i.vendorName), 'Bill No.': str(i.billNo),
    'Products': uniq(g.map(x => x.productName)).join(', '), 'Firm Name': str(i.firmNameMatch), 'Bill Status': str(i.billStatus),
    'Bill Amount': str(i.billAmount), 'Discount Amount': str(i.discountAmount), 'Qty': g.reduce((s, x) => s + num(x.qty), 0),
    'Lead Time To Lift': str(i.leadTimeToLiftMaterial), 'Type Of Bill': str(i.typeOfBill), 'Payment Type': str(i.paymentType),
    'Advance': str(i.advanceAmountIfAny), 'Photo Of Bill': str(i.photoOfBill), 'Trans. Include': str(i.transportationInclude),
    'Transporter': str(i.transporterName), 'Freight Amount': str(i.amount)
});

const hodRow: RowFn = i => ({
    'Lift No.': str(i.liftNumber), 'Indent No.': str(i.indentNo), 'Product': str(i.productName), 'Vendor': str(i.vendorName),
    'Order Qty': str(i.qty), 'Rec. Qty': str(i.receivedQuantity), 'Physical Good?': str(i.damageOrder)
});

const freightRow: RowFn = i => ({
    'Timestamp': fmtDateTime(i.timestamp), 'Indent Number': str(i.indentNumber), 'Firm Name': str(i.firmNameMatch),
    'Vendor Name': str(i.vendorName), 'Product Name': str(i.productName), 'Qty': str(i.qty), 'Bill No.': str(i.billNo),
    'Planned Date': fmtDateTime(i.planned), 'Transportation Include': str(i.transportingInclude),
    'Transporter Name': str(i.transporterName), 'Amount': str(i.amount)
});

const yesNo = (v: any) => (v === undefined || v === null || v === '' ? '' : v);
const grnRow: RowFn = i => ({
    'Timestamp': fmtDateTime(i.timestamp), 'Lift Number': str(i.liftNumber), 'Indent No.': str(i.indentNo), 'Bill No.': str(i.billNo),
    'Vendor Name': str(i.vendorName), 'Firm Name': str(i.firmNameMatch), 'Product Name': str(i.productName), 'Qty': str(i.qty),
    'Type Of Bill': str(i.typeOfBill), 'Bill Amount': str(i.billAmount), 'Payment Type': str(i.paymentType),
    'Advance Amount If Any': str(i.advanceAmountIfAny), 'Photo Of Bill': str(i.photoOfBill),
    'Transportation Include': str(i.transportationInclude), 'Transporter Name': str(i.transporterName), 'Amount': str(i.amount),
    'Physical Good ?': str(yesNo(i.damageOrder)), 'Qty Match?': str(yesNo(i.quantityAsPerBill)),
    'Price Match?': str(yesNo(i.priceAsPerPoCheck)), 'Remark': str(i.remark), 'Planned Date': fmtDateTime(i.planned7)
});

const debitNoteRow: RowFn = i => ({
    'Timestamp': fmtDateTime(i.timestamp), 'Lift Number': str(i.liftNumber), 'Indent No.': str(i.indentNo), 'Firm Name': str(i.firmNameMatch),
    'Bill No.': str(i.billNo), 'Vendor Name': str(i.vendorName), 'Product Name': str(i.productName), 'Qty': str(i.qty),
    'Type Of Bill': str(i.typeOfBill), 'Bill Amount': str(i.billAmount), 'Payment Type': str(i.paymentType),
    'Advance Amount If Any': str(i.advanceAmountIfAny), 'Photo Of Bill': str(i.photoOfBill),
    'Transportation Include': str(i.transportationInclude), 'Transporter Name': str(i.transporterName), 'Amount': str(i.amount),
    'Reason': str(i.reason), 'Planned Date': fmtDateTime(i.planned9)
});

const billNotReceivedRow: RowFn = i => ({
    'Lift Number': str(i.liftNumber), 'Indent No.': str(i.indentNo), 'PO Number': str(i.poNumber), 'Vendor Name': str(i.vendorName),
    'Firm Name': str(i.firmNameMatch), 'Product Name': str(i.productName), 'Bill Status': str(i.billStatus),
    'Planned Date': fmtDateTime(i.planned11), 'Bill No.': str(i.billNo), 'Qty': str(i.qty),
    'Lead Time To Lift Material': str(i.leadTimeToLiftMaterial), 'Type Of Bill': str(i.typeOfBill), 'Bill Amount': str(i.billAmount),
    'Discount Amount': str(i.discountAmount), 'Payment Type': str(i.paymentType), 'Advance Amount If Any': str(i.advanceAmountIfAny),
    'Photo Of Bill': str(i.photoOfBill), 'Transportation Include': str(i.transportationInclude),
    'Transporter Name': str(i.transporterName), 'Amount': str(i.amount)
});

export const calculatePcReportCounts = (
    indentSheet: IndentSheet[],
    storeInSheet: StoreInSheet[],
    issueSheet: IssueSheet[],
    fullkittingSheet: FullkittingSheet[],
    tallyEntrySheet: TallyEntrySheet[],
    paymentsSheet: PaymentsSheet[],
    poMasterSheet: PoMasterSheet[],
    makePaymentHistoryCount: number = 0
): PcReportSheet[] => {
    const indents: any[] = indentSheet || [];
    const storeIns: any[] = storeInSheet || [];
    const issues: any[] = issueSheet || [];
    const freights: any[] = fullkittingSheet || [];
    const tallies: any[] = tallyEntrySheet || [];
    const payments: any[] = paymentsSheet || [];
    const poMasters: any[] = poMasterSheet || [];

    const hasRank = (i: any) => !!(i.vendor1_rank || i.vendor2_rank || i.vendor3_rank);
    const hasApprovedVendor = (i: any) => has(i.approvedVendorName || i.approved_vendor_name);

    // Store Check page shows only the latest record per indent + product
    const latestStoreIns: any[] = (() => {
        const seen = new Set<string>();
        return storeIns.filter(i => {
            const key = `${i.indentNo || i.indent_no}-${i.productName || i.product_name}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })();
    const billStatusOf = (i: any) => i.billStatus || i.bill_status;
    const vendorBillKey = (i: any) => `${i.vendorName || i.vendor_name}-${String(i.billNo || i.bill_no || '')}`;

    // Payments: same linkage the payment pages use
    const findStoreInByIndent = (code: any) =>
        storeIns.find(s => (s.indentNo || s.indentNumber) === code);

    const withFirm = (row: Row, firm: string): Row => ({ ...row, __firm: firm });

    // ---- Process for Payment: mirrors PaymentStatus page ----
    // Three sources (PO Master, unscheduled pending payments, store-in bills) are merged by Party + Bill;
    // Pending tab = outstanding > 0, Completed tab = outstanding <= 0.
    const processForPayment = (): PcReportSheet => {
        const normalize = (v: number) => (Math.abs(v) < 1 ? 0 : Math.round(v * 100) / 100);
        const poOf = (r: any) => r.poNumber || r.po_number || r.po_no || '';
        type Bill = { outstanding: number; firm: string; info: { billNo: string; po: string; party: string; indents: string[]; products: string[]; terms: string; delivery: string; status: string } };
        const bills = new Map<string, Bill>();
        const add = (
            party: string, billNo: string, po: string, outstanding: number, firm: string, poFallback: boolean,
            extra: { indent?: string; product?: string; terms?: string; delivery?: string; status?: string } = {}
        ) => {
            // PO Master rows always fall back to `NoBill-<po>`; other sources use plain `NoBill` when no PO
            const billKey = billNo || (po || !poFallback ? `NoBill-${po}` : 'NoBill');
            const key = `${party || 'NoVendor'}-${billKey}`;
            const existing = bills.get(key);
            if (!existing) {
                bills.set(key, {
                    outstanding, firm,
                    info: {
                        billNo, po, party, indents: extra.indent ? [extra.indent] : [], products: extra.product ? [extra.product] : [],
                        terms: extra.terms || '', delivery: extra.delivery || '', status: extra.status || 'Pending'
                    }
                });
            } else {
                // same bill seen again: the page concatenates unique products
                if (extra.product && !existing.info.products.includes(extra.product)) existing.info.products.push(extra.product);
                if (extra.indent && !existing.info.indents.includes(extra.indent)) existing.info.indents.push(extra.indent);
            }
        };

        // 1. PO Master
        poMasters.forEach(r => {
            const status = String(r.status || r.indent_status || '').trim().toLowerCase();
            if (status === 'rejected' || status === 'cancelled') return;
            const po = poOf(r);
            const totalPo = Math.round(Number(r.totalPoAmount || 0) * 100) / 100;
            const paid = payments
                .filter(p => poOf(p) === po)
                .filter(p => {
                    const st = String(p.status1 || p.status || '').toLowerCase();
                    return st !== 'rejected' && st !== 'cancelled';
                })
                .reduce((sum, p) => sum + Number(p.payAmount || p.pay_amount || 0), 0);
            const linked = storeIns.find(s => (s.poNumber || s.po_number || '') === po);
            add(r.partyName || r.party_name || '', linked?.billNo || linked?.bill_no || '', po,
                normalize(totalPo - Math.round(paid * 100) / 100), firmOf(r), false, {
                    indent: str(r.internalCode || r.internal_code), product: str(r.product),
                    terms: str(r.paymentTerms || r.payment_terms), delivery: fmtDate(r.deliveryDate || r.delivery_date),
                    status: str(r.status || 'Pending')
                });
        });

        // 2. Pending, unscheduled payments (HOD approved, independent bills)
        payments.forEach(p => {
            if (String(p.status || '').toLowerCase() !== 'pending' || has(p.planned)) return;
            const linked = findStoreInByIndent(p.internalCode || p.internal_code);
            if (linked) {
                if (linked.typeOfBill && linked.typeOfBill.toLowerCase() !== 'independent') return;
                if ((linked.hodStatus || linked.hod_status) !== 'Approved') return;
            }
            add(p.partyName || p.party_name || '',
                p.billNo || p.bill_no || linked?.billNo || linked?.bill_no || '',
                poOf(p),
                normalize(Number(p.outstandingAmount || p.outstanding_amount || p.payAmount || p.pay_amount || 0)),
                firmOf(p), true, {
                    indent: str(p.internalCode || p.internal_code), product: str(p.product),
                    terms: str(p.paymentTerms || p.payment_terms), delivery: fmtDate(p.deliveryDate || p.delivery_date),
                    status: str(p.status || 'Pending')
                });
        });

        // 3. Store-in bills
        storeIns.forEach(s => {
            const billAmt = Number(s.billAmount || 0);
            if (!(billAmt > 0 || has(s.billNo)) || !has(s.billStatus)) return;
            add(s.vendorName || '', s.billNo || '', s.poNumber || '', billAmt, firmOf(s), true, {
                indent: str(s.indentNo), product: str(s.productName || s.product), terms: str(s.paymentTerms), status: 'Pending'
            });
        });

        const all = [...bills.values()];
        const pending = all.filter(b => b.outstanding > 0);
        const firmCount = (f: string) => pending.filter(b => b.firm === f).length;
        return {
            stage: 'Process for Payment',
            totalPending: pending.length,
            totalComplete: all.length - pending.length,
            pendingPmpl: firmCount('PMPL'),
            pendingPurab: firmCount('PURAB'),
            pendingPmmpl: firmCount('PMMPL'),
            pendingRefrasynth: firmCount('REFRASYNTH'),
            pendingRows: pending.map(b => withFirm({
                'Bill No.': b.info.billNo, 'PO Number': b.info.po, 'Party Name': b.info.party,
                'Indent No.': b.info.indents.join(', '), 'Product': b.info.products.join(', '), 'Status': b.info.status,
                'Payment Terms': b.info.terms, 'Delivery Date': b.info.delivery, 'Firm': b.firm
            }, b.firm))
        };
    };

    // ---- Lifting: mirrors GetLift page ----
    // Pending tab: indents with lifting qty left (approved qty - indent received - store-in qty), grouped by PO.
    // History tab: store-in (lift) records that belong to an indent.
    function liftingStage(): PcReportSheet {
        const storeInQty = new Map<string, number>();
        const indentKeys = new Set<string>();
        indents.forEach(i => indentKeys.add(`${i.indentNumber?.toString() || ''}_${firmOf(i)}`));
        storeIns.forEach(s => {
            const k = `${s.indentNo || s.indent_no || ''}_${firmOf(s)}`;
            storeInQty.set(k, (storeInQty.get(k) || 0) + (Number(s.qty) || 0));
        });

        const poGroups = new Map<string, { first: any; firm: string; products: string[]; pendingQty: number; received: number }>();
        indents.forEach(i => {
            const k = `${i.indentNumber?.toString() || ''}_${firmOf(i)}`;
            const received = (Number(i.receivedQuantity) || 0) + (storeInQty.get(k) || 0);
            // Same priority as GetLift page: pending_po_qty > approved_quantity > quantity
            const rawPending = Number(i.rawPendingPoQty) || 0;
            const rawApproved = Number(i.approvedQuantity) || 0;
            const baseQty = rawPending > 0 ? rawPending : (rawApproved > 0 ? rawApproved : (Number(i.quantity) || 0));
            const pendingQty = baseQty - received;
            const status = i.liftingStatus || i.lifting_status;
            const isPending = status === 'Pending' || !status;
            if (isPending && has(i.planned5) && !has(i.actual5) && pendingQty > 0) {
                const poKey = i.poNumber || `NO_PO_${i.indentNumber}`;
                const g = poGroups.get(poKey) || { first: i, firm: firmOf(i), products: [], pendingQty: 0, received: 0 };
                g.products.push(str(i.productName));
                g.pendingQty += pendingQty;
                g.received += received;
                poGroups.set(poKey, g);
            }
        });

        const doneCount = storeIns.filter(s => indentKeys.has(`${s.indentNo || s.indent_no || ''}_${firmOf(s)}`)).length;
        const groups = [...poGroups.values()];
        const firmCount = (f: string) => groups.filter(g => g.firm === f).length;
        return {
            stage: 'Lifting',
            totalPending: groups.length,
            totalComplete: doneCount,
            pendingPmpl: firmCount('PMPL'),
            pendingPurab: firmCount('PURAB'),
            pendingPmmpl: firmCount('PMMPL'),
            pendingRefrasynth: firmCount('REFRASYNTH'),
            pendingRows: groups.map(g => withFirm({
                'Timestamp': fmtDateTime(g.first.timestamp), 'PO Number': str(g.first.poNumber),
                'Approved Vendor Name': str(g.first.approvedVendorName), 'Products': g.products.join(', '),
                'PO Date': fmtDate(g.first.actual4), 'Delivery Date': fmtDate(g.first.deliveryDate),
                'Expected Date': fmtDate(g.first.expectedReqDate), 'Planned Date': fmtDate(g.first.planned5),
                'Pending Lift Qty': g.pendingQty, 'Received Qty': g.received, 'Pending PO Qty': g.pendingQty
            }, g.firm))
        };
    }

    // ---- Pending PO: mirrors PendingPo page ----
    // Indents with po_requred = 'Yes' that are not yet in PO Master (indent number == internal code).
    const pendingPoStage = (): PcReportSheet => {
        const poCodes = new Set(
            poMasters.map(r => String(r.internalCode || r.internal_code || '').trim()).filter(Boolean)
        );
        const isPoRequired = (i: any) => String(i.poRequredDb || '').trim() === 'Yes';
        const inPoMaster = (i: any) => {
            const n = String(i.indentNumber ?? '').trim();
            return !!n && poCodes.has(n);
        };
        return buildStage('Pending PO', indents,
            i => isPoRequired(i) && !inPoMaster(i),
            i => isPoRequired(i) && inPoMaster(i),
            undefined, undefined, pendingPoRow);
    };

    // ---- Make Payment: mirrors MakePayment page ----
    // Pending: payments with a planned date that are not 'completed', latest per indent+product,
    // grouped by Party + Bill No. History tab reads the payment_history table.
    const makePaymentStage = (): PcReportSheet => {
        const billByIndent = new Map<string, string>();
        storeIns.forEach(s => {
            const k = s.indentNo || s.indentNumber || '';
            if (k) billByIndent.set(k, s.billNo || '');
        });

        const seenLatest = new Set<string>();
        const groups = new Map<string, { first: any; firm: string; products: string[]; pay: number; outstanding: number }>();
        payments.forEach(p => {
            if (!has(p.planned) || String(p.status || '').toLowerCase() === 'completed') return;
            const latestKey = `${p.internalCode}-${p.product}`;
            if (seenLatest.has(latestKey)) return;
            seenLatest.add(latestKey);
            const billNo = billByIndent.get(p.internalCode || '') || '';
            const key = `${p.partyName || 'NoVendor'}-${billNo || 'NoBill'}`;
            const g = groups.get(key) || { first: p, firm: firmOf(p), products: [], pay: 0, outstanding: 0 };
            g.products.push(str(p.product));
            g.pay += num(p.payAmount);
            g.outstanding += num(p.outstandingAmount);
            groups.set(key, g);
        });

        const list = [...groups.values()];
        const firmCount = (f: string) => list.filter(g => g.firm === f).length;
        return {
            stage: 'Make Payment',
            totalPending: list.length,
            totalComplete: makePaymentHistoryCount,
            pendingPmpl: firmCount('PMPL'),
            pendingPurab: firmCount('PURAB'),
            pendingPmmpl: firmCount('PMMPL'),
            pendingRefrasynth: firmCount('REFRASYNTH'),
            pendingRows: list.map(g => withFirm({
                'Planned Date': fmtDate(g.first.planned), 'Payment No.': str(g.first.uniqueNo), 'PO Number': str(g.first.poNumber),
                'Party Name': str(g.first.partyName), 'Payment Terms': str(g.first.paymentTerms),
                'Indent No.': str(g.first.internalCode), 'Product': uniq(g.products).join(', '),
                'Total PO Amount': str(g.first.totalPoAmount), 'Pay Amount': g.pay, 'Outstanding': g.outstanding,
                'Status': str(g.first.status || 'Pending')
            }, g.firm))
        };
    };

    // ---- Audit Data: mirrors AuditData page ----
    // Each tally row belongs to one stage; the card counts the AUDIT tab (pending) and the
    // COMPLETED tab (done), both grouped by PO number like the page does.
    const auditStage = (): PcReportSheet => {
        const classify = (item: any): 'AUDIT' | 'COMPLETED' | 'OTHER' | null => {
            const isAuditDone = String(item.status1 || '').toLowerCase() === 'done';
            if (has(item.planned1) && !has(item.actual1)) return 'AUDIT';
            if (!isAuditDone && has(item.planned2) && !has(item.actual2)) return 'OTHER';
            if (!isAuditDone && has(item.planned3) && !has(item.actual3)) return 'OTHER';
            if (has(item.planned4) && !has(item.actual4)) return 'OTHER';
            if (has(item.actual4) || has(item.actual5)) return 'COMPLETED';
            return null;
        };
        const groupsOf = (stage: 'AUDIT' | 'COMPLETED') => {
            const g = new Map<string, any[]>();
            tallies.forEach(t => {
                if (classify(t) !== stage) return;
                const key = `${t.poNumber || 'NO-PO'}-${stage}`;
                const list = g.get(key);
                if (list) list.push(t);
                else g.set(key, [t]);
            });
            return [...g.values()];
        };
        const pending = groupsOf('AUDIT');
        const done = groupsOf('COMPLETED');
        const firmCount = (f: string) => pending.filter(g => firmOf(g[0]) === f).length;
        return {
            stage: 'Audit Data',
            totalPending: pending.length,
            totalComplete: done.length,
            pendingPmpl: firmCount('PMPL'),
            pendingPurab: firmCount('PURAB'),
            pendingPmmpl: firmCount('PMMPL'),
            pendingRefrasynth: firmCount('REFRASYNTH'),
            pendingRows: pending.map(g => {
                // unique bills only, like the page's "Total Bill Amt"
                const bills = new Map<string, number>();
                g.forEach(t => bills.set(str(t.billNo).trim() ? str(t.billNo).trim().toUpperCase() : `unique-${t.id}`, num(t.billAmt)));
                return withFirm({
                    'Timestamp': fmtDateTime(g[0].timestamp), 'PO Number': str(g[0].poNumber), 'Party Name': str(g[0].partyName),
                    'Product Summary': uniq(g.map(t => t.productName)).join(', '), 'Bill No.': str(g[0].billNo),
                    'Planned Date': fmtDateTime(g[0].planned1), 'Current Stage': 'Audit',
                    'Total Qty': g.reduce((s, t) => s + num(t.qty), 0),
                    'Total Bill Amt': [...bills.values()].reduce((s, v) => s + v, 0)
                }, firmOf(g[0]));
            })
        };
    };

    // Store-in stages: pending = planned set & actual empty, history = planned set & actual set
    const firstSet = (i: any, ...keys: string[]) => keys.map(k => i[k]).find(v => has(v));
    const plannedActual = (plannedKeys: string[], actualKeys: string[]) => ({
        pending: (i: any) => has(firstSet(i, ...plannedKeys)) && !has(firstSet(i, ...actualKeys)),
        done: (i: any) => has(firstSet(i, ...plannedKeys)) && has(firstSet(i, ...actualKeys))
    });
    const hod = plannedActual(['plannedHod', 'hod_planned', 'hodPlanned'], ['actualHod', 'hod_actual', 'hodActual']);
    const grn = plannedActual(['planned7', 'planned_7'], ['actual7', 'actual_7']);
    const debit = plannedActual(['planned9', 'planned_9'], ['actual9', 'actual_9']);
    const billNotReceived = plannedActual(['planned11', 'planned_11'], ['actual11', 'actual_11']);
    const inList = (i: any) => ['Three Party', 'Regular'].includes(i.vendorType || i.vendor_type);

    return [
        // IssueData page
        buildStage('Store Issue', issues,
            i => !!i.planned1 && !i.actual1,
            i => !!i.planned1 && !!i.actual1,
            undefined, undefined, issueRow),

        // ApproveIndent page
        buildStage('Department Indent Approval', indents,
            i => !!i.planned1 && !i.actual1,
            i => !!i.planned1 && !!i.actual1,
            undefined, undefined, indentApprovalRow),

        // VendorUpdate page: planned2 set & actual2 empty / both set (service turns null into empty string)
        buildStage('Vendor Rate Update', indents,
            i => has(i.planned2) && !has(i.actual2),
            i => has(i.planned2) && has(i.actual2),
            undefined, undefined, vendorUpdateRow),

        // TechnicalApproval page: Three Party / Regular; pending = not ranked yet, history = ranked
        buildStage('Department Approval', indents,
            i => inList(i) && has(i.planned3) && !has(i.actual3) && !hasRank(i),
            i => inList(i) && has(i.planned3) && hasRank(i),
            undefined, undefined, approvalRow('planned3')),

        // RateApproval page: Three Party / Regular with planned4; pending = ranked, no approved vendor
        buildStage('Management Approval', indents,
            i => inList(i) && has(i.planned4) && !hasApprovedVendor(i) && hasRank(i),
            i => inList(i) && has(i.planned4) && hasApprovedVendor(i),
            undefined, undefined, approvalRow('planned4')),

        pendingPoStage(),

        // GetLift page
        liftingStage(),

        // StoreIn page: pending grouped by vendor + bill; history = latest record per indent+product with actual6
        buildStage('Store Check', latestStoreIns,
            i => has(i.planned6 || i.planned_6) && !has(i.actual6 || i.actual_6) &&
                (billStatusOf(i) === 'Bill Received' || billStatusOf(i) === 'Not Received'),
            i => has(i.actual6 || i.actual_6),
            vendorBillKey, undefined, storeCheckRow),

        buildStage('HOD Check', storeIns, hod.pending, hod.done, undefined, undefined, hodRow),

        // FullKiting page
        buildStage('Freight Payment', freights,
            i => !!i.planned && !i.actual,
            i => !!i.planned && !!i.actual,
            undefined, undefined, freightRow),

        makePaymentStage(),

        buildStage('Reject For GRN', storeIns, grn.pending, grn.done, undefined, undefined, grnRow),

        buildStage('Send Debit Note', storeIns, debit.pending, debit.done, undefined, undefined, debitNoteRow),

        auditStage(),

        buildStage('Bill Not Received', storeIns, billNotReceived.pending, billNotReceived.done, undefined, undefined, billNotReceivedRow),

        processForPayment()
    ];
};
