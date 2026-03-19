import Heading from '../element/Heading';
import {
    Calendar as CalendarIcon,
    ClipboardList,
    LayoutDashboard,
    PackageCheck,
    Truck,
    Warehouse,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ChartContainer, ChartTooltip, type ChartConfig } from '../ui/chart';
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from 'recharts';
import { useEffect, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { format } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { ComboBox } from '../ui/combobox';
import { fetchIndentRecords, type IndentRecord } from '@/services/indentService';
import { fetchStoreInRecords, type StoreInRecord } from '@/services/storeInService';
import { fetchIssueRecords, type IssueRecord } from '@/services/issueService';
import { fetchMasterOptions } from '@/services/masterService';

interface ChartDataItem {
    name: string;
    quantity: number;
    frequency: number;
}

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

function CustomChartTooltipContent({
    payload,
    label,
}: {
    payload?: { payload: { quantity: number; frequency: number } }[];
    label?: string;
}) {
    if (!payload?.length) return null;

    const data = payload[0].payload;

    return (
        <div className="rounded-md border bg-white px-3 py-2 shadow-sm text-sm">
            <p className="font-medium">{label}</p>
            <p>Quantity: {data.quantity}</p>
            <p>Frequency: {data.frequency}</p>
        </div>
    );
}

export default function Dashboard() {
    const [indents, setIndents] = useState<IndentRecord[]>([]);
    const [storeIns, setStoreIns] = useState<StoreInRecord[]>([]);
    const [issues, setIssues] = useState<IssueRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [chartData, setChartData] = useState<ChartDataItem[]>([]);
    const [topVendorsData, setTopVendors] = useState<VendorDataItem[]>([]);
    const [indent, setIndent] = useState<StatsData>({ count: 0, quantity: 0 });
    const [purchase, setPurchase] = useState<StatsData>({ count: 0, quantity: 0 });
    const [out, setOut] = useState<StatsData>({ count: 0, quantity: 0 });
    const [alerts, setAlerts] = useState<AlertsData>({ lowStock: 0, outOfStock: 0 });

    const [startDate, setStartDate] = useState<Date>();
    const [endDate, setEndDate] = useState<Date>();
    const [filteredVendors, setFilteredVendors] = useState<string[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<string[]>([]);
    const [allVendors, setAllVendors] = useState<string[]>([]);
    const [allProducts, setAllProducts] = useState<string[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                setIsLoading(true);
                const [iData, sData, issueData, mData] = await Promise.all([
                    fetchIndentRecords(),
                    fetchStoreInRecords(),
                    fetchIssueRecords(),
                    fetchMasterOptions()
                ]);
                setIndents(iData);
                setStoreIns(sData);
                setIssues(issueData);
                setAllVendors(mData.vendorNames);
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

        // Calculate Top Products by frequency and quantity (based on Store In records)
        const productMap: Record<string, { frequency: number; quantity: number }> = {};
        storeIns
            .filter(filterStoreIn)
            .forEach((item) => {
                if (item.productName) {
                    if (!productMap[item.productName]) {
                        productMap[item.productName] = { frequency: 0, quantity: 0 };
                    }
                    productMap[item.productName].frequency += 1;
                    productMap[item.productName].quantity += Number(item.qty || 0);
                }
            });

        const topProducts = Object.entries(productMap)
            .map(([name, data]) => ({
                name,
                frequency: data.frequency,
                quantity: data.quantity,
            }))
            .sort((a, b) => b.frequency - a.frequency)
            .slice(0, 10);

        setChartData(topProducts);

        // Calculate Top Vendors (based on Store In records)
        const vendorMap: Record<string, { orders: number; quantity: number }> = {};
        storeIns
            .filter(filterStoreIn)
            .forEach((item) => {
                const vendorName = String(item.vendorName || '');
                if (vendorName) {
                    if (!vendorMap[vendorName]) {
                        vendorMap[vendorName] = { orders: 0, quantity: 0 };
                    }
                    vendorMap[vendorName].orders += 1;
                    vendorMap[vendorName].quantity += Number(item.qty || 0);
                }
            });

        const topVendors = Object.entries(vendorMap)
            .map(([name, data]) => ({
                name,
                orders: data.orders,
                quantity: data.quantity,
            }))
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 5);

        setTopVendors(topVendors);

        // Alerts (can be implemented with inventoryService later)
        setAlerts({ lowStock: 0, outOfStock: 0 });

    }, [startDate, endDate, filteredProducts, filteredVendors, indents, storeIns, issues, isLoading]);

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
                <div className="gap-3 grid grid-cols-2 md:grid-cols-4">
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
                </div>

                <div className="grid md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-transparent to-blue-500/10">
                        <CardContent className="pt-6">
                            <div className="text-blue-500 flex justify-between">
                                <p className="font-semibold">Total Approved Indents</p>
                                <ClipboardList size={18} />
                            </div>
                            <p className="text-3xl font-bold text-blue-800">{indent.count}</p>
                            <div className="text-blue-500 flex justify-between">
                                <p className="text-sm">Indented Quantity</p>
                                <p>{indent.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-green-500/10">
                        <CardContent className="pt-6">
                            <div className="text-green-500 flex justify-between">
                                <p className="font-semibold">Total Purchases</p>
                                <Truck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-green-800">{purchase.count}</p>
                            <div className="text-green-500 flex justify-between">
                                <p className="text-sm">Purchased Quantity</p>
                                <p>{purchase.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-orange-500/10">
                        <CardContent className="pt-6">
                            <div className="text-orange-500 flex justify-between">
                                <p className="font-semibold">Total Issued</p>
                                <PackageCheck size={18} />
                            </div>
                            <p className="text-3xl font-bold text-orange-800">{out.count}</p>

                            <div className="text-orange-500 flex justify-between">
                                <p className="text-sm">Out Quantity</p>
                                <p>{out.quantity}</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-transparent to-yellow-500/10 text-yellow-500">
                        <CardContent className="pt-6">
                            <div className="flex justify-between">
                                <p className="font-semibold">Out of Stock</p>
                                <Warehouse size={18} />
                            </div>
                            <p className="text-3xl font-bold text-yellow-800">
                                {alerts.outOfStock}
                            </p>

                            <div className="text-yellow-500 flex justify-between">
                                <p className="text-sm">Low in Stock</p>
                                <p>{alerts.lowStock}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="flex gap-3 flex-wrap">
                    <Card className="w-[55%] md:min-w-150 flex-grow">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Purchased Products</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {chartData.length > 0 ? (
                                <ChartContainer className="max-h-80 w-full" config={chartConfig}>
                                    <BarChart
                                        accessibilityLayer
                                        data={chartData}
                                        layout="vertical"
                                        margin={{
                                            right: 16,
                                        }}
                                    >
                                        <defs>
                                            <linearGradient
                                                id="barGradient"
                                                x1="0"
                                                y1="0"
                                                x2="1"
                                                y2="0"
                                            >
                                                <stop offset="100%" stopColor="#3b82f6" />
                                                <stop offset="0%" stopColor="#2563eb" />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid horizontal={false} />
                                        <YAxis
                                            dataKey="name"
                                            type="category"
                                            tickLine={false}
                                            tickMargin={10}
                                            axisLine={false}
                                            tickFormatter={(value: string) => value.slice(0, 15)}
                                            hide
                                        />
                                        <XAxis dataKey="frequency" type="number" hide />
                                        <ChartTooltip
                                            cursor={false}
                                            content={<CustomChartTooltipContent />}
                                        />
                                        <Bar
                                            dataKey="frequency"
                                            layout="vertical"
                                            fill="url(#barGradient)"
                                            radius={4}
                                        >
                                            <LabelList
                                                dataKey="name"
                                                position="insideLeft"
                                                offset={8}
                                                className="fill-white font-semibold"
                                                fontSize={12}
                                            />
                                            <LabelList
                                                dataKey="frequency"
                                                position="insideRight"
                                                offset={8}
                                                className="fill-white font-semibold"
                                                fontSize={12}
                                            />
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            ) : (
                                <div className="flex items-center justify-center h-80 text-muted-foreground">
                                    No data available for selected filters
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card className="flex-grow min-w-60 w-[40%]">
                        <CardHeader>
                            <CardTitle className="text-xl">Top Vendors</CardTitle>
                        </CardHeader>
                        <CardContent className="text-base grid gap-2">
                            {topVendorsData.length > 0 ? (
                                topVendorsData.map((vendor, i) => (
                                    <div className="flex justify-between" key={i}>
                                        <p className="font-semibold text-md">{vendor.name}</p>
                                        <div className="flex gap-5">
                                            <p>{vendor.orders} Orders</p>
                                            <p>{vendor.quantity} Items</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-muted-foreground py-8">
                                    No vendor data available
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}