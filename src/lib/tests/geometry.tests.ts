/**
 * geometry.test.ts
 *
 * These tests verify the critical hole-position transformation that tells
 * customers where to drill. Wrong results here mean holes in the wrong wall.
 */

import { describe, test, expect } from '@jest/globals';
import {
    transformHoleToWall,
    transformAllHoles,
    wallMmToPdfPt,
    snapToGrid,
    panelDisplaySize,
    computeTileGrid,
    MM_TO_PT,
    defaultHoles,
} from '../geometry';

// ---------------------------------------------------------------------------
// Helper — assert floating point close enough (0.001 mm tolerance)
// ---------------------------------------------------------------------------
function expectClose(actual: number, expected: number, tolerance = 0.001) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

// ---------------------------------------------------------------------------
// transformHoleToWall — rotation = 0
// ---------------------------------------------------------------------------

describe('transformHoleToWall — rotation 0', () => {
    const base = { panelX: 100, panelY: 200, panelW: 300, panelH: 200, rotation: 0 as const };

    test('top-left corner hole', () => {
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 0 });
        expect(r.wallX).toBe(100);
        expect(r.wallY).toBe(200);
    });

    test('top-right corner hole', () => {
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 0 });
        expect(r.wallX).toBe(400);
        expect(r.wallY).toBe(200);
    });

    test('bottom-right corner hole', () => {
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 200 });
        expect(r.wallX).toBe(400);
        expect(r.wallY).toBe(400);
    });

    test('bottom-left corner hole', () => {
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 200 });
        expect(r.wallX).toBe(100);
        expect(r.wallY).toBe(400);
    });

    test('centred hole', () => {
        const r = transformHoleToWall({ ...base, holeX: 150, holeY: 100 });
        expect(r.wallX).toBe(250);
        expect(r.wallY).toBe(300);
    });

    test('default hole (centre top 50mm)', () => {
        // panel 300×200, default hole at (150, 50)
        const r = transformHoleToWall({ ...base, holeX: 150, holeY: 50 });
        expect(r.wallX).toBe(250);
        expect(r.wallY).toBe(250);
    });
});

// ---------------------------------------------------------------------------
// transformHoleToWall — rotation 90°
// ---------------------------------------------------------------------------

describe('transformHoleToWall — rotation 90', () => {
    // Panel W=300, H=200; displayed as 200 wide × 300 tall on wall
    const base = { panelX: 50, panelY: 50, panelW: 300, panelH: 200, rotation: 90 as const };

    test('original top-left → displayed top-right', () => {
        // (0,0) → (H-0, 0) = (200, 0) + panel offset
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 0 });
        expect(r.wallX).toBe(50 + 200); // 250
        expect(r.wallY).toBe(50 + 0);   // 50
    });

    test('original top-right → displayed bottom-right', () => {
        // (300,0) → (H-0, 300) = (200, 300) + panel offset
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 0 });
        expect(r.wallX).toBe(50 + 200); // 250
        expect(r.wallY).toBe(50 + 300); // 350
    });

    test('original bottom-left → displayed top-left', () => {
        // (0,200) → (H-200, 0) = (0, 0) + panel offset
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 200 });
        expect(r.wallX).toBe(50 + 0);  // 50
        expect(r.wallY).toBe(50 + 0);  // 50
    });

    test('original bottom-right → displayed bottom-left', () => {
        // (300,200) → (H-200, 300) = (0, 300) + panel offset
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 200 });
        expect(r.wallX).toBe(50 + 0);   // 50
        expect(r.wallY).toBe(50 + 300); // 350
    });

    test('centre hole', () => {
        // (150, 100) → (H-100, 150) = (100, 150) + panel offset
        const r = transformHoleToWall({ ...base, holeX: 150, holeY: 100 });
        expect(r.wallX).toBe(50 + 100); // 150
        expect(r.wallY).toBe(50 + 150); // 200
    });
});

// ---------------------------------------------------------------------------
// transformHoleToWall — rotation 180°
// ---------------------------------------------------------------------------

describe('transformHoleToWall — rotation 180', () => {
    const base = { panelX: 100, panelY: 100, panelW: 300, panelH: 200, rotation: 180 as const };

    test('original top-left → displayed bottom-right', () => {
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 0 });
        expect(r.wallX).toBe(100 + 300); // 400
        expect(r.wallY).toBe(100 + 200); // 300
    });

    test('original bottom-right → displayed top-left', () => {
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 200 });
        expect(r.wallX).toBe(100 + 0); // 100
        expect(r.wallY).toBe(100 + 0); // 100
    });

    test('centre hole is invariant under 180°', () => {
        // Centre of panel is at panelX + W/2, panelY + H/2
        // (150,100) → (W-150, H-100) = (150,100) → same offset from origin
        const r = transformHoleToWall({ ...base, holeX: 150, holeY: 100 });
        expect(r.wallX).toBe(100 + 150); // 250
        expect(r.wallY).toBe(100 + 100); // 200
    });
});

