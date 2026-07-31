import { cn } from '@/lib/utils';

export default ({ className, size = 40 }: { className?: string; size?: number }) => (
    <div
        className={cn(
            'flex items-center justify-center overflow-hidden',
            className
        )}
        style={{ width: size, height: size }}
    >
        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
    </div>
);
