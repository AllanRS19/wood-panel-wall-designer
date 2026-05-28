export const MM_TO_PT = 72 / 25.4; // 2.834645669… points per mm (exact)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Point {
    x: number; // mm
    y: number; // mm
}

export interface Rect {
    x: number; // mm — left edge
    y: number; // mm — top edge
    w: number; // mm
    h: number; // mm
}

export interface HoleInMm {
    xMm: number; // relative to panel top-left (unrotated)
    yMm: number;
    label: string;
}

export interface WallHole {
    wallX: number; // mm from wall left
    wallY: number; // mm from wall top
    label: string;
}

// ---------------------------------------------------------------------------
// Panel display dimensions after rotation
// ---------------------------------------------------------------------------

/**
 * Returns the displayed width and height of a panel on the wall
 * given its natural (catalog) dimensions and rotation.
 */
export function panelDisplaySize(
    widthMm: number,
    heightMm: number,
    rotation: 0 | 90 | 180 | 270
): { displayW: number; displayH: number } {
    if (rotation === 90 || rotation === 270) {
        return { displayW: heightMm, displayH: widthMm };
    }
    return { displayW: widthMm, displayH: heightMm };
}

// ---------------------------------------------------------------------------
// Core transformation: panel-local hole → wall coordinates
// ---------------------------------------------------------------------------

/**
 * Transforms a hole position from panel-local coordinates to wall coordinates.
 *
 * Convention:
 *   - Panel position (panelX, panelY) is the displayed top-left corner on the wall.
 *   - Hole coordinates (holeX, holeY) are relative to the TOP-LEFT corner of the
 *     UNROTATED panel (as defined in the catalog).
 *   - Rotation is applied around the panel's own center, with the displayed
 *     top-left corner kept at (panelX, panelY).
 *
 * Rotation formulas (y-axis pointing down):
 *   R=0:   wall = (panelX + hx,       panelY + hy)
 *   R=90:  wall = (panelX + H - hy,   panelY + hx)       displayed as H×W
 *   R=180: wall = (panelX + W - hx,   panelY + H - hy)   displayed as W×H
 *   R=270: wall = (panelX + hy,       panelY + W - hx)   displayed as H×W
 *
 * Derivation:
 *   For 90° CW the transformation of a point (x,y) in an image of size W×H is:
 *   (x,y) → (H − y, x)   (the new image has width=H, height=W)
 *   This satisfies all four corners:
 *     (0,0)→(H,0)  (W,0)→(H,W)  (W,H)→(0,W)  (0,H)→(0,0)
 */
export function transformHoleToWall(params: {
    panelX: number;  // displayed top-left X on wall (mm)
    panelY: number;  // displayed top-left Y on wall (mm)
    panelW: number;  // catalog (natural/unrotated) width (mm)
    panelH: number;  // catalog (natural/unrotated) height (mm)
    rotation: 0 | 90 | 180 | 270;
    holeX: number;   // hole X relative to unrotated top-left (mm)
    holeY: number;   // hole Y relative to unrotated top-left (mm)
}): WallHole & { label: string } {
    const { panelX, panelY, panelW, panelH, rotation, holeX, holeY } = params;
    let wallX: number;
    let wallY: number;

    switch (rotation) {
        case 0:
            wallX = panelX + holeX;
            wallY = panelY + holeY;
            break;
        case 90:
            // Panel displayed as H wide × W tall
            wallX = panelX + (panelH - holeY);
            wallY = panelY + holeX;
            break;
        case 180:
            wallX = panelX + (panelW - holeX);
            wallY = panelY + (panelH - holeY);
            break;
        case 270:
            // Panel displayed as H wide × W tall
            wallX = panelX + holeY;
            wallY = panelY + (panelW - holeX);
            break;
        default:
            throw new Error(`Invalid rotation: ${rotation}`);
    }

    return { wallX, wallY, label: '' };
}

/**
 * Convenience: transform all holes for a panel.
 */
export function transformAllHoles(params: {
    panelX: number;
    panelY: number;
    panelW: number;
    panelH: number;
    rotation: 0 | 90 | 180 | 270;
    holes: HoleInMm[];
}): WallHole[] {
    return params.holes.map((h) => {
        const result = transformHoleToWall({
            panelX: params.panelX,
            panelY: params.panelY,
            panelW: params.panelW,
            panelH: params.panelH,
            rotation: params.rotation,
            holeX: h.xMm,
            holeY: h.yMm,
        });
        return { wallX: result.wallX, wallY: result.wallY, label: h.label };
    });
}

