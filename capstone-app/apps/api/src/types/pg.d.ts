declare module "pg" {
  export class Pool {
    constructor(config?: {
      connectionString?: string;
      ssl?: boolean | { rejectUnauthorized?: boolean };
    });
    on(event: "connect", listener: () => void): void;
    on(event: "error", listener: (error: Error) => void): void;
    query<T = any>(
      text: string,
      params?: any[]
    ): Promise<{ rows: T[] }>;
    end(): Promise<void>;
  }
}
