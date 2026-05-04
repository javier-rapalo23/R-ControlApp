declare module '@op-engineering/op-sqlite' {
  export type QueryResult = {
    rows: Array<Record<string, unknown>>;
  };

  export type Database = {
    execute: (query: string, params?: Array<string | number>) => Promise<QueryResult>;
    close: () => void;
  };

  export function open(options: {
    name: string;
    location?: string;
    encryptionKey?: string;
  }): Database;
}
