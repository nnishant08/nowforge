export interface AuthCredentials {
  type: 'basic';
  username: string;
  password: string;
}

export interface ApiOptions {
  instanceUrl: string;
  auth: AuthCredentials;
  /** Default timeout in milliseconds. Defaults to 30000. */
  timeout?: number;
}

export interface QueryOptions {
  fields?: string[];
  query?: string;
  limit?: number;
  offset?: number;
  displayValue?: boolean | 'all';
  excludeReferenceLink?: boolean;
  orderBy?: string;
  orderByDesc?: string;
}

export interface TableRecord {
  sys_id: { value: string; display_value?: string };
  [field: string]: { value: string; display_value?: string };
}

export interface TableApiResponse<T = TableRecord> {
  result: T;
}

export interface TableApiListResponse<T = TableRecord> {
  result: T[];
}

export class ServiceNowApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string
  ) {
    super(message);
    this.name = 'ServiceNowApiError';
  }
}

export class ServiceNowApiClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;
  private readonly timeout: number;

  constructor(options: ApiOptions) {
    this.baseUrl = options.instanceUrl.replace(/\/$/, '');
    this.authHeader =
      'Basic ' + btoa(`${options.auth.username}:${options.auth.password}`);
    this.timeout = options.timeout ?? 30000;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));

    if (!response.ok) {
      const text = await response.text();
      throw new ServiceNowApiError(
        `ServiceNow API error ${response.status}: ${response.statusText}`,
        response.status,
        text
      );
    }

    return response.json() as Promise<T>;
  }

  private buildQueryString(options: QueryOptions): string {
    const params = new URLSearchParams();
    if (options.fields?.length) params.set('sysparm_fields', options.fields.join(','));
    if (options.query) params.set('sysparm_query', options.query);
    if (options.limit !== undefined) params.set('sysparm_limit', String(options.limit));
    if (options.offset !== undefined) params.set('sysparm_offset', String(options.offset));
    if (options.displayValue !== undefined)
      params.set('sysparm_display_value', String(options.displayValue));
    if (options.excludeReferenceLink)
      params.set('sysparm_exclude_reference_link', 'true');
    if (options.orderBy) params.set('sysparm_query', `${options.query ?? ''}^ORDERBY${options.orderBy}`);
    if (options.orderByDesc)
      params.set('sysparm_query', `${options.query ?? ''}^ORDERBYDESC${options.orderByDesc}`);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  /** Fetch a single record by sys_id. */
  async getRecord(
    table: string,
    sysId: string,
    options: QueryOptions = {}
  ): Promise<TableRecord> {
    const qs = this.buildQueryString(options);
    const res = await this.request<TableApiResponse>(
      'GET',
      `/api/now/table/${table}/${sysId}${qs}`
    );
    return res.result;
  }

  /** Query multiple records from a table. */
  async getRecords(
    table: string,
    options: QueryOptions = {}
  ): Promise<TableRecord[]> {
    const qs = this.buildQueryString(options);
    const res = await this.request<TableApiListResponse>(
      'GET',
      `/api/now/table/${table}${qs}`
    );
    return res.result;
  }

  /** Create a new record. Returns the created record. */
  async createRecord(
    table: string,
    data: Record<string, unknown>,
    options: QueryOptions = {}
  ): Promise<TableRecord> {
    const qs = this.buildQueryString(options);
    const res = await this.request<TableApiResponse>(
      'POST',
      `/api/now/table/${table}${qs}`,
      data
    );
    return res.result;
  }

  /** Update an existing record by sys_id. Returns the updated record. */
  async updateRecord(
    table: string,
    sysId: string,
    data: Record<string, unknown>,
    options: QueryOptions = {}
  ): Promise<TableRecord> {
    const qs = this.buildQueryString(options);
    const res = await this.request<TableApiResponse>(
      'PATCH',
      `/api/now/table/${table}/${sysId}${qs}`,
      data
    );
    return res.result;
  }

  /** Delete a record by sys_id. */
  async deleteRecord(table: string, sysId: string): Promise<void> {
    await this.request<void>('DELETE', `/api/now/table/${table}/${sysId}`);
  }
}
