import Heading from '../element/Heading';
import {
    Calendar as CalendarIcon,
    ClipboardList,
    LayoutDashboard,
    PackageCheck,
    Truck,
    Warehouse,
    CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { useEffect, useState, useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { ComboBox } from '../ui/combobox';
import { fetchIndentRecords, type IndentRecord } from '@/services/indentService';
import { fetchStoreInRecords, type StoreInRecord } from '@/services/storeInService';
import { fetchIssueRecords, type IssueRecord } from '@/services/issueService';
import { fetchMasterOptions } from '@/services/masterService';
import { fetchPoMaster } from '@/services/poService';
import { fetchInventoryRecords } from '@/services/inventoryService';
import { Line, LineChart, Pie, PieChart, Cell, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts';
import { useSheets } from '@/context/SheetsContext';

interface ChartDataItem {
    name: string;
    quantity: number;
    frequency: number;
}

export default function Dashboard() {
    const {
        pcReportSheet,
        storeInSheet,
        paymentsSheet,
        allLoading: contextAllLoading
    } = useSheets();

    const [indents, setIndents] = useState<IndentRecord[]>([]);
    const [storeIns, setStoreIns] = useState<StoreInRecord[]>([]);
    const [issues, setIssues] = useState<IssueRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [topVendorsData, setTopVendors] = useState<VendorDataItem[]>([]);
    const [indent, setIndent] = useState<StatsData>({ count: 0, quantity: 0 });
    const [purchase, setPurchase] = useState<StatsData>({ count: 0, quantity: 0 });
    const [out, setOut] = useState<StatsData>({ count: 0, quantity: 0 });
    const [poTotal, setPoTotal] = useState<number>(0);
    const [poMasterData, setPoMasterData] = useState<any[]>([]);
    const [alerts, setAlerts] = useState<AlertsData>({ lowStock: 0, outOfStock: 0 });

    const [trendData, setTrendData] = useState<TrendDataItem[]>([]);
    const [deptData, setDeptData] = useState<DeptDataItem[]>([]);
    const [statusData, setStatusData] = useState<StatusDataItem[]>([]);

    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
    const [filteredDepartments, setFilteredDepartments] = useState<string[]>([]);
    const [allVendors, setAllVendors] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<string[]>([]);
    const [allDepartments, setAllDepartments] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [iData, sData, issueData, mData, poData, invData] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                    fetchIssueRecords(),
                    fetchMasterOptions(),
                    fetchPoMaster(),
                    fetchInventoryRecords()
                ]);
                setIndents(iData);
                setStoreIns(sData);
                setIssues(issueData);
                setAllVendors(mData.vendorNames);
                setAllDepartments(mData.departments);
                setPoMasterData(poData);

                // Initial total PO calculations
                const totalVal = poData.reduce((sum, p) => sum + (Number(p.totalPoAmount) || 0), 0);
                setPoTotal(totalVal);

                // Calculate stock alerts from inventory
                const low = invData.filter(i => (i.current || 0) < 5 && (i.current || 0) > 0).length;
                const outOf = invData.filter(i => (i.current || 0) <= 0).length;
                setAlerts({ lowStock: low, outOfStock: outOf });

            } catch (error) {
                console.error("Error loading dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        if (isLoading) return;

        // Get unique products from Indents

        const products = Array.from(
            new Set(
                indents
                    .filter((item) => item.product_name)
                    .map((item) => item.product_name || '')
            )
        );
        setAllProducts(products);

        // Filter data by date range, vendors, and products
        const filterByDateAndSelection = (item: IndentRecord) => {
            let valid = true;

            if (startDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate >= startDate;
            }

            if (endDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate <= endDate;
            }

            if (filteredVendors.length > 0 && item.vendor_name) {
                valid = valid && filteredVendors.includes(String(item.vendor_name));
            }

            if (filteredProducts.length > 0 && item.product_name) {
                valid = valid && filteredProducts.includes(item.product_name);
            }

            if (filteredDepartments.length > 0 && item.department) {
                valid = valid && filteredDepartments.includes(item.department);
            }

            return valid;
        };

        // Calculate Approved Indents (actual1 is filled)
        const approvedIndents = indents.filter(
            (item) => item.actual1 && filterByDateAndSelection(item)
        );
        const totalApprovedQuantity = approvedIndents.reduce(
            (sum, item) => sum + (item.approved_quantity || 0),
            0
        );
        setIndent({ count: approvedIndents.length, quantity: totalApprovedQuantity });

        // Calculate Purchases (Store In - Received items)
        const filterStoreIn = (item: StoreInRecord) => {
            let valid = true;

            // Date filtering
            if (startDate && item.timestamp) {
                const itemDate = new Date(item.timestamp);
                valid = valid && itemDate >= startDate;
            }
            if (endDate && item.timestamp) {
                const itemDate = new Date(item.timestamp);
                valid = valid && itemDate <= endDate;
            }

            if (filteredVendors.length > 0 && item.vendorName) {
                valid = valid && filteredVendors.includes(item.vendorName);
            }
            if (filteredProducts.length > 0 && item.productName) {
                valid = valid && filteredProducts.includes(item.productName);
            }
            return valid;
        };

        // Assuming Purchases = Received items (Stage 6)
        const purchases = storeIns.filter(item => item.actual6 && filterStoreIn(item));
        const totalPurchasedQuantity = purchases.reduce(
            (sum, item) => sum + (item.receivedQuantity || 0),
            0
        );
        setPurchase({ count: purchases.length, quantity: totalPurchasedQuantity });

        // Calculate Out/Issued (from Issue Records)
        // Using Issue Service for "Issued" stats
        const filterIssue = (item: IssueRecord) => {
            let valid = true;

            // Date filtering
            if (startDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate >= startDate;
            }
            if (endDate && item.actual1) {
                const itemDate = new Date(item.actual1);
                valid = valid && itemDate <= endDate;
            }

            // Issue record might not have vendor name in the same way, but has product name
            if (filteredProducts.length > 0 && item.product_name) {
                valid = valid && filteredProducts.includes(item.product_name);
            }
            return valid;
        }

        const issued = issues.filter(item => item.actual1 && filterIssue(item)); // actual1 is issue date
        const totalIssuedQuantity = issued.reduce(
            (sum, item) => sum + (item.given_qty || 0),
            0
        );
        setOut({ count: issued.length, quantity: totalIssuedQuantity });

        // Trend Data Calculation (last 7 days or date range)
        const dateRange: string[] = [];
        const today = new Date();
        const start = startDate || new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const end = endDate || today;

        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dateRange.push(format(new Date(d), 'yyyy-MM-dd'));
        }

        const trendMap: Record<string, TrendDataItem> = {};
        dateRange.forEach(d => {
            trendMap[d] = { date: format(new Date(d), 'MMM dd'), indents: 0, purchases: 0, issues: 0 };
        });

        indents.forEach(i => {
            if (i.timestamp) {
                const d = format(new Date(i.timestamp), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].indents += 1;
            }
        });

        // Calculate Top Vendors (based on PO Master for better volume representation)
        const vendorMap: Record<string, { orders: number; quantity: number }> = {};

        // Use PO Master for volume if available, or stay with Store In if preferred. 
        // Let's use PO totals for "Volume".
        poMasterData.forEach((item) => {
            const vendorName = String(item.partyName || '');
            if (vendorName) {
                if (!vendorMap[vendorName]) {
                    vendorMap[vendorName] = { orders: 0, quantity: 0 };
                }
                vendorMap[vendorName].orders += 1;
                vendorMap[vendorName].quantity += Number(item.totalPoAmount || 0);
            }
        });

        const topVendors = Object.entries(vendorMap)
            .map(([name, data]) => ({
                name,
                orders: data.orders,
                quantity: data.quantity, // This is now total amount
            }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);

        setTopVendors(topVendors);

        storeIns.forEach(s => {
            if (s.timestamp) {
                const d = format(new Date(s.timestamp), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].purchases += 1;
            }
        });

        issues.forEach(iss => {
            if (iss.actual1) {
                const d = format(new Date(iss.actual1), 'yyyy-MM-dd');
                if (trendMap[d]) trendMap[d].issues += 1;
            }
        });

        setTrendData(Object.values(trendMap));

        // Department Breakdown
        const deptMap: Record<string, number> = {};
        indents.forEach(i => {
            const dept = i.department || 'Unknown';
            deptMap[dept] = (deptMap[dept] || 0) + 1;
        });
        setDeptData(Object.entries(deptMap).map(([name, value]) => ({ name, value })));

        // Status Breakdown
        const statusMap: Record<string, number> = {
            'Pending Approval': indents.filter(i => !i.actual1).length,
            'Vendor Assigned': indents.filter(i => i.actual1 && !i.actual2).length,
            'PO Created': indents.filter(i => i.actual4).length,
            'Material Received': storeIns.filter(s => s.actual6).length,
            'HOD Check': storeIns.filter(s => s.plannedHod && !s.actualHod).length,
        };
        setStatusData(Object.entries(statusMap).map(([name, value]) => ({ name, value })));

    }, [startDate, endDate, filteredProducts, filteredVendors, indents, storeIns, issues, isLoading]);

    const partyPendingMaterial = useMemo<PartyMaterialItem[]>(() => {
        const map: Record<string, PartyMaterialItem> = {};
        storeInSheet.forEach(item => {
            const vendor = item.vendorName || 'Unknown';
            if (!map[vendor]) map[vendor] = { name: vendor, totalLifts: 0, pendingLifts: 0, pendingQty: 0, pendingBillAmt: 0 };
            map[vendor].totalLifts++;
            if (!item.actual6) {
                map[vendor].pendingLifts++;
                map[vendor].pendingQty += Number(item.qty || 0);
                map[vendor].pendingBillAmt += Number(item.billAmount || 0);
            }
        });
        return Object.values(map)
            .filter(v => v.pendingLifts > 0)
            .sort((a, b) => b.pendingLifts - a.pendingLifts);
    }, [storeInSheet]);

    const partyPaymentStatus = useMemo<PartyPaymentItem[]>(() => {
        const map: Record<string, PartyPaymentItem> = {};
        paymentsSheet.forEach(item => {
            const party = item.partyName || 'Unknown';
            if (!map[party]) map[party] = { name: party, totalAmount: 0, paidAmount: 0, pendingAmount: 0, poCount: 0 };
            map[party].totalAmount += Number(item.totalPoAmount || 0);
            map[party].paidAmount += Number(item.totalPaidAmount || 0);
            map[party].pendingAmount += Number(item.outstandingAmount || 0);
            map[party].poCount++;
        });
        return Object.values(map).sort((a, b) => b.pendingAmount - a.pendingAmount);
    }, [paymentsSheet]);

    const monthlyCostData = useMemo<MonthlyCostItem[]>(() => {
        const map: Record<string, number> = {};
        storeInSheet.forEach(item => {
            const d = item.actual6 || item.timestamp;
            if (!d || !item.billAmount) return;
            try {
                const month = format(new Date(d), 'yyyy-MM');
                map[month] = (map[month] || 0) + Number(item.billAmount || 0);
            } catch { /* invalid date */ }
        });
        return Object.entries(map)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-6)
            .map(([month, amount]) => ({
                month: format(new Date(month + '-01'), 'MMM yy'),
                amount
            }));
    }, [storeInSheet]);

    // --- Business Overview KPIs (from context) ---
    const businessKPIs = useMemo(() => {
        const now = new Date();
        const currentMonth = format(now, 'yyyy-MM');

        const totalOutstanding = paymentsSheet.reduce((s, p) => s + Number(p.outstandingAmount || 0), 0);
        const totalPaid = paymentsSheet.reduce((s, p) => s + Number(p.totalPaidAmount || 0), 0);
        const totalPO = paymentsSheet.reduce((s, p) => s + Number(p.totalPoAmount || 0), 0);

        const pendingToReceive = storeInSheet.filter(s => !s.actual6).length;
        const receivedThisMonth = storeInSheet.filter(s => {
            if (!s.actual6) return false;
            try { return format(new Date(s.actual6), 'yyyy-MM') === currentMonth; } catch { return false; }
        }).length;

        const thisMonthCost = storeInSheet.reduce((sum, s) => {
            if (!s.actual6 || !s.billAmount) return sum;
            try {
                return format(new Date(s.actual6), 'yyyy-MM') === currentMonth
                    ? sum + Number(s.billAmount)
                    : sum;
            } catch { return sum; }
        }, 0);

        const vendorSet = new Set(paymentsSheet.map(p => p.partyName).filter(Boolean));
        const vendorsDue = paymentsSheet.filter(p => Number(p.outstandingAmount || 0) > 0);
        const uniqueVendorsDue = new Set(vendorsDue.map(p => p.partyName)).size;

        return { totalOutstanding, totalPaid, totalPO, pendingToReceive, receivedThisMonth, thisMonthCost, totalVendors: vendorSet.size, uniqueVendorsDue };
    }, [paymentsSheet, storeInSheet]);

    // --- Recent Activity (last 5 store-ins received) ---
    const recentActivity = useMemo(() => {
        return storeInSheet
            .filter(s => s.actual6)
            .sort((a, b) => {
                try { return new Date(b.actual6).getTime() - new Date(a.actual6).getTime(); } catch { return 0; }
            })
            .slice(0, 5)
            .map(s => ({
                vendor: s.vendorName,
                product: s.productName,
                qty: s.qty,
                amount: s.billAmount,
                date: s.actual6,
            }));
    }, [storeInSheet]);

    const chartConfig = {
        quantity: {
            label: 'Quantity',
            color: 'var(--color-primary)',
        },
    } satisfies ChartConfig;

    return (
        <div>
            <Heading heading="Dashboard" subtext="View your analytics">
                <LayoutDashboard size={50} className="text-primary" />
            </Heading>

            <div className="grid gap-3 m-3">
                <div className="gap-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!startDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? (
                                    format(startDate, 'PPP')
                                ) : (
                                    <span>Pick a start date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                data-empty={!endDate}
                                className="data-[empty=true]:text-muted-foreground w-full min-w-0 justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, 'PPP') : <span>Pick an end date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
                        </PopoverContent>
                    </Popover>
                    <ComboBox
                        multiple
                        options={allVendors.map((v) => ({ label: v, value: v }))}
                        value={filteredVendors}
                        onChange={setFilteredVendors}
                        placeholder="Select Vendors"
                    />
                    <ComboBox
                        multiple
                        options={allProducts.map((v) => ({ label: v, value: v }))}
                        value={filteredProducts}
                        onChange={setFilteredProducts}
                        placeholder="Select Products"
                    />
                    <ComboBox
                        multiple
                        options={allDepartments.map((v) => ({ label: v, value: v }))}
                        value={filteredDepartments}
                        onChange={setFilteredDepartments}
                        placeholder="Select Departments"
                    />
                </div>

                {/* ── Business Snapshot Banner ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    {[
                        { label: 'Total PO Value', value: formatMoney(businessKPIs.totalPO), sub: `${businessKPIs.totalVendors} vendors`, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
                        { label: 'Amount Paid', value: formatMoney(businessKPIs.totalPaid), sub: 'All time', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                        { label: 'Outstanding Due', value: formatMoney(businessKPIs.totalOutstanding), sub: `${businessKPIs.uniqueVendorsDue} vendors due`, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
                        { label: 'Pending to Receive', value: String(businessKPIs.pendingToReceive), sub: 'lifts pending', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
                        { label: 'Received This Month', value: String(businessKPIs.receivedThisMonth), sub: 'lifts received', color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
                        { label: 'This Month Cost', value: formatMoney(businessKPIs.thisMonthCost), sub: 'procurement spend', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
                        { label: 'Indents Approved', value: String(indent.count), sub: `qty: ${indent.quantity}`, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
                        { label: 'Items Received', value: String(purchase.count), sub: `qty: ${purchase.quantity}`, color: 'text-teal-600', bg: 'bg-teal-50 border-teal-200' },
                    ].map(({ label, value, sub, color, bg }) => (
                        <div key={label} className={`rounded-xl border p-3 ${bg}`}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
                            <p className={`text-xl font-black ${color} leading-tight`}>{value}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
                        </div>
                    ))}
                </div>

                <div className="grid md:grid-cols-4 gap-3 lg:grid-cols-5">
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/20 border-blue-200">
                        <CardContent className="pt-6">
                            <div className="text-blue-600 flex justify-between">
                                <p className="font-semibold">Procurement Indents</p>
                                <ClipboardList size={22} />
                            </div>
                            <p className="text-4xl font-black text-blue-900 mt-2">{indent.count}</p>
                            <div className="text-blue-600 flex justify-between mt-2 border-t border-blue-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Quantity</p>
                                <p className="font-bold">{indent.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 border-indigo-200">
                        <CardContent className="pt-6">
                            <div className="text-indigo-600 flex justify-between">
                                <p className="font-semibold">Total PO Value</p>
                                <CreditCard size={22} className="text-indigo-600" />
                            </div>
                            <p className="text-4xl font-black text-indigo-900 mt-2 text-ellipsis overflow-hidden">
                                ₹{poTotal > 100000 ? (poTotal / 100000).toFixed(2) + 'L' : poTotal.toLocaleString()}
                            </p>
                            <div className="text-indigo-600 flex justify-between mt-2 border-t border-indigo-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Avg/PO</p>
                                <p className="font-bold">₹{indent.count > 0 ? (poTotal / indent.count).toFixed(0) : 0}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/20 border-green-200">
                        <CardContent className="pt-6">
                            <div className="text-green-600 flex justify-between">
                                <p className="font-semibold">Items Received</p>
                                <Truck size={22} />
                            </div>
                            <p className="text-4xl font-black text-green-900 mt-2">{purchase.count}</p>
                            <div className="text-green-600 flex justify-between mt-2 border-t border-green-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Total Qty</p>
                                <p className="font-bold">{purchase.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/20 border-orange-200">
                        <CardContent className="pt-6">
                            <div className="text-orange-600 flex justify-between">
                                <p className="font-semibold">Stock Issued</p>
                                <PackageCheck size={22} />
                            </div>
                            <p className="text-4xl font-black text-orange-900 mt-2">{out.count}</p>
                            <div className="text-orange-600 flex justify-between mt-2 border-t border-orange-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Issue Qty</p>
                                <p className="font-bold">{out.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-red-500/10 to-red-600/20 border-red-200 text-red-600 md:col-span-4 lg:col-span-1">
                        <CardContent className="pt-6">
                            <div className="flex justify-between">
                                <p className="font-semibold">Stock Alerts</p>
                                <Warehouse size={22} />
                            </div>
                            <p className="text-4xl font-black text-red-900 mt-2">
                                {alerts.outOfStock}
                            </p>
                            <div className="text-red-600 flex justify-between mt-2 border-t border-red-200 pt-2">
                                <p className="text-xs font-medium uppercase tracking-wider">Low Stock</p>
                                <p className="font-bold">{alerts.lowStock}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-xl">Procurement & Outflow Trends</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={trendData}>
                                    <defs>
                                        <linearGradient id="colorIndents" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorPurchases" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={10} />
                                    <YAxis axisLine={false} tickLine={false} tickMargin={10} />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="indents" stroke="#3b82f6" fillOpacity={1} fill="url(#colorIndents)" strokeWidth={3} name="Indents" />
                                    <Area type="monotone" dataKey="purchases" stroke="#10b981" fillOpacity={1} fill="url(#colorPurchases)" strokeWidth={3} name="Purchases" />
                                    <Area type="monotone" dataKey="issues" stroke="#f97316" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" name="Stock Issued" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">Departmental Indenting</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[300px] flex flex-col justify-center items-center">
                            <ResponsiveContainer width="100%" height="80%">
                                <PieChart>
                                    <Pie
                                        data={deptData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {deptData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#f97316'][index % 6]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full text-xs mt-2 overflow-y-auto max-h-20">
                                {deptData.map((d, i) => (
                                    <div key={i} className="flex items-center gap-1">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1', '#ec4899', '#f97316'][i % 6] }}></div>
                                        <span className="truncate">{d.name} ({d.value})</span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle className="text-xl">Workflow Status Distribution</CardTitle>
                        </CardHeader>
                        <CardContent className="h-[250px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={statusData} layout="vertical">
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                                    <Tooltip cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                                        <LabelList dataKey="value" position="right" style={{ fontSize: '10px' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    <Card className="lg:col-span-2">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-xl">Top Vendors by Volume</CardTitle>
                            <Button variant="ghost" size="sm" className="text-xs text-blue-600">View All Vendors</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {topVendorsData.length > 0 ? (
                                    topVendorsData.map((vendor, i) => (
                                        <div key={i} className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs mr-3">
                                                {i + 1}
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm font-semibold text-slate-700 leading-none">{vendor.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{vendor.orders} Orders processed</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-slate-900">
                                                    ₹{vendor.quantity > 100000 ? (vendor.quantity / 100000).toFixed(1) + 'L' : vendor.quantity.toLocaleString()}
                                                </p>
                                                <p className="text-[10px] text-slate-400 uppercase font-medium">Value</p>
                                            </div>
                                            <div className="ml-4 w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500"
                                                    style={{ width: `${(vendor.quantity / topVendorsData[0].quantity) * 100}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-muted-foreground py-10 italic">
                                        No vendor performance data available
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xl">Recent Material Received</CardTitle>
                            <p className="text-sm text-muted-foreground">Last 5 store-in entries received</p>
                        </CardHeader>
                        <CardContent>
                            {recentActivity.length === 0 ? (
                                <p className="text-center text-muted-foreground py-6 italic">No recent activity</p>
                            ) : (
                                <div className="space-y-2">
                                    {recentActivity.map((r, i) => (
                                        <div key={i} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/30">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-sm truncate">{r.product || '—'}</p>
                                                <p className="text-xs text-muted-foreground truncate">{r.vendor}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-bold text-primary">Qty: {r.qty}</p>
                                                {r.amount ? <p className="text-xs text-muted-foreground">{formatMoney(Number(r.amount))}</p> : null}
                                            </div>
                                            <div className="text-right shrink-0 text-[10px] text-muted-foreground w-20">
                                                {r.date ? (() => { try { return format(new Date(r.date), 'dd MMM yy'); } catch { return '—'; } })() : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xl">Payment Health</CardTitle>
                            <p className="text-sm text-muted-foreground">Overall payment collection status</p>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-4">
                            <div className="text-center py-2">
                                <p className="text-4xl font-black text-primary">
                                    {businessKPIs.totalPO > 0 ? Math.round((businessKPIs.totalPaid / businessKPIs.totalPO) * 100) : 0}%
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">Payment Completion</p>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full" style={{ width: `${businessKPIs.totalPO > 0 ? Math.min((businessKPIs.totalPaid / businessKPIs.totalPO) * 100, 100) : 0}%` }} />
                            </div>
                            <div className="grid grid-cols-1 gap-2 text-sm">
                                <div className="flex justify-between p-2 rounded-lg bg-primary/5 border border-primary/20">
                                    <span className="text-muted-foreground">Total PO Value</span>
                                    <span className="font-bold text-primary">{formatMoney(businessKPIs.totalPO)}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded-lg bg-green-50 border border-green-200">
                                    <span className="text-muted-foreground">Paid</span>
                                    <span className="font-bold text-green-600">{formatMoney(businessKPIs.totalPaid)}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded-lg bg-red-50 border border-red-200">
                                    <span className="text-muted-foreground">Outstanding</span>
                                    <span className="font-bold text-red-600">{formatMoney(businessKPIs.totalOutstanding)}</span>
                                </div>
                                <div className="flex justify-between p-2 rounded-lg bg-orange-50 border border-orange-200">
                                    <span className="text-muted-foreground">Vendors Due</span>
                                    <span className="font-bold text-orange-600">{businessKPIs.uniqueVendorsDue}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* PC Reports Section */}
                <div className="grid grid-cols-1 gap-3">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-xl">PC Report Stage Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                                {pcReportSheet.map((pc, i) => (
                                    <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 mb-1 truncate" title={pc.stage}>
                                            {pc.stage}
                                        </p>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-xl font-black text-slate-800">{pc.totalPending}</p>
                                                <p className="text-[9px] text-red-500 font-medium">Pending</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-green-600">{pc.totalComplete}</p>
                                                <p className="text-[9px] text-green-500 font-medium">Done</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Party-wise Pending Material & Payment Status */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <Truck size={20} className="text-primary shrink-0" />
                                Party-wise Pending Material
                            </CardTitle>
                            <p className="text-sm text-muted-foreground"></p>
                        </CardHeader>
                        <CardContent>
                            {partyPendingMaterial.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10 italic">Koi pending material nahi hai</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar-thin pr-1">
                                    {partyPendingMaterial.map((p, i) => (
                                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-100">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm truncate">{p.name}</p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {p.pendingLifts} lifts pending / {p.totalLifts} total
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 ml-3">
                                                <p className="font-bold text-orange-600">{p.pendingQty} units</p>
                                                <p className="text-xs text-muted-foreground">{formatMoney(p.pendingBillAmt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <CreditCard size={20} className="text-primary shrink-0" />
                                Payment Status by Party
                            </CardTitle>
                            <p className="text-sm text-muted-foreground"></p>
                        </CardHeader>
                        <CardContent>
                            {partyPaymentStatus.length === 0 ? (
                                <p className="text-center text-muted-foreground py-10 italic">No Data</p>
                            ) : (
                                <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar-thin pr-1">
                                    {partyPaymentStatus.map((p, i) => (
                                        <div key={i} className="p-3 rounded-lg border">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <p className="font-semibold text-sm truncate flex-1">{p.name}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ml-2 shrink-0 ${p.pendingAmount > 0 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                                                    {p.pendingAmount > 0 ? 'Due' : 'Cleared'}
                                                </span>
                                            </div>
                                            <div className="flex gap-4 text-xs mb-2 flex-wrap">
                                                <span className="text-muted-foreground">Total: <span className="font-bold text-foreground">{formatMoney(p.totalAmount)}</span></span>
                                                <span className="text-green-600">Paid: <span className="font-bold">{formatMoney(p.paidAmount)}</span></span>
                                                <span className="text-red-600">Due: <span className="font-bold">{formatMoney(p.pendingAmount)}</span></span>
                                            </div>
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-green-500 rounded-full transition-all"
                                                    style={{ width: `${p.totalAmount > 0 ? Math.min((p.paidAmount / p.totalAmount) * 100, 100) : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Monthly Procurement Cost */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-xl">
                            Monthly Procurement Cost
                            <span className="text-sm font-normal text-muted-foreground ml-2">(Last 6 months)</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Har month kitna purchase hua</p>
                    </CardHeader>
                    <CardContent className="h-[270px]">
                        {monthlyCostData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground italic">Cost data available nahi hai</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyCostData} margin={{ top: 24, right: 16, left: 8, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={v => formatMoney(Number(v))} width={65} />
                                    <Tooltip formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Procurement Cost']} />
                                    <Bar dataKey="amount" fill="var(--color-primary)" radius={[4, 4, 0, 0]}>
                                        <LabelList
                                            dataKey="amount"
                                            position="top"
                                            formatter={(v: any) => formatMoney(Number(v))}
                                            style={{ fontSize: '10px', fill: 'var(--color-foreground)' }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// Interfaces needed to keep the file valid
interface VendorDataItem {
    name: string;
    orders: number;
    quantity: number;
}

interface StatsData {
    count: number;
    quantity: number;
}

interface AlertsData {
    lowStock: number;
    outOfStock: number;
}

interface TrendDataItem {
    date: string;
    indents: number;
    purchases: number;
    issues: number;
}

interface DeptDataItem {
    name: string;
    value: number;
}

interface StatusDataItem {
    name: string;
    value: number;
}

interface PartyMaterialItem {
    name: string;
    totalLifts: number;
    pendingLifts: number;
    pendingQty: number;
    pendingBillAmt: number;
}

interface PartyPaymentItem {
    name: string;
    totalAmount: number;
    paidAmount: number;
    pendingAmount: number;
    poCount: number;
}

interface MonthlyCostItem {
    month: string;
    amount: number;
}

function formatMoney(amount: number): string {
    if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(1) + 'Cr';
    if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
    if (amount >= 1000) return '₹' + (amount / 1000).toFixed(0) + 'k';
    return '₹' + amount.toLocaleString();
}