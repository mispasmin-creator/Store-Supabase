import { supabase } from '@/lib/supabase';

/**
 * Inventory Service
 * Handles all Supabase operations for the Inventory component
 */

export interface InventoryRecord {
    itemName: string;
    groupHead: string;
    uom: string;
    opening: number;
    rate: number;
    indented: number;
    approved: number;
    purchaseQuantity: number;
    outQuantity: number;
    current: number;
    totalPrice: number;
    status: string;
}

/**
 * Fetch all inventory records from Supabase
 */
export async function fetchInventoryRecords(): Promise<InventoryRecord[]> {
    try {
        const { data, error } = await supabase
            .from('inventory')
            .select('*')
            .order('item_name', { ascending: true });

        if (error) throw error;

        return (data || []).map((r: any) => ({
            itemName: r.item_name || '',
            groupHead: r.group_head || '',
            uom: r.uom || '',
            opening: Number(r.opening) || 0,
            rate: Number(r.rate) || 0,
            indented: Number(r.indented) || 0,
            approved: Number(r.approved) || 0,
            purchaseQuantity: Number(r.purchase_quantity) || 0,
            outQuantity: Number(r.out_quantity) || 0,
            current: Number(r.current) || 0,
            totalPrice: Number(r.total_price) || 0,
            status: r.status || r.color_code || '',
        }));
    } catch (error) {
        console.error('Error fetching inventory records:', error);
        throw error;
    }
}
