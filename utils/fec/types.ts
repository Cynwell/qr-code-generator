// FEC types - generic interface for future backend swaps

export interface FecEncoder {
  readonly scheme: string;
  readonly sourceBlockCount: number;
  readonly blockSize: number;

  getSourceSymbol(index: number): Uint8Array;
  getRepairSymbol(symbolId: number): Uint8Array;
}

export interface DecodeUpdate {
  newlyRecovered: number[];
  isComplete: boolean;
}

export interface FecDecoder {
  readonly scheme: string;
  readonly K: number;
  readonly blockSize: number;
  addSourceSymbol(index: number, data: Uint8Array): DecodeUpdate;
  addRepairSymbol(symbolId: number, data: Uint8Array): DecodeUpdate;
  isComplete(): boolean;
  getRecoveredData(originalLength: number): Uint8Array | null;
  getRecoveredFlags(): boolean[];
  getRecoveredCount(): number;
  getPendingCount(): number;
}
