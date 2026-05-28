import { PDFDocument, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import {
    MM_TO_PT,
    transformAllHoles,
    defaultHoles,
    panelDisplaySize,
    wallMmToPdfPt,
    PAPER_SIZES,
    getTileArea,
    computeTileGrid,
    rectIntersects,
    pointInRect,
    type HoleInMm,
    type PaperSizeKey,
} from './geometry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PdfPanel {
    id: string;
    label: string;
    xMm: number;
    yMm: number;
    widthMm: number;   // natural (unrotated)
    heightMm: number;  // natural (unrotated)
    rotation: 0 | 90 | 180 | 270;
    holes: HoleInMm[];
}

export interface PdfJob {
    title: string;
    wallWidthMm: number;
    wallHeightMm: number;
    paperSize: PaperSizeKey;
    panels: PdfPanel[];
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

const COL_PANEL_OUTLINE = rgb(0.2, 0.2, 0.2);
const COL_PANEL_FILL = rgb(0.96, 0.93, 0.88); // light wood
const COL_HOLE_CROSS = rgb(0.8, 0.1, 0.1);     // red drill mark
const COL_CROP_MARK = rgb(0.4, 0.4, 0.4);
const COL_CALIBRATION = rgb(0, 0, 0);
const COL_GRID_LINE = rgb(0.85, 0.85, 0.85);

const CROP_MARK_LEN_MM = 5;   // length of each crop mark line
const CROP_MARK_GAP_MM = 2;   // gap between content edge and mark start
const HOLE_CROSS_SIZE_MM = 4; // half-size of ✕ mark

// ---------------------------------------------------------------------------
// Shared helper: draw a ✕ at a PDF point
// ---------------------------------------------------------------------------
function drawCross(
    page: PDFPage,
    x: number, y: number,   // PDF points, y-up
    sizePt: number,
    colour: ReturnType<typeof rgb>
) {
    page.drawLine({
        start: { x: x - sizePt, y: y + sizePt },
        end: { x: x + sizePt, y: y - sizePt },
        thickness: 1.5,
        color: colour,
    });
    page.drawLine({
        start: { x: x + sizePt, y: y + sizePt },
        end: { x: x - sizePt, y: y - sizePt },
        thickness: 1.5,
        color: colour,
    });
}

// ---------------------------------------------------------------------------
// Shared helper: mm → pt for a dimension (not a coordinate)
// ---------------------------------------------------------------------------
const mmToPt = (mm: number) => mm * MM_TO_PT;

// ---------------------------------------------------------------------------
// Page 1: Calibration page
// ---------------------------------------------------------------------------

async function buildCalibrationPage(pdf: PDFDocument, paperSize: PaperSizeKey): Promise<void> {
    const p = PAPER_SIZES[paperSize];
    const page = pdf.addPage([mmToPt(p.widthMm), mmToPt(p.heightMm)]);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
    const W = mmToPt(p.widthMm);
    const H = mmToPt(p.heightMm);

    // Title
    page.drawText('CALIBRATION CHECK — READ BEFORE PRINTING', {
        x: mmToPt(15), y: H - mmToPt(20),
        size: 11, font, color: COL_CALIBRATION,
    });

    // *** 100 mm × 100 mm reference square ***
    const sqX = mmToPt(55);
    const sqY = H - mmToPt(170);
    const sqSz = mmToPt(100);

    page.drawRectangle({
        x: sqX, y: sqY, width: sqSz, height: sqSz,
        borderColor: COL_CALIBRATION, borderWidth: 1.5, color: rgb(1, 1, 1),
    });

    // Dimension labels
    page.drawText('100 mm', { x: sqX + sqSz / 2 - mmToPt(8), y: sqY - mmToPt(7), size: 9, font: fontReg });
    page.drawText('100 mm', { x: sqX - mmToPt(18), y: sqY + sqSz / 2 - mmToPt(2), size: 9, font: fontReg });

    // Corner tick marks (so customer can measure corner-to-corner)
    const tickLen = mmToPt(5);
    // Bottom-left tick
    page.drawLine({ start: { x: sqX, y: sqY - tickLen }, end: { x: sqX, y: sqY }, thickness: 0.5, color: COL_CROP_MARK });
    page.drawLine({ start: { x: sqX - tickLen, y: sqY }, end: { x: sqX, y: sqY }, thickness: 0.5, color: COL_CROP_MARK });

    const instructions = [
        '',
        'STEP 1 — Print settings (CRITICAL — wrong settings = wrong hole positions)',
        '',
        '  Adobe Reader / Acrobat:',
        '    File > Print > Page Sizing & Handling > set to "Actual size" (NOT "Fit")',
        '    Uncheck "Shrink oversized pages". Paper size must match this document.',
        '',
        '  Google Chrome / Edge (print dialog):',
        '    More settings > Scale > choose "100" (NOT "Default")',
        '    OR: set "Scale" to 100%',
        '',
        '  macOS Preview:',
        '    File > Print > Scale: 100%',
        '    Deselect "Scale to fit page"',
        '',
        '  Windows Photo Viewer / Microsoft Print:',
        '    In Page Setup: Scale = 100% (Full size)',
        '',
        'STEP 2 — After printing this page, measure the square above with a ruler.',
        '         Both sides must measure exactly 100 mm (3.94 inches).',
        '         If either side is wrong, REPRINT with the correct settings above.',
        '         Do NOT continue until the square measures 100 mm.',
        '',
        'STEP 3 — Print all remaining pages at the same settings.',
        '',
        'STEP 4 — Lay pages out on a flat surface. Align the crop marks (small lines',
        '         at each page corner) so they form continuous straight lines.',
        '         Tape pages together from the BACK with masking tape.',
        '         Trim any white overlap so pages lie flat.',
        '',
        'STEP 5 — Position the assembled template on your wall:',
        '         • Use a spirit level to align the top edge horizontally.',
        '         • Measure from the floor to confirm the correct height.',
        '         • Secure all four corners with painter\'s tape.',
        '         • Verify the template is not bowed or twisted.',
        '',
        'STEP 6 — Drill at every X mark. Hold the drill perpendicular to the wall.',
        '         Drill through the paper and into the wall. Do not move the template.',
        '         When all holes are drilled, peel the template away carefully.',
        '',
        '',
        'IMPORTANT: Print at 100% / actual size. NEVER use "Fit to page" or "Shrink".',
        'Tile page 1 of N: CALIBRATION — do NOT include this page in your wall template.',
        '',
    ];

    let textY = H - mmToPt(185);
    for (const line of instructions) {
        if (textY < mmToPt(15)) break;
        const isBold = line.startsWith('STEP') || line.startsWith('━') || line.startsWith('IMPORTANT');
        page.drawText(line, {
            x: mmToPt(10), y: textY,
            size: isBold ? 8 : 7.5,
            font: isBold ? font : fontReg,
            color: COL_CALIBRATION,
        });
        textY -= mmToPt(5.5);
    }
}

// ---------------------------------------------------------------------------
// Build tiled template pages
// ---------------------------------------------------------------------------

const PAGE_MARGIN_MM = 10;

async function buildTemplatePage(
    pdf: PDFDocument,
    job: PdfJob,
    tileCol: number,
    tileRow: number,
    totalCols: number,
    totalRows: number
): Promise<void> {
    const p = PAPER_SIZES[job.paperSize];
    const page = pdf.addPage([mmToPt(p.widthMm), mmToPt(p.heightMm)]);
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
    const pageH = mmToPt(p.heightMm);
    const margin = PAGE_MARGIN_MM;

    const { tileW, tileH } = getTileArea(job.paperSize, margin);

    // Wall region this tile covers
    const tileOriginX = tileCol * tileW;
    const tileOriginY = tileRow * tileH;
    const tileEndX = tileOriginX + tileW;
    const tileEndY = tileOriginY + tileH;

    // Helper: convert wall-mm to PDF points for this tile
    const toPt = (wallX: number, wallY: number) =>
        wallMmToPdfPt({
            wallX, wallY,
            tileOriginX_mm: tileOriginX,
            tileOriginY_mm: tileOriginY,
            pageMargin_mm: margin,
            pageHeight_mm: p.heightMm,
        });

    // ---------------------------------------------------------------------------
    // Draw faint grid (50mm spacing within the tile)
    // ---------------------------------------------------------------------------
    const GRID_SPACING = 50;
    const firstGridX = Math.ceil(tileOriginX / GRID_SPACING) * GRID_SPACING;
    const firstGridY = Math.ceil(tileOriginY / GRID_SPACING) * GRID_SPACING;

    for (let gx = firstGridX; gx < tileEndX; gx += GRID_SPACING) {
        const { x: px } = toPt(gx, tileOriginY);
        const { y: py1 } = toPt(gx, tileOriginY);
        const { y: py2 } = toPt(gx, Math.min(tileEndY, job.wallHeightMm));
        page.drawLine({ start: { x: px, y: py1 }, end: { x: px, y: py2 }, thickness: 0.3, color: COL_GRID_LINE });
    }
    for (let gy = firstGridY; gy < tileEndY; gy += GRID_SPACING) {
        const { y: py } = toPt(tileOriginX, gy);
        const { x: px1 } = toPt(tileOriginX, gy);
        const { x: px2 } = toPt(Math.min(tileEndX, job.wallWidthMm), gy);
        page.drawLine({ start: { x: px1, y: py }, end: { x: px2, y: py }, thickness: 0.3, color: COL_GRID_LINE });
    }

    // ---------------------------------------------------------------------------
    // Draw panels that intersect this tile
    // ---------------------------------------------------------------------------
    for (const panel of job.panels) {
        const { displayW, displayH } = panelDisplaySize(
            panel.widthMm, panel.heightMm, panel.rotation
        );

        // Skip panels that don't intersect this tile at all
        if (!rectIntersects(
            { x: panel.xMm, y: panel.yMm, w: displayW, h: displayH },
            { x: tileOriginX, y: tileOriginY, w: tileW, h: tileH }
        )) continue;

        // Clip the panel rectangle to the tile content area.
        // This prevents overflow when a panel spans multiple tiles.
        // When the customer tapes tiles together along the crop marks,
        // the clipped halves join into the complete panel outline.
        const visX1 = Math.max(panel.xMm, tileOriginX);
        const visY1 = Math.max(panel.yMm, tileOriginY);
        const visX2 = Math.min(panel.xMm + displayW, tileEndX);
        const visY2 = Math.min(panel.yMm + displayH, tileEndY);

        const tl = toPt(visX1, visY1);
        const br = toPt(visX2, visY2);
        const pw = br.x - tl.x;
        const ph = tl.y - br.y;

        if (pw <= 0 || ph <= 0) continue;

        page.drawRectangle({
            x: tl.x, y: br.y, width: pw, height: ph,
            color: COL_PANEL_FILL,
            borderColor: COL_PANEL_OUTLINE,
            borderWidth: 1.2,
        });

        // Panel label — only on the tile that contains the panel's top-left corner
        if (panel.xMm >= tileOriginX && panel.xMm < tileEndX &&
            panel.yMm >= tileOriginY && panel.yMm < tileEndY) {
            page.drawText(panel.label || `Panel ${panel.id.slice(-4)}`, {
                x: tl.x + mmToPt(2),
                y: tl.y - mmToPt(7),
                size: 7, font: fontReg, color: COL_PANEL_OUTLINE,
            });
        }

        // Hole markers — only draw holes that fall within this tile
        const holeList = panel.holes.length > 0
            ? panel.holes
            : defaultHoles(panel.widthMm);

        const wallHoles = transformAllHoles({
            panelX: panel.xMm, panelY: panel.yMm,
            panelW: panel.widthMm, panelH: panel.heightMm,
            rotation: panel.rotation, holes: holeList,
        });

        for (const wh of wallHoles) {
            if (!pointInRect(
                { x: wh.wallX, y: wh.wallY },
                { x: tileOriginX, y: tileOriginY, w: tileW, h: tileH }
            )) continue;

            const hp = toPt(wh.wallX, wh.wallY);
            drawCross(page, hp.x, hp.y, mmToPt(HOLE_CROSS_SIZE_MM), COL_HOLE_CROSS);

            if (wh.label) {
                page.drawText(wh.label, {
                    x: hp.x + mmToPt(5), y: hp.y - mmToPt(2),
                    size: 6, font: fontReg, color: COL_HOLE_CROSS,
                });
            }
        }
    }
    // for (const panel of job.panels) {
    //     const { displayW, displayH } = panelDisplaySize(panel.widthMm, panel.heightMm, panel.rotation);
    //     const pRect = { x: panel.xMm, y: panel.yMm, w: displayW, h: displayH };
    //     const tRect = { x: tileOriginX, y: tileOriginY, w: tileW, h: tileH };
    //     if (!rectIntersects(pRect, tRect)) continue;

    //     // Panel corners in PDF space
    //     const tl = toPt(panel.xMm, panel.yMm);
    //     const br = toPt(panel.xMm + displayW, panel.yMm + displayH);
    //     const pw = br.x - tl.x;
    //     const ph = tl.y - br.y; // y is flipped in PDF

    //     // Fill + outline
    //     page.drawRectangle({
    //         x: tl.x, y: br.y, width: pw, height: ph,
    //         color: COL_PANEL_FILL,
    //         borderColor: COL_PANEL_OUTLINE,
    //         borderWidth: 1.2,
    //     });

    //     // Panel label (top-left of panel, inside)
    //     const labelX = Math.max(tl.x + mmToPt(2), mmToPt(margin));
    //     const labelY = Math.min(tl.y - mmToPt(7), pageH - mmToPt(margin) - 8);
    //     if (labelY > mmToPt(margin) && labelX < mmToPt(p.widthMm - margin)) {
    //         page.drawText(panel.label || `Panel ${panel.id.slice(-4)}`, {
    //             x: labelX, y: labelY,
    //             size: 7, font: fontReg,
    //             color: COL_PANEL_OUTLINE,
    //         });
    //     }

    //     // Draw holes
    //     const holeList = panel.holes.length > 0 ? panel.holes : defaultHoles(panel.widthMm);
    //     const wallHoles = transformAllHoles({
    //         panelX: panel.xMm,
    //         panelY: panel.yMm,
    //         panelW: panel.widthMm,
    //         panelH: panel.heightMm,
    //         rotation: panel.rotation,
    //         holes: holeList,
    //     });

    //     for (const wh of wallHoles) {
    //         if (!pointInRect({ x: wh.wallX, y: wh.wallY }, tRect)) continue;
    //         const hp = toPt(wh.wallX, wh.wallY);
    //         drawCross(page, hp.x, hp.y, mmToPt(HOLE_CROSS_SIZE_MM), COL_HOLE_CROSS);

    //         // Small circle around the cross
    //         page.drawCircle({
    //             x: hp.x, y: hp.y,
    //             size: mmToPt(HOLE_CROSS_SIZE_MM + 1),
    //             borderColor: COL_HOLE_CROSS, borderWidth: 0.5,
    //             color: rgb(1, 1, 1),
    //             opacity: 0,
    //             borderOpacity: 0.7,
    //         });

    //         // Hole label
    //         if (wh.label) {
    //             page.drawText(wh.label, {
    //                 x: hp.x + mmToPt(5), y: hp.y - mmToPt(2),
    //                 size: 6, font: fontReg, color: COL_HOLE_CROSS,
    //             });
    //         }
    //     }
    // }

    // ---------------------------------------------------------------------------
    // Wall boundary outline (crop to tile)
    // ---------------------------------------------------------------------------
    const wallR = toPt(
        Math.min(job.wallWidthMm, tileEndX),
        Math.min(job.wallHeightMm, tileEndY)
    );
    const wallTL = toPt(Math.max(0, tileOriginX), Math.max(0, tileOriginY));
    if (
        job.wallWidthMm > tileOriginX && job.wallHeightMm > tileOriginY
    ) {
        // Right edge of wall if it falls within this tile
        if (job.wallWidthMm < tileEndX) {
            page.drawLine({
                start: { x: wallR.x, y: wallTL.y },
                end: { x: wallR.x, y: wallR.y },
                thickness: 1, color: rgb(0, 0, 0.5),
                dashArray: [4, 2],
            });
        }
        // Bottom edge of wall if it falls within this tile
        if (job.wallHeightMm < tileEndY) {
            page.drawLine({
                start: { x: wallTL.x, y: wallR.y },
                end: { x: wallR.x, y: wallR.y },
                thickness: 1, color: rgb(0, 0, 0.5),
                dashArray: [4, 2],
            });
        }
    }

    // ---------------------------------------------------------------------------
    // Crop marks at all four corners of the TILE area
    // ---------------------------------------------------------------------------
    const cmGap = mmToPt(CROP_MARK_GAP_MM);
    const cmLen = mmToPt(CROP_MARK_LEN_MM);

    const corners = [
        toPt(tileOriginX, tileOriginY),      // top-left
        toPt(tileEndX, tileOriginY),           // top-right
        toPt(tileOriginX, tileEndY),           // bottom-left
        toPt(tileEndX, tileEndY),              // bottom-right
    ];

    // top-left: lines going left and up
    page.drawLine({ start: { x: corners[0].x - cmGap - cmLen, y: corners[0].y }, end: { x: corners[0].x - cmGap, y: corners[0].y }, thickness: 0.5, color: COL_CROP_MARK });
    page.drawLine({ start: { x: corners[0].x, y: corners[0].y + cmGap }, end: { x: corners[0].x, y: corners[0].y + cmGap + cmLen }, thickness: 0.5, color: COL_CROP_MARK });

    // top-right
    page.drawLine({ start: { x: corners[1].x + cmGap, y: corners[1].y }, end: { x: corners[1].x + cmGap + cmLen, y: corners[1].y }, thickness: 0.5, color: COL_CROP_MARK });
    page.drawLine({ start: { x: corners[1].x, y: corners[1].y + cmGap }, end: { x: corners[1].x, y: corners[1].y + cmGap + cmLen }, thickness: 0.5, color: COL_CROP_MARK });

    // bottom-left
    page.drawLine({ start: { x: corners[2].x - cmGap - cmLen, y: corners[2].y }, end: { x: corners[2].x - cmGap, y: corners[2].y }, thickness: 0.5, color: COL_CROP_MARK });
    page.drawLine({ start: { x: corners[2].x, y: corners[2].y - cmGap - cmLen }, end: { x: corners[2].x, y: corners[2].y - cmGap }, thickness: 0.5, color: COL_CROP_MARK });

    // bottom-right
    page.drawLine({ start: { x: corners[3].x + cmGap, y: corners[3].y }, end: { x: corners[3].x + cmGap + cmLen, y: corners[3].y }, thickness: 0.5, color: COL_CROP_MARK });
    page.drawLine({ start: { x: corners[3].x, y: corners[3].y - cmGap - cmLen }, end: { x: corners[3].x, y: corners[3].y - cmGap }, thickness: 0.5, color: COL_CROP_MARK });

    // ---------------------------------------------------------------------------
    // Tile label & page info
    // ---------------------------------------------------------------------------
    const colLabel = String.fromCharCode(65 + tileCol); // A, B, C…
    const rowLabel = String(tileRow + 1);
    const tileLabel = `Tile ${colLabel}${rowLabel}`;
    const pageNum = tileRow * totalCols + tileCol + 2; // +2 because page 1 is calibration
    const totalPages = totalCols * totalRows + 1;

    page.drawText(tileLabel, {
        x: mmToPt(margin), y: pageH - mmToPt(7),
        size: 8, font, color: COL_CALIBRATION,
    });
    page.drawText(`Page ${pageNum} of ${totalPages}`, {
        x: mmToPt(p.widthMm - margin - 25), y: pageH - mmToPt(7),
        size: 7, font: fontReg, color: COL_CALIBRATION,
    });
    page.drawText(`Wall region: X ${tileOriginX}–${Math.min(tileEndX, job.wallWidthMm)} mm, Y ${tileOriginY}–${Math.min(tileEndY, job.wallHeightMm)} mm`, {
        x: mmToPt(margin), y: pageH - mmToPt(13),
        size: 6.5, font: fontReg, color: COL_CROP_MARK,
    });

    // Footer
    const footerY = mmToPt(6);
    page.drawText(
        'PRINT AT 100% / ACTUAL SIZE — NEVER "Fit to page" or "Shrink"' +
        `${job.title} | ${tileLabel} | X = drill here`,
        {
            x: mmToPt(margin), y: footerY,
            size: 6.5, font, color: rgb(0.7, 0, 0),
        }
    );
}

// ---------------------------------------------------------------------------
// Build 1:1 tiled template PDF
// ---------------------------------------------------------------------------

export async function buildTiledTemplatePdf(job: PdfJob): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();

