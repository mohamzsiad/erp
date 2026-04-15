/// <reference types="vite/client" />

// Allow importing CSS files as side effects
declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

// xlsx is installed at runtime; stub for TS compilation
declare module 'xlsx' {
  export const utils: {
    book_new(): any;
    aoa_to_sheet(data: any[][]): any;
    book_append_sheet(wb: any, ws: any, name?: string): void;
    decode_range(s: string): { s: { r: number; c: number }; e: { r: number; c: number } };
    encode_cell(c: { r: number; c: number }): string;
  };
  export type WorkSheet = any;
  export type WorkBook = any;
  export function writeFile(wb: any, filename: string): void;
}
