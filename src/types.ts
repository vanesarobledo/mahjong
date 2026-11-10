export type Tile = {
    id: number;
    src: string;
    name: string;
    rotationY: number;
    rotationZ: number;
    isFaceUp: boolean;
    x: number,
    y: number,
    zIndex: number
};

export type TileData = {
    id: number;
    src: string;
    name: string;
}

export type Rect = {
    top: number,
    right: number,
    left: number,
    bottom: number
}