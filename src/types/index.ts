export type Role = 'CUSTOMER' | 'OPERATOR';
export type JobStatus = 'DRAFT' | 'UPLOADED' | 'ARRANGING' | 'PROOFING' | 'APPROVED' | 'PRINTED' | 'SHIPPED';
export type PaperSize = 'A4' | 'LETTER';

// Valid status transitions
export const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
    DRAFT: ['UPLOADED'],
    UPLOADED: ['ARRANGING'],
    ARRANGING: ['PROOFING'],
    PROOFING: ['APPROVED', 'ARRANGING'],
    APPROVED: ['PRINTED'],
    PRINTED: ['SHIPPED'],
    SHIPPED: [],
};

// This function determines if the previous current state can transition to the specified state
export function canTransition(from: JobStatus, to: JobStatus): boolean {
    return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

// Human-readable labels
export const STATUS_LABELS: Record<JobStatus, string> = {
    DRAFT: 'Draft',
    UPLOADED: 'Uploaded',
    ARRANGING: 'Arranging',
    PROOFING: 'Awaiting Approval',
    APPROVED: 'Approved',
    PRINTED: 'Printed',
    SHIPPED: 'Shipped',
};

export const STATUS_COLORS: Record<JobStatus, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    UPLOADED: 'bg-blue-100 text-blue-700',
    ARRANGING: 'bg-yellow-100 text-yellow-700',
    PROOFING: 'bg-purple-100 text-purple-700',
    APPROVED: 'bg-green-100 text-green-700',
    PRINTED: 'bg-teal-100 text-teal-700',
    SHIPPED: 'bg-emerald-100 text-emerald-700',
};

export interface HolePositionData {
    id: string;
    xMm: number;
    yMm: number;
    label: string;
}

export interface CanvasSizeData {
    id: string;
    name: string;
    widthMm: number;
    heightMm: number;
    thicknessMm: number;
    priceCents: number;
    active: boolean;
    holes: HolePositionData[];
}

export interface PhotoData {
    id: string;
    s3Key: string;
    originalName: string;
    mimeType: string;
    url?: string;
}

export interface PanelData {
    id: string;
    photoId: string;
    canvasSizeId: string;
    xMm: number;
    yMm: number;
    rotation: 0 | 90 | 180 | 270;
    label?: string;
    // Denormalised for editor
    photo?: PhotoData;
    canvasSize?: CanvasSizeData;
}

export interface JobData {
    id: string;
    title: string;
    wallWidthMm: number;
    wallHeightMm: number;
    paperSize: PaperSize;
    status: JobStatus;
    customerId: string;
    photos: PhotoData[];
    panels: PanelData[];
    createdAt: string;
    updatedAt: string;
}

// Wall editor state
export interface EditorPanel extends PanelData {
    // Display width/height depend on rotation
    displayWidthMm: number;
    displayHeightMm: number;
}