// ---------------------------------------------------------------------------
// Default hole fallback
// ---------------------------------------------------------------------------

/**
 * Returns the default hole for a panel that has no configured holes.
 * One centred hole 50 mm from the top edge of the UNROTATED panel.
 */
export function defaultHoles(widthMm: number): HoleInMm[] {
    return [
        {
            xMm: widthMm / 2,
            yMm: 50,
            label: 'Centre top (default)',
        },
    ];
}

// ---------------------------------------------------------------------------
// Wall → PDF coordinate transformation
// ---------------------------------------------------------------------------

/**
 * Converts a point in wall-mm coordinates to PDF-point coordinates.
 *
 * In PDF, the origin is the BOTTOM-LEFT of the page.
 * On the wall (and in our data model), the origin is the TOP-LEFT.
 *
 * Parameters:
 *   wallX, wallY     — point in wall mm (from top-left)
 *   tileOriginX_mm   — left edge of this PDF tile in wall mm
 *   tileOriginY_mm   — top edge of this PDF tile in wall mm
 *   pageMargin_mm    — margin from page edge to tile content area
 *   pageHeight_mm    — full page height in mm (for PDF y-flip)
 */
export function wallMmToPdfPt(params: {
    wallX: number;
    wallY: number;
    tileOriginX_mm: number;
    tileOriginY_mm: number;
    pageMargin_mm: number;
    pageHeight_mm: number;
}): Point {
    const { wallX, wallY, tileOriginX_mm, tileOriginY_mm, pageMargin_mm, pageHeight_mm } = params;

    // Local position within the tile (mm)
    const localX = wallX - tileOriginX_mm;
    const localY = wallY - tileOriginY_mm;

    // Page position (mm, y-down from top-left of page)
    const pageX_mm = pageMargin_mm + localX;
    const pageY_mm = pageMargin_mm + localY;

    // Convert to PDF points (y-up from bottom-left)
    const pdfX = pageX_mm * MM_TO_PT;
    const pdfY = (pageHeight_mm - pageY_mm) * MM_TO_PT;

    return { x: pdfX, y: pdfY };
}

// ---------------------------------------------------------------------------
// Grid snapping
// ---------------------------------------------------------------------------

export const GRID_MM = 10;

export function snapToGrid(value: number): number {
    return Math.round(value / GRID_MM) * GRID_MM;
}

export function snapPoint(x: number, y: number): Point {
    return { x: snapToGrid(x), y: snapToGrid(y) };
}

// ---------------------------------------------------------------------------
// Paper sizes
// ---------------------------------------------------------------------------

export const PAPER_SIZES = {
    A4: { widthMm: 210, heightMm: 297 },
    LETTER: { widthMm: 215.9, heightMm: 279.4 },
} as const;

export type PaperSizeKey = keyof typeof PAPER_SIZES;

/**
 * Given a paper size and margin, returns the tile content area in mm.
 * The tile area is what fits between the margins on a printed page.
 */
export function getTileArea(
    paperSize: PaperSizeKey,
    marginMm: number
): { tileW: number; tileH: number } {
    const p = PAPER_SIZES[paperSize];
    return {
        tileW: p.widthMm - 2 * marginMm,
        tileH: p.heightMm - 2 * marginMm,
    };
}

/**
 * Compute how many tile columns and rows are needed to cover a wall.
 */
export function computeTileGrid(
    wallW: number,
    wallH: number,
    tileW: number,
    tileH: number
): { cols: number; rows: number } {
    return {
        cols: Math.ceil(wallW / tileW),
        rows: Math.ceil(wallH / tileH),
    };
}

// ---------------------------------------------------------------------------
// Clipping helper — does a panel (or hole) fall within a tile region?
// ---------------------------------------------------------------------------

export function rectIntersects(a: Rect, b: Rect): boolean {
    return (
        a.x < b.x + b.w &&
        a.x + a.w > b.x &&
        a.y < b.y + b.h &&
        a.y + a.h > b.y
    );
}

export function pointInRect(p: Point, r: Rect): boolean {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}