    const { tileW, tileH } = getTileArea(job.paperSize, PAGE_MARGIN_MM);
    const { cols, rows } = computeTileGrid(job.wallWidthMm, job.wallHeightMm, tileW, tileH);

    // Page 1: calibration
    await buildCalibrationPage(pdf, job.paperSize);

    // Tile pages: row-major order (left-to-right, top-to-bottom)
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            await buildTemplatePage(pdf, job, col, row, cols, rows);
        }
    }

    return pdf.save();
}

// ---------------------------------------------------------------------------
// Build scaled reference sheet PDF
// ---------------------------------------------------------------------------

export async function buildReferenceSheetPdf(job: PdfJob): Promise<Uint8Array> {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.HelveticaBold);
    const fontReg = await pdf.embedFont(StandardFonts.Helvetica);
    const fontMono = await pdf.embedFont(StandardFonts.Courier);

    // Use A3 if the table will be long, otherwise A4 landscape
    const pageWmm = 420; // A3 landscape
    const pageHmm = 297;
    const page = pdf.addPage([mmToPt(pageWmm), mmToPt(pageHmm)]);
    const pageH = mmToPt(pageHmm);

    const margin = 15; // mm
    const tableStartY_mm = 90; // mm from top — below the wall overview

    // ---------------------------------------------------------------------------
    // Scale the wall to fit in the overview area
    // ---------------------------------------------------------------------------
    const overviewMaxW_mm = pageWmm - 2 * margin;
    const overviewMaxH_mm = tableStartY_mm - margin - 20; // leave room for title
    const scaleX = overviewMaxW_mm / job.wallWidthMm;
    const scaleY = overviewMaxH_mm / job.wallHeightMm;
    const scale = Math.min(scaleX, scaleY); // mm display / mm real

    const overviewX = mmToPt(margin);
    const overviewY = pageH - mmToPt(margin + 12) - mmToPt(job.wallHeightMm * scale);
    const overviewW = mmToPt(job.wallWidthMm * scale);
    const overviewH = mmToPt(job.wallHeightMm * scale);

    // Helper: wall mm → overview PDF pt
    const toOverview = (wallX: number, wallY: number) => ({
        x: overviewX + mmToPt(wallX * scale),
        y: overviewY + overviewH - mmToPt(wallY * scale),
    });

    // Wall boundary
    page.drawRectangle({
        x: overviewX, y: overviewY,
        width: overviewW, height: overviewH,
        borderColor: rgb(0, 0, 0), borderWidth: 1,
        color: rgb(0.97, 0.97, 0.95),
    });

    // Panels (scaled overview)
    for (const panel of job.panels) {
        const { displayW, displayH } = panelDisplaySize(panel.widthMm, panel.heightMm, panel.rotation);
        const tl = toOverview(panel.xMm, panel.yMm);
        const pw = mmToPt(displayW * scale);
        const ph = mmToPt(displayH * scale);

        page.drawRectangle({
            x: tl.x, y: tl.y - ph, width: pw, height: ph,
            color: COL_PANEL_FILL, borderColor: COL_PANEL_OUTLINE, borderWidth: 0.7,
        });

        // Hole marks on overview
        const holeList = panel.holes.length > 0 ? panel.holes : defaultHoles(panel.widthMm);
        const wallHoles = transformAllHoles({
            panelX: panel.xMm, panelY: panel.yMm,
            panelW: panel.widthMm, panelH: panel.heightMm,
            rotation: panel.rotation, holes: holeList,
        });
        for (const wh of wallHoles) {
            const hp = toOverview(wh.wallX, wh.wallY);
            drawCross(page, hp.x, hp.y, 3, COL_HOLE_CROSS);
        }

        // Label
        if (pw > 20 && ph > 10) {
            page.drawText(panel.label || panel.id.slice(-4), {
                x: tl.x + 2, y: tl.y - ph + 2,
                size: Math.min(6, pw / 6), font: fontReg,
                color: COL_PANEL_OUTLINE,
            });
        }
    }

    // Scale indicator
    const scaleBarMm = 100;
    const scaleBarPt = mmToPt(scaleBarMm * scale);
    const scaleBarY = overviewY - mmToPt(8);
    page.drawLine({ start: { x: overviewX, y: scaleBarY }, end: { x: overviewX + scaleBarPt, y: scaleBarY }, thickness: 1.5, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: overviewX, y: scaleBarY - mmToPt(2) }, end: { x: overviewX, y: scaleBarY + mmToPt(2) }, thickness: 1.5, color: rgb(0, 0, 0) });
    page.drawLine({ start: { x: overviewX + scaleBarPt, y: scaleBarY - mmToPt(2) }, end: { x: overviewX + scaleBarPt, y: scaleBarY + mmToPt(2) }, thickness: 1.5, color: rgb(0, 0, 0) });
    page.drawText(`100 mm`, { x: overviewX + scaleBarPt / 2 - mmToPt(5), y: scaleBarY - mmToPt(6), size: 7, font: fontReg });

    // Title
    page.drawText(`Reference Sheet — ${job.title}`, {
        x: mmToPt(margin), y: pageH - mmToPt(margin + 7),
        size: 13, font, color: COL_CALIBRATION,
    });
    page.drawText(`Wall: ${job.wallWidthMm} × ${job.wallHeightMm} mm | ${job.panels.length} panels | Scale: 1:${Math.round(1 / scale)}`, {
        x: mmToPt(margin), y: pageH - mmToPt(margin + 16),
        size: 8, font: fontReg, color: COL_CALIBRATION,
    });

    // ---------------------------------------------------------------------------
    // Drill-point table
    // ---------------------------------------------------------------------------
    const tableY0 = pageH - mmToPt(tableStartY_mm);
    const cols_table = ['Panel', 'Size (mm)', 'Pos X (mm)', 'Pos Y (mm)', 'Drill X (mm)', 'Drill Y (mm)', 'Label'];
    const colWidths = [55, 60, 50, 50, 55, 55, 80].map(mmToPt);
    const rowH = mmToPt(6);

    // Header row
    let tx = mmToPt(margin);
    let ty = tableY0;
    page.drawRectangle({ x: tx, y: ty - rowH, width: colWidths.reduce((a, b) => a + b, 0), height: rowH, color: rgb(0.9, 0.88, 0.85), borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
    for (let i = 0; i < cols_table.length; i++) {
        page.drawText(cols_table[i], { x: tx + 3, y: ty - rowH + mmToPt(1.5), size: 6.5, font });
        tx += colWidths[i];
    }
    ty -= rowH;

    // Data rows
    for (const panel of job.panels) {
        const { displayW, displayH } = panelDisplaySize(panel.widthMm, panel.heightMm, panel.rotation);
        const holeList = panel.holes.length > 0 ? panel.holes : defaultHoles(panel.widthMm);
        const wallHoles = transformAllHoles({
            panelX: panel.xMm, panelY: panel.yMm,
            panelW: panel.widthMm, panelH: panel.heightMm,
            rotation: panel.rotation, holes: holeList,
        });

        for (let hi = 0; hi < wallHoles.length; hi++) {
            const wh = wallHoles[hi];
            if (ty < mmToPt(margin + 10)) break; // ran out of room

            const rowData = [
                panel.label || panel.id.slice(-4),
                `${displayW}×${displayH}`,
                panel.xMm.toFixed(1),
                panel.yMm.toFixed(1),
                wh.wallX.toFixed(1),
                wh.wallY.toFixed(1),
                wh.label || '',
            ];

            const rowBg = (job.panels.indexOf(panel) % 2 === 0) ? rgb(1, 1, 1) : rgb(0.97, 0.96, 0.95);
            tx = mmToPt(margin);
            page.drawRectangle({ x: tx, y: ty - rowH, width: colWidths.reduce((a, b) => a + b, 0), height: rowH, color: rowBg, borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.3 });

            for (let i = 0; i < rowData.length; i++) {
                page.drawText(rowData[i], { x: tx + 3, y: ty - rowH + mmToPt(1.5), size: 6, font: fontMono });
                tx += colWidths[i];
            }
            ty -= rowH;
        }
    }

    // Footer
    page.drawText('All dimensions in millimetres (mm). Positions measured from wall top-left corner.', {
        x: mmToPt(margin), y: mmToPt(margin),
        size: 7, font: fontReg, color: rgb(0.5, 0.5, 0.5),
    });

    return pdf.save();
}