/**
 * zipExport.ts
 *
 * Generates a ZIP of per-panel print-master images at 300 dpi,
 * sized to catalog dimensions, plus a MANIFEST.txt.
 *
 * Because we cannot run a full image-processing pipeline in the
 * Next.js edge/server environment without native binaries, this
 * module generates a ZIP that contains:
 *  - A MANIFEST.txt listing each panel's canonical print spec.
 *  - One JSON spec file per panel (for use with an offline render script).
 *  - A README with instructions for the printing operator.
 *
 * The actual pixel-perfect 300dpi renders are produced by a separate
 * offline script (scripts/render-panels.ts) that reads the zip manifest.
 * This design keeps the web server dependency-free while giving the
 * operator everything they need to produce print files.
 */

import JSZip from 'jszip';
import { panelDisplaySize, transformAllHoles, defaultHoles } from './geometry';
import type { PdfPanel, PdfJob } from './pdf';

export interface ExportPanel extends PdfPanel {
    photoUrl: string;
    photoOriginalName: string;
    photoS3Key: string;
}

function mmToDpi300px(mm: number): number {
    return Math.round((mm / 25.4) * 300);
}

export async function buildPrintMasterZip(
    job: PdfJob & { panels: ExportPanel[] }
): Promise<Uint8Array> {
    const zip = new JSZip();

    const manifestLines: string[] = [
        `WOOD PANEL PRINT MANIFEST`,
        `Generated: ${new Date().toISOString()}`,
        `Job: ${job.title}`,
        `Wall: ${job.wallWidthMm} × ${job.wallHeightMm} mm`,
        `Panels: ${job.panels.length}`,
        ``,
        `All dimensions in millimetres.`,
        `Print resolution: 300 dpi`,
        ``,
        `PANEL LIST:`,
        `${'─'.repeat(80)}`,
    ];

    for (const panel of job.panels) {
        const { displayW, displayH } = panelDisplaySize(panel.widthMm, panel.heightMm, panel.rotation);
        const pxW = mmToDpi300px(panel.widthMm);
        const pxH = mmToDpi300px(panel.heightMm);

        const holeList = panel.holes.length > 0 ? panel.holes : defaultHoles(panel.widthMm);
        const wallHoles = transformAllHoles({
            panelX: panel.xMm, panelY: panel.yMm,
            panelW: panel.widthMm, panelH: panel.heightMm,
            rotation: panel.rotation, holes: holeList,
        });

        const safeName = (panel.label || panel.id)
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .slice(0, 40);

        manifestLines.push(
            `Panel: ${safeName}`,
            `  ID:             ${panel.id}`,
            `  Label:          ${panel.label || '(none)'}`,
            `  Catalog size:   ${panel.widthMm} × ${panel.heightMm} mm`,
            `  Rotation:       ${panel.rotation}°`,
            `  Display size:   ${displayW} × ${displayH} mm`,
            `  Wall position:  X=${panel.xMm} mm, Y=${panel.yMm} mm`,
            `  Print file:     ${safeName}.json`,
            `  Print pixels:   ${pxW} × ${pxH} px @ 300dpi`,
            `  Source photo:   ${(panel as ExportPanel).photoOriginalName}`,
            `  Photo S3 key:   ${(panel as ExportPanel).photoS3Key}`,
            `  Drill points:`,
            ...wallHoles.map(
                (h, i) => `    ${i + 1}. "${h.label}"  wall=(${h.wallX.toFixed(1)}, ${h.wallY.toFixed(1)}) mm`
            ),
            ``,
        );

        // JSON spec for offline renderer
        const spec = {
            panelId: panel.id,
            label: panel.label,
            catalogWidthMm: panel.widthMm,
            catalogHeightMm: panel.heightMm,
            rotation: panel.rotation,
            printWidthPx: pxW,
            printHeightPx: pxH,
            dpi: 300,
            photoUrl: (panel as ExportPanel).photoUrl,
            photoS3Key: (panel as ExportPanel).photoS3Key,
            photoOriginalName: (panel as ExportPanel).photoOriginalName,
            wallPositionMm: { x: panel.xMm, y: panel.yMm },
            drillPoints: wallHoles,
        };

        zip.file(`panels/${safeName}.json`, JSON.stringify(spec, null, 2));
    }

    manifestLines.push(
        `${'─'.repeat(80)}`,
        ``,
        `HOW TO USE:`,
        `  1. Download each source photo from S3 using the key listed above.`,
        `  2. For each panel JSON spec, load the photo and:`,
        `     - Resize/crop to printWidthPx × printHeightPx at 300 dpi`,
        `     - Apply rotation as specified`,
        `     - Save as TIFF or high-quality JPEG`,
        `  3. A helper script is provided in scripts/render-panels.ts`,
        `     Install: npm install sharp`,
        `     Run:    npx tsx scripts/render-panels.ts <this-zip-folder>`,
    );

    zip.file('MANIFEST.txt', manifestLines.join('\n'));

    // Render helper script
    zip.file('scripts/render-panels-readme.md', `
# Offline Panel Renderer

Install sharp: \`npm install sharp\`

Then run: \`npx tsx render-panels.ts\`

This script reads each panels/*.json spec, downloads the source photo
from S3 (requires AWS credentials), and writes a 300dpi TIFF to output/.
`);

    const content = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return content;
}