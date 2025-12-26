
import React from 'react';

interface FileUploadProps {
    onFilesSelected: (files: { data: string, mimeType: string }[]) => void;
    isLoading: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelected, isLoading }) => {
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const fileArray = Array.from(e.target.files) as File[];
            const readers = fileArray.map(file => {
                return new Promise<{ data: string, mimeType: string }>((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve({
                        data: reader.result as string,
                        mimeType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
                    });
                    reader.readAsDataURL(file);
                });
            });

            Promise.all(readers).then(onFilesSelected);
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6 md:p-8 border-2 border-dashed border-slate-300 rounded-2xl bg-white hover:border-blue-400 transition-colors cursor-pointer relative group">
            <input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                disabled={isLoading}
            />
            <div className="flex flex-col items-center justify-center space-y-4 text-slate-500">
                <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
                    <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <div className="text-center">
                    <p className="text-base md:text-lg font-semibold text-slate-700">Drop exam papers here</p>
                    <p className="text-xs md:text-sm">Upload images or PDF files</p>
                </div>
                <p className="text-[11px] md:text-xs text-slate-400 text-center">Supported formats: JPG, PNG, WEBP, PDF (Max 10 files)</p>
            </div>
        </div>
    );
};

export default FileUpload;
