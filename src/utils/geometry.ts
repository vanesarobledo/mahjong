export type Point = {
    x: number, y: number
}

export type Rect = {
    top: number,
    right: number,
    left: number,
    bottom: number
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
    const xOverlap = !(b.left > a.right) && !(b.right < a.left);
    const yOverlap = !(b.top > a.bottom) && !(b.bottom < a.top);

    return xOverlap && yOverlap;
}

export function hasMoved(from: Point, to: Point, threshold: number): boolean {
    let dx = to.x - from.x;
    let dy = to.y - from.y;

    return Math.hypot(dx, dy) > threshold
}