// ---------------------------------------------------------------------------
// transformHoleToWall — rotation 270°
// ---------------------------------------------------------------------------

describe('transformHoleToWall — rotation 270', () => {
    // Panel W=300, H=200; displayed as 200 wide × 300 tall on wall
    const base = { panelX: 0, panelY: 0, panelW: 300, panelH: 200, rotation: 270 as const };

    test('original top-left → displayed bottom-left', () => {
        // (0,0) → (0, W-0) = (0, 300)
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 0 });
        expect(r.wallX).toBe(0);
        expect(r.wallY).toBe(300);
    });

    test('original top-right → displayed top-left', () => {
        // (300,0) → (0, W-300) = (0, 0)
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 0 });
        expect(r.wallX).toBe(0);
        expect(r.wallY).toBe(0);
    });

    test('original bottom-left → displayed bottom-right', () => {
        // (0,200) → (200, W-0) = (200, 300)
        const r = transformHoleToWall({ ...base, holeX: 0, holeY: 200 });
        expect(r.wallX).toBe(200);
        expect(r.wallY).toBe(300);
    });

    test('original bottom-right → displayed top-right', () => {
        // (300,200) → (200, W-300) = (200, 0)
        const r = transformHoleToWall({ ...base, holeX: 300, holeY: 200 });
        expect(r.wallX).toBe(200);
        expect(r.wallY).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 90→270 inverse check: applying 90 then 270 should return to origin
// ---------------------------------------------------------------------------

describe('rotation consistency', () => {
    test('90° and 270° are inverses — hole round-trip', () => {
        const panelX = 0, panelY = 0, W = 400, H = 250;
        // Place a hole at (80, 30) in original coords
        // After 90°: some wall position
        // If we "un-rotate" by treating the 90° result as panel position
        // for a 270° rotation, we should get back (80, 30) relative to (0,0)
        const r90 = transformHoleToWall({ panelX, panelY, panelW: W, panelH: H, rotation: 90, holeX: 80, holeY: 30 });
        // Now the "panel" has been rotated 90°; its display is H×W
        // To reverse: rotate 270° with the NEW panel dimensions (displayW=H, displayH=W)
        const r270 = transformHoleToWall({
            panelX: 0, panelY: 0,
            panelW: H, panelH: W, // note: dimensions swapped for the rotated panel
            rotation: 270,
            holeX: r90.wallX, holeY: r90.wallY,
        });
        expectClose(r270.wallX, 80);
        expectClose(r270.wallY, 30);
    });
});

// ---------------------------------------------------------------------------
// wallMmToPdfPt
// ---------------------------------------------------------------------------

describe('wallMmToPdfPt', () => {
    const PAGE_MARGIN = 10;
    const PAGE_H = 297; // A4

    test('tile origin at wall origin, point at (0,0) → margin position', () => {
        const pt = wallMmToPdfPt({
            wallX: 0, wallY: 0,
            tileOriginX_mm: 0, tileOriginY_mm: 0,
            pageMargin_mm: PAGE_MARGIN,
            pageHeight_mm: PAGE_H,
        });
        // x = 10mm → 10 * MM_TO_PT
        expectClose(pt.x, PAGE_MARGIN * MM_TO_PT);
        // y = (297 - 10)mm from bottom = 287 * MM_TO_PT
        expectClose(pt.y, (PAGE_H - PAGE_MARGIN) * MM_TO_PT);
    });

    test('MM_TO_PT constant accuracy', () => {
        // 25.4 mm = 1 inch = 72 pts
        expectClose(25.4 * MM_TO_PT, 72, 0.0001);
    });

    test('100 mm converts to correct pts', () => {
        // 100mm = 283.4645... pts
        expectClose(100 * MM_TO_PT, 283.4645669, 0.0001);
    });

    test('2000mm wall at 100% print is within ±2mm tolerance', () => {
        // Across a 2000mm span, accumulated floating point error should be negligible
        const pt1 = wallMmToPdfPt({
            wallX: 0, wallY: 0,
            tileOriginX_mm: 0, tileOriginY_mm: 0,
            pageMargin_mm: 0, pageHeight_mm: 2000,
        });
        const pt2 = wallMmToPdfPt({
            wallX: 2000, wallY: 0,
            tileOriginX_mm: 0, tileOriginY_mm: 0,
            pageMargin_mm: 0, pageHeight_mm: 2000,
        });
        const spanPt = pt2.x - pt1.x;
        const expectedPt = 2000 * MM_TO_PT;
        const errorMm = Math.abs(spanPt - expectedPt) / MM_TO_PT;
        expect(errorMm).toBeLessThan(0.001); // well within ±2mm
    });
});

// ---------------------------------------------------------------------------
// Grid snapping
// ---------------------------------------------------------------------------

describe('snapToGrid', () => {
    test('already on grid', () => expect(snapToGrid(100)).toBe(100));
    test('rounds up', () => expect(snapToGrid(106)).toBe(110));
    test('rounds down', () => expect(snapToGrid(104)).toBe(100));
    test('exact midpoint rounds up', () => expect(snapToGrid(105)).toBe(110));
    test('negative value', () => expect(snapToGrid(-15)).toBe(-20));
    test('zero', () => expect(snapToGrid(0)).toBe(0));
});

// ---------------------------------------------------------------------------
// panelDisplaySize
// ---------------------------------------------------------------------------

describe('panelDisplaySize', () => {
    test('0°: unchanged', () => {
        const { displayW, displayH } = panelDisplaySize(300, 200, 0);
        expect(displayW).toBe(300);
        expect(displayH).toBe(200);
    });
    test('90°: swapped', () => {
        const { displayW, displayH } = panelDisplaySize(300, 200, 90);
        expect(displayW).toBe(200);
        expect(displayH).toBe(300);
    });
    test('180°: unchanged', () => {
        const { displayW, displayH } = panelDisplaySize(300, 200, 180);
        expect(displayW).toBe(300);
        expect(displayH).toBe(200);
    });
    test('270°: swapped', () => {
        const { displayW, displayH } = panelDisplaySize(300, 200, 270);
        expect(displayW).toBe(200);
        expect(displayH).toBe(300);
    });
});

// ---------------------------------------------------------------------------
// Tile grid calculation
// ---------------------------------------------------------------------------

describe('computeTileGrid', () => {
    test('wall exactly fits tiles', () => {
        const { cols, rows } = computeTileGrid(400, 600, 200, 300);
        expect(cols).toBe(2);
        expect(rows).toBe(2);
    });

    test('wall needs partial tile', () => {
        const { cols, rows } = computeTileGrid(450, 650, 200, 300);
        expect(cols).toBe(3);
        expect(rows).toBe(3);
    });

    test('A4 tile area covers 2m × 1.5m wall', () => {
        // A4 tile area at 10mm margin: 190×277mm
        const { cols, rows } = computeTileGrid(2000, 1500, 190, 277);
        expect(cols).toBe(11); // ceil(2000/190) = 11
        expect(rows).toBe(6);  // ceil(1500/277) = 6
    });
});

// ---------------------------------------------------------------------------
// Default holes
// ---------------------------------------------------------------------------

describe('defaultHoles', () => {
    test('single centred hole 50mm from top', () => {
        const holes = defaultHoles(300);
        expect(holes).toHaveLength(1);
        expect(holes[0].xMm).toBe(150);
        expect(holes[0].yMm).toBe(50);
    });
});

// ---------------------------------------------------------------------------
// transformAllHoles — batch transform
// ---------------------------------------------------------------------------

describe('transformAllHoles', () => {
    test('two holes at rotation 0', () => {
        const result = transformAllHoles({
            panelX: 0, panelY: 0, panelW: 400, panelH: 300, rotation: 0,
            holes: [
                { xMm: 50, yMm: 50, label: 'left' },
                { xMm: 350, yMm: 50, label: 'right' },
            ],
        });
        expect(result[0]).toEqual({ wallX: 50, wallY: 50, label: 'left' });
        expect(result[1]).toEqual({ wallX: 350, wallY: 50, label: 'right' });
    });

    test('two holes at rotation 90', () => {
        // W=400, H=300, rotation 90
        // (50,50)  → (H-50, 50)  = (250, 50)
        // (350,50) → (H-50, 350) = (250, 350)
        const result = transformAllHoles({
            panelX: 0, panelY: 0, panelW: 400, panelH: 300, rotation: 90,
            holes: [
                { xMm: 50, yMm: 50, label: 'left' },
                { xMm: 350, yMm: 50, label: 'right' },
            ],
        });
        expectClose(result[0].wallX, 250);
        expectClose(result[0].wallY, 50);
        expectClose(result[1].wallX, 250);
        expectClose(result[1].wallY, 350);
    });
});