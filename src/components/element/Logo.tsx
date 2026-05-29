import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

export default ({ className, size }: { className?: string; size?: number }) => (
    <div
        className={cn(
            'flex p-2 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-600 to-green-500 shadow-md',
            className
        )}
    >
        <Package className="text-background" size={size} />
    </div>
);
