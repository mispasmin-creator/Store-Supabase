import { supabase } from '@/lib/supabase';

/**
 * GetLift Service
 * Handles all Supabase operations for the GetLift component
 * Manages purchase lifting, bill status updates, and store-in records
 */

// ==================== INTERFACES ====================

export interface GetLiftIndentRecord {
    indentNumber: string;
    firmNameMatch: string;
    approvedVendorName: string;
    poNumber: string;
    actual4: string;
    deliveryDate: string;
    planned5: string;
    actual5: string;
    productName: string;
    totalQty: number;
    quantity: number;
    pendingQty: number;
    liftingStatus: string;
    cancelQty: number;
    approvedRate: string;
    taxValue: number;
    withTax: string;
    timestamp: string;
    expectedDate: string;
    department?: string;
    areaOfUse?: string;
    approvedQuantity: number;
    receivedQuantity: number;
    uom: string;
}

export interface GetLiftStoreInRecord {
    liftNumber: string;
    indentNo: string;
    firmNameMatch: string;
    vendorName: string;
    receivedQuantity: number;
    qty: number;
    photoOfBill: string;
    timestamp: string;
    billNo?: string;
    typeOfBill?: string;
    billAmount?: number;
    transportationInclude?: string;
    transporterName?: string;
    vehicleNo?: string;
    driverName?: string;
    driverMobileNo?: string;
    amount?: number;
    billRemark?: string;
    billStatus?: string;
}

export interface VendorOption {
    vendorName: string;
}

export interface StoreInInsertData {
    timestamp: string;
    liftNumber?: string;
    indentNo: string;
    billNo: string;
    vendorName: string;
    productName: string;
    qty: number;
    leadTimeToLiftMaterial?: number;
    discountAmount: number;
    typeOfBill: string;
    billAmount: number;
    paymentType: string;
    advanceAmountIfAny: number;
    photoOfBill: string;
    transportationInclude: string;
    transporterName: string;
    amount: number;
    billStatus: string;
    quantityAsPerBill: number;
    poDate: string;
    poNumber: string;
    vendor: string;
    indentNumber: string;
    product: string;
    quantity: number;
    vehicleNo: string;
    driverName: string;
    driverMobileNo: string;
    billRemark: string;
    firmNameMatch: string;
    rate: string;
    department?: string;
    areaOfUse?: string;
    approvedVendorName?: string;
    liftingStatus?: string;
    notBillReceivedNo?: string;
}

// ==================== FETCH FUNCTIONS ====================

/**
 * Fetch all indent records from Supabase
 * Used for displaying pending and completed lift records
 */
export async function fetchIndentRecords() {
    try {
        const { data, error } = await supabase
            .from('indent')
            .select('*')
            .order('indent_number', { ascending: false });

        if (error) throw error;
        console.log("fetchIndentRecords", data);
        return (data || []).map((r: any) => ({
            indentNumber: r.indent_number || '',
            firmNameMatch: r.firm_name_match || '',
            approvedVendorName: r.approved_vendor_name || '',
            poNumber: r.po_number || '',
            actual4: r.actual4 || '',
            deliveryDate: r.delivery_date || '',
            planned5: r.planned5 || '',
            actual5: r.actual5 || '',
            productName: r.product_name || '',
            totalQty: Number(r.total_qty) || 0,
            quantity: Number(r.quantity) || 0,
            pendingQty: Number(r.pending_qty) || 0,
            liftingStatus: r.lifting_status || '',
            cancelQty: Number(r.cancel_qty) || 0,
            approvedRate: r.approved_rate || '',
            taxValue: Number(r.tax_value4) || 0,
            withTax: r.with_tax_or_not4 || 'No',
            department: r.department || '',
            areaOfUse: r.area_of_use || '',
            timestamp: r.timestamp || '',
            expectedDate: r.expected_req_date || '',
            // Priority: pending_po_qty > approved_quantity > quantity (matches poService.fetchIndents)
            approvedQuantity: (() => {
                const rawPending = Number(r.pending_po_qty) || 0;
                const rawApproved = Number(r.approved_quantity) || 0;
                const rawQuantity = Number(r.quantity) || 0;
                return rawPending > 0 ? rawPending : (rawApproved > 0 ? rawApproved : rawQuantity);
            })(),
            receivedQuantity: Number(r.received_quantity) || 0,
            uom: r.uom || '',
        }));
    } catch (error) {
        console.error('Error fetching indent records:', error);
        throw error;
    }
}

/**
 * Fetch all store-in records from Supabase
 * Used for calculating received quantities and history
 */
export async function fetchStoreInRecords() {
    try {
        const { data, error } = await supabase
            .from('store_in')
            .select('*')
            .order('timestamp', { ascending: false });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            liftNumber: r.lift_number || '',
            indentNo: r.indent_no || '',
            firmNameMatch: r.firm_name_match || '',
            vendorName: r.vendor_name || '',
            qty: Number(r.qty) || 0,
            receivedQuantity: Number(r.received_quantity) || 0,
            photoOfBill: r.photo_of_bill || '',
            timestamp: r.timestamp || '',
            billNo: r.bill_no || '',
            typeOfBill: r.type_of_bill || '',
            billAmount: Number(r.bill_amount) || 0,
            transportationInclude: r.transportation_include || '',
            transporterName: r.transporter_name || '',
            vehicleNo: r.vehicle_no || '',
            driverName: r.driver_name || '',
            driverMobileNo: r.driver_mobile_no || '',
            amount: Number(r.amount) || 0,
            billRemark: r.bill_remark || '',
            billStatus: r.bill_status || '',
        }));
    } catch (error) {
        console.error('Error fetching store-in records:', error);
        throw error;
    }
}

/**
 * Fetch vendor options from master table
 * Used for populating vendor dropdown
 */
// Update the service function (in getLiftService or create a new one)
export const fetchVendorOptions = async (): Promise<string[]> => {
    try {
        const { data, error } = await supabase
            .from('master')
            .select('vendor_name')
            .not('vendor_name', 'is', null)
            .order('vendor_name');

        if (error) throw error;

        // Filter out null/undefined/empty values and remove duplicates
        const vendorNames = data
            .map(item => item.vendor_name?.trim())
            .filter((name): name is string => !!name && name.length > 0);

        return [...new Set(vendorNames)]; // Remove duplicates
    } catch (error) {
        console.error('Error fetching vendors:', error);
        throw error;
    }
};

// ==================== INSERT/UPDATE FUNCTIONS ====================

/**
 * Insert a new store-in record
 * @param storeInData - Store-in record data
 */
export async function insertStoreInRecord(storeInData: StoreInInsertData) {
    try {
        const toNumStr = (val: any): string | null => {
            if (val === undefined || val === null || val === '') return null;
            const str = String(val).replace(/[^0-9.-]/g, '').trim();
            return str === '' || isNaN(Number(str)) ? null : str;
        };

        const sanitizeIndentNo = (str?: string): string => {
            if (!str) return '';
            return str.trim();
        };

        const rateVal = parseFloat(String(storeInData.rate || '').replace(/[^0-9.-]/g, '')) || 0;
        const qtyVal = Number(storeInData.qty || 0) || 0;
        const totalRateVal = rateVal * qtyVal;

        const mappedData: Record<string, any> = {
            timestamp: storeInData.timestamp,
            indent_no: sanitizeIndentNo(storeInData.indentNo),
            bill_no: storeInData.billNo || '',
            vendor_name: storeInData.vendorName || '',
            product_name: storeInData.productName || '',
            qty: qtyVal.toString(),
            lead_time_to_lift_material: toNumStr(storeInData.leadTimeToLiftMaterial),
            discount_amount: toNumStr(storeInData.discountAmount) || '0',
            type_of_bill: storeInData.typeOfBill || '',
            bill_amount: toNumStr(storeInData.billAmount) || '0',
            payment_type: storeInData.paymentType || '',
            advance_amount_if_any: toNumStr(storeInData.advanceAmountIfAny) || '0',
            photo_of_bill: storeInData.photoOfBill || '',
            transportation_include: storeInData.transportationInclude || '',
            transporter_name: storeInData.transporterName || '',
            amount: toNumStr(storeInData.amount) || '0',
            bill_status: storeInData.billStatus || '',
            received_quantity: '0',
            quantity_as_per_bill: toNumStr(storeInData.quantityAsPerBill) || qtyVal.toString(),
            po_number: storeInData.poNumber || '',
            vehicle_no: storeInData.vehicleNo || '',
            driver_name: storeInData.driverName || '',
            driver_mobile_no: storeInData.driverMobileNo || '',
            bill_remark: storeInData.billRemark || '',
            firm_name_match: storeInData.firmNameMatch || '',
            rate: toNumStr(storeInData.rate),
            planned6: null,
            actual6: null,
            time_delay6: '',
            send_debit_note: '',
            receiving_status: '',
            photo_of_product: '',
            damage_order: '',
            remark: '',
            planned7: null,
            actual7: null,
            time_delay7: '',
            status: '',
            reason: '',
            planned9: null,
            actual9: null,
            time_delay9: '',
            debit_note_copy: '',
            debit_note_number: '',
            planned11: null,
            actual11: null,
            bill_status_new: '',
            bill_image_status: '',
            indent_date: storeInData.indentNo ? new Date().toISOString() : null,
            indent_qty: toNumStr(storeInData.quantity),
            purchase_date: new Date().toISOString(),
            material_date: new Date().toISOString(),
            party_name: storeInData.vendorName || '',
            indented_for: storeInData.department || '',
            area: storeInData.areaOfUse || '',
            approved_party_name: storeInData.approvedVendorName || storeInData.vendorName || '',
            total_rate: totalRateVal > 0 ? totalRateVal.toString() : null,
            lifting_status: storeInData.liftingStatus || 'Active',
            not_bill_received_no: storeInData.notBillReceivedNo || '',
        };

        // Clean out any undefined fields
        Object.keys(mappedData).forEach(key => {
            if (mappedData[key] === undefined) {
                delete mappedData[key];
            }
        });

        console.log('📤 Inserting store-in record:', mappedData);

        const { data, error } = await supabase
            .from('store_in')
            .insert([mappedData])
            .select();

        if (error) {
            console.error('❌ Supabase insert error:', error);
            // Retry with core clean fields if schema column issue occurs
            const coreData: Record<string, any> = {
                timestamp: mappedData.timestamp,
                indent_no: mappedData.indent_no,
                bill_no: mappedData.bill_no,
                vendor_name: mappedData.vendor_name,
                product_name: mappedData.product_name,
                qty: mappedData.qty,
                bill_amount: mappedData.bill_amount,
                photo_of_bill: mappedData.photo_of_bill,
                transportation_include: mappedData.transportation_include,
                transporter_name: mappedData.transporter_name,
                amount: mappedData.amount,
                bill_status: mappedData.bill_status,
                received_quantity: mappedData.received_quantity,
                quantity_as_per_bill: mappedData.quantity_as_per_bill,
                po_number: mappedData.po_number,
                vehicle_no: mappedData.vehicle_no,
                driver_name: mappedData.driver_name,
                driver_mobile_no: mappedData.driver_mobile_no,
                bill_remark: mappedData.bill_remark,
                firm_name_match: mappedData.firm_name_match,
                rate: mappedData.rate,
                not_bill_received_no: mappedData.not_bill_received_no,
            };

            const { data: retryData, error: retryError } = await supabase
                .from('store_in')
                .insert([coreData])
                .select();

            if (retryError) throw retryError;
            return retryData;
        }

        console.log('✅ Store-in record inserted:', data);
        return data;
    } catch (error) {
        console.error('Error inserting store-in record:', error);
        throw error;
    }
}

/**
 * Update actual5 timestamp for an indent (Material Receipt Date)
 * Called when purchase details form is updated
 * @param indentNumber - Indent number to update
 */
export async function updateActual5Timestamp(indentNumber: string) {
    try {
        const currentDateTime = new Date().toISOString();

        const { error } = await supabase
            .from('indent')
            .update({ actual5: currentDateTime })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        console.log(`✅ Updated actual5 for indent ${indentNumber}: ${currentDateTime}`);
        return true;
    } catch (error) {
        console.error('Error updating actual5 timestamp:', error);
        throw error;
    }
}

/**
 * Update cancel quantity for an indent
 * @param indentNumber - Indent number to update
 * @param cancelQty - Quantity to cancel
 */
export async function updateCancelQuantity(indentNumber: string, cancelQty: number) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ cancel_qty: cancelQty })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating cancel quantity:', error);
        throw error;
    }
}

export async function updateLiftingStatus(indentNumber: string, status: string) {
    try {
        const { error } = await supabase
            .from('indent')
            .update({ lifting_status: status })
            .eq('indent_number', indentNumber);

        if (error) throw error;

        return true;
    } catch (error) {
        console.error('Error updating lifting status:', error);
        throw error;
    }
}

// ==================== FILE UPLOAD ====================

/**
 * Upload bill photo/document to Supabase Storage
 * @param file - File to upload
 * @param indentNumber - Indent number for file naming
 */
export async function uploadBillPhoto(file: File, indentNumber: string): Promise<string> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${indentNumber}_bill_${Date.now()}.${fileExt}`;
        const filePath = `bill-photos/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('photo_of_bill')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
            .from('photo_of_bill')
            .getPublicUrl(filePath);

        return publicUrl;
    } catch (error) {
        console.error('Bill photo upload error:', error);
        throw error;
    }
}
