import Heading from '../element/Heading';

import { useEffect, useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Pill } from '../ui/pill';
import { Store } from 'lucide-react';
import DataTable from '../element/DataTable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import { fetchInventoryRecords, type InventoryRecord } from '@/services/inventoryService';

export default () => {
    const [tableData, setTableData] = useState<InventoryRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [selectedFirm, setSelectedFirm] = useState<string>('');

    const fetchData = async () => {
        try {
            setDataLoading(true);
            const data = await fetchInventoryRecords();
            setTableData(data);
        } catch (error) {
            console.error('Error fetching inventory:', error);
        } finally {
            setDataLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Distinct firm names from fetched data
    const firmNames = useMemo(
        () => Array.from(new Set(tableData.map(r => r.firmName).filter(Boolean))).sort(),
        [tableData]
    );

    // Filtered data based on selected firm
    const filteredData = useMemo(() => {
        if (!selectedFirm || selectedFirm === '__all__') return tableData;
        return tableData.filter(r => r.firmName === selectedFirm);
    }, [tableData, selectedFirm]);

    const columns: ColumnDef<InventoryRecord>[] = [
        {
            accessorKey: 'itemName',
            header: 'Item',
            cell: ({ row }) => {
                return (
                    <div className="text-wrap max-w-40 text-center">{row.original.itemName}</div>
                );
            },
        },
        { accessorKey: 'groupHead', header: 'Group Head' },
        { accessorKey: 'firmName', header: 'Firm Name' },
        { accessorKey: 'uom', header: 'UOM' },
        {
            accessorKey: 'rate',
            header: 'Rate',
            cell: ({ row }) => {
                return <>&#8377;{row.original.rate}</>;
            },
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const code = row.original.status.toLowerCase();
                if (row.original.current === 0) {
                    return <Pill variant="reject">Out of Stock</Pill>;
                }
                if (code === 'red') {
                    return <Pill variant="pending">Low Stock</Pill>;
                }
                if (code === 'purple') {
                    return <Pill variant="primary">Excess</Pill>;
                }
                return <Pill variant="secondary">In Stock</Pill>;
            },
        },
        { accessorKey: 'indented', header: 'Indented' },
        { accessorKey: 'approved', header: 'Approved' },
        { accessorKey: 'purchaseQuantity', header: 'Purchased' },
        { accessorKey: 'outQuantity', header: 'Issued' },
        { accessorKey: 'current', header: 'Quantity' },
        {
            accessorKey: 'totalPrice',
            header: 'Total Price',
            cell: ({ row }) => {
                return <>&#8377;{row.original.totalPrice}</>;
            },
        },
    ];

    // Firm filter element — passed as extraActions so it sits right of the search bar
    const firmFilter = firmNames.length > 0 ? (
        <Select value={selectedFirm} onValueChange={setSelectedFirm}>
            <SelectTrigger className="w-48 shrink-0">
                <SelectValue placeholder="Firm Name" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="__all__">All</SelectItem>
                {firmNames.map(firm => (
                    <SelectItem key={firm} value={firm}>
                        {firm}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    ) : undefined;

    return (
        <div>
            <Heading heading="Inventory" subtext="View inventory">
                <Store size={50} className="text-primary" />
            </Heading>

            <DataTable
                data={filteredData}
                columns={columns}
                dataLoading={dataLoading}
                searchFields={['itemName', 'groupHead', 'uom', 'status']}
                className="h-[80dvh]"
                extraActions={firmFilter}
            />
        </div>
    );
};
