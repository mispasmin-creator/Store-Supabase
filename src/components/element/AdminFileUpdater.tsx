import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { uploadFile } from '@/lib/fetchers';
import { Button } from '@/components/ui/button';
import { Upload, Loader2, Edit, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface AdminFileUpdaterProps {
    tableName: string;
    columnName: string;
    rowIdColumn: string;
    rowIdValue: string | number;
    bucketName: string;
    currentFileUrl?: string;
    onUpdate?: () => void;
    label?: string;
    className?: string;
}

export default function AdminFileUpdater({
    tableName,
    columnName,
    rowIdColumn,
    rowIdValue,
    bucketName,
    currentFileUrl,
    onUpdate,
    label = 'Change',
    className = '',
}: AdminFileUpdaterProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Only show if user has 'administrate' permission
    if (!user?.administrate) {
        return null;
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            toast.error('Please select a file first.');
            return;
        }

        setUploading(true);
        try {
            // Upload new file to the storage bucket
            const publicUrl = await uploadFile({
                file: selectedFile,
                folderId: bucketName,
            });

            // Update row in table
            const { error } = await supabase
                .from(tableName)
                .update({ [columnName]: publicUrl })
                .eq(rowIdColumn, rowIdValue);

            if (error) throw error;

            toast.success('Attachment updated successfully!');
            setOpen(false);
            setSelectedFile(null);
            
            if (onUpdate) {
                onUpdate();
            }
        } catch (error: any) {
            console.error('Error changing file:', error);
            toast.error(`Failed to update attachment: ${error.message || error}`);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <Button
                variant="ghost"
                size="sm"
                className={`text-orange-600 hover:text-orange-700 hover:bg-orange-50 h-7 px-2 font-medium flex items-center gap-1 mt-1 ${className}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                }}
            >
                <Edit size={12} />
                <span>{label}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-[425px]" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary font-bold">
                            <Upload className="h-5 w-5" />
                            Change Attachment
                        </DialogTitle>
                        <DialogDescription>
                            Upload a new file (Image or PDF) to replace the current attachment.
                            This action is only available to administrators.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-gray-700">Select File</label>
                            <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                className="border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                disabled={uploading}
                            />
                            {selectedFile && (
                                <p className="text-xs text-muted-foreground mt-1">
                                    Selected: <span className="font-semibold">{selectedFile.name}</span> ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                                </p>
                            )}
                        </div>
                        {currentFileUrl && (
                            <div className="bg-amber-50 text-amber-900 p-2.5 rounded text-xs border border-amber-200 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <div>
                                    <span className="font-semibold block">Warning:</span> Replacing this will permanently point the database record to the new file URL.
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setOpen(false);
                                setSelectedFile(null);
                            }}
                            disabled={uploading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpload}
                            disabled={uploading || !selectedFile}
                            className="bg-primary hover:bg-primary/95 text-white"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Uploading...
                                </>
                            ) : (
                                'Upload & Update'
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
