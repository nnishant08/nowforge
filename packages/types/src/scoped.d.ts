/**
 * ServiceNow scoped API type definitions.
 * Available in Scoped Applications, Scripted REST APIs, and Flow Designer scripts.
 */

declare namespace sn_ws {
  class RESTMessageV2 {
    constructor(name?: string, methodName?: string);
    /** Set the HTTP method (GET, POST, PUT, PATCH, DELETE). */
    setHttpMethod(method: string): void;
    /** Set the endpoint URL. */
    setEndpoint(endpoint: string): void;
    /** Set a request header. */
    setRequestHeader(name: string, value: string): void;
    /** Set basic auth credentials. */
    setBasicAuth(userName: string, userPassword: string): void;
    /** Set the request body. */
    setRequestBody(body: string): void;
    /** Set a URL query parameter. */
    setQueryParameter(name: string, value: string): void;
    /** Execute and return the response. */
    execute(): RESTResponseV2;
    /** Execute asynchronously. */
    executeAsync(): RESTResponseV2;
  }

  class RESTResponseV2 {
    /** Get response body as a string. */
    getBody(): string;
    /** Get an HTTP response header. */
    getHeader(name: string): string;
    /** Get all response headers as an object. */
    getHeaders(): Record<string, string>;
    /** Get the HTTP status code. */
    getStatusCode(): number;
    /** Whether the request encountered an error. */
    haveError(): boolean;
    /** Get the error message if any. */
    getErrorMessage(): string;
  }

  class SOAPMessageV2 {
    constructor(soapMessageName?: string, methodName?: string);
    setBasicAuth(userName: string, userPassword: string): void;
    setStringParameterNoEscape(name: string, value: string): void;
    execute(): SOAPResponseV2;
    executeAsync(): SOAPResponseV2;
  }

  class SOAPResponseV2 {
    getBody(): string;
    getStatusCode(): number;
    haveError(): boolean;
    getErrorMessage(): string;
  }

  /** Available in Scripted REST API scripts. */
  const request: RESTAPIRequest;
  const response: RESTAPIResponse;

  class RESTAPIRequest {
    /** Request body as a string. */
    readonly body: RESTAPIRequestBody;
    /** Path parameters (from URL template). */
    readonly pathParams: Record<string, string>;
    /** Query parameters. */
    readonly queryParams: Record<string, string[]>;
    /** Request headers. */
    readonly headers: Record<string, string>;
    /** Get a query parameter value. */
    getQueryParameter(name: string): string;
    /** Get a path parameter value. */
    getPathParameter(name: string): string;
    /** Get a header value. */
    getHeader(name: string): string;
  }

  class RESTAPIRequestBody {
    /** Body as a plain string. */
    readonly dataString: string;
    /** Body parsed as a JS object (if JSON). */
    readonly data: unknown;
  }

  class RESTAPIResponse {
    /** Set the response body. */
    setBody(body: unknown): void;
    /** Set an HTTP status code. */
    setStatus(status: number): void;
    /** Set a response header. */
    setHeader(name: string, value: string): void;
    /** Set the Content-Type header. */
    setContentType(contentType: string): void;
  }
}

declare namespace sn_fd {
  class FlowAPI {
    /** Start a flow by name. */
    static startFlow(
      flowName: string,
      currentRecord?: GlideRecord,
      operation?: string,
      inputs?: Record<string, unknown>
    ): void;

    /** Start a subflow by name. */
    static startSubflow(
      subflowName: string,
      inputs?: Record<string, unknown>
    ): Record<string, unknown>;

    /** Execute an action by name. */
    static executeAction(
      actionName: string,
      inputs?: Record<string, unknown>
    ): Record<string, unknown>;
  }
}
