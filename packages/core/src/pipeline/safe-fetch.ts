import { lookup as dnsLookup } from "node:dns/promises";
import {
  request as httpRequest,
  type ClientRequest,
  type IncomingMessage,
  type RequestOptions,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";
import { Transform, Writable, type TransformCallback } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
} from "node:zlib";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const blockedIpv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blockedIpv4.addSubnet(network, prefix, "ipv4");
}

const globalIpv6 = new BlockList();
globalIpv6.addSubnet("2000::", 3, "ipv6");

const blockedIpv6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["3fff::", 20],
] as const) {
  blockedIpv6.addSubnet(network, prefix, "ipv6");
}

export type SafeUrlFetchErrorCode =
  | "INVALID_URL"
  | "UNSAFE_PROTOCOL"
  | "URL_CREDENTIALS"
  | "UNSAFE_ADDRESS"
  | "LOOKUP_FAILED"
  | "TOO_MANY_REDIRECTS"
  | "HTTP_STATUS"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_ENCODING"
  | "TIMEOUT"
  | "REQUEST_FAILED";

export class SafeUrlFetchError extends Error {
  override readonly name = "SafeUrlFetchError";

  constructor(
    readonly code: SafeUrlFetchErrorCode,
    message: string
  ) {
    super(message);
  }
}

export type SafeUrlFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

export type ResolvedAddress = {
  address: string;
  family: 4 | 6;
};

export type LookupAll = (
  hostname: string
) => Promise<readonly ResolvedAddress[]>;

export type RequestImplementation = (
  url: URL,
  options: RequestOptions,
  onResponse: (response: IncomingMessage) => void
) => ClientRequest;

export type SafeUrlFetchDependencies = {
  lookupAll?: LookupAll;
  request?: RequestImplementation;
};

function normalizedIp(address: string): string {
  const unbracketed =
    address.startsWith("[") && address.endsWith("]")
      ? address.slice(1, -1)
      : address;
  const zoneIndex = unbracketed.indexOf("%");
  return zoneIndex === -1 ? unbracketed : unbracketed.slice(0, zoneIndex);
}

export function isPublicIpAddress(address: string): boolean {
  const normalized = normalizedIp(address);
  const family = isIP(normalized);
  if (family === 4) return !blockedIpv4.check(normalized, "ipv4");
  if (family === 6) {
    return (
      globalIpv6.check(normalized, "ipv6") &&
      !blockedIpv6.check(normalized, "ipv6")
    );
  }
  return false;
}

function safeError(
  code: SafeUrlFetchErrorCode,
  message: string
): SafeUrlFetchError {
  return new SafeUrlFetchError(code, message);
}

function parseAndValidateUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = input instanceof URL ? new URL(input.href) : new URL(input);
  } catch {
    throw safeError("INVALID_URL", "Invalid document URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw safeError(
      "UNSAFE_PROTOCOL",
      "Document URL must use HTTP or HTTPS"
    );
  }
  if (url.username || url.password) {
    throw safeError(
      "URL_CREDENTIALS",
      "Document URL must not include credentials"
    );
  }
  if (!url.hostname) {
    throw safeError("INVALID_URL", "Document URL must include a host");
  }
  return url;
}

function validatePositiveInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`);
  }
  return value;
}

function validateRedirectCount(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError("maxRedirects must be a non-negative integer");
  }
  return value;
}

function abortError(): SafeUrlFetchError {
  return safeError("TIMEOUT", "Document URL request timed out");
}

async function withAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal
): Promise<T> {
  if (signal.aborted) throw abortError();

  return await new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      }
    );
  });
}

async function defaultLookupAll(
  hostname: string
): Promise<readonly ResolvedAddress[]> {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.flatMap((result) =>
    result.family === 4 || result.family === 6
      ? [{ address: result.address, family: result.family }]
      : []
  );
}

async function resolvePublicTarget(
  url: URL,
  lookupAll: LookupAll,
  signal: AbortSignal
): Promise<ResolvedAddress> {
  const hostname = normalizedIp(url.hostname);
  const literalFamily = isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    if (!isPublicIpAddress(hostname)) {
      throw safeError(
        "UNSAFE_ADDRESS",
        "Document URL resolves to a non-public address"
      );
    }
    return { address: hostname, family: literalFamily };
  }

  let results: readonly ResolvedAddress[];
  try {
    results = await withAbort(lookupAll(hostname), signal);
  } catch (error) {
    if (error instanceof SafeUrlFetchError) throw error;
    throw safeError("LOOKUP_FAILED", "Document URL host lookup failed");
  }

  if (results.length === 0) {
    throw safeError("LOOKUP_FAILED", "Document URL host lookup failed");
  }

  const validated = results.map((result) => {
    const address = normalizedIp(result.address);
    if (isIP(address) !== result.family || !isPublicIpAddress(address)) {
      throw safeError(
        "UNSAFE_ADDRESS",
        "Document URL resolves to a non-public address"
      );
    }
    return { address, family: result.family };
  });

  return validated[0]!;
}

function defaultRequest(
  url: URL,
  options: RequestOptions,
  onResponse: (response: IncomingMessage) => void
): ClientRequest {
  return url.protocol === "https:"
    ? httpsRequest(url, options, onResponse)
    : httpRequest(url, options, onResponse);
}

function pinnedLookup(
  target: ResolvedAddress
): NonNullable<RequestOptions["lookup"]> {
  return ((_hostname, options, callback) => {
    if (typeof options !== "number" && options.all) {
      callback(null, [target]);
      return;
    }
    callback(null, target.address, target.family);
  }) as NonNullable<RequestOptions["lookup"]>;
}

async function openResponse(
  url: URL,
  target: ResolvedAddress,
  signal: AbortSignal,
  requestImplementation: RequestImplementation
): Promise<IncomingMessage> {
  return await new Promise<IncomingMessage>((resolve, reject) => {
    let responseStarted = false;
    const request = requestImplementation(
      url,
      {
        agent: false,
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8",
          "Accept-Encoding": "gzip, deflate, br",
          "User-Agent": "RAGtime/1.0 (document ingestion)",
        },
        lookup: pinnedLookup(target),
        method: "GET",
        signal,
      },
      (response) => {
        responseStarted = true;
        resolve(response);
      }
    );
    request.once("error", (error) => {
      if (!responseStarted) reject(error);
    });
    request.end();
  });
}

class ByteLimit extends Transform {
  private bytes = 0;

  constructor(private readonly maxBytes: number) {
    super();
  }

  override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: TransformCallback
  ): void {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding);
    this.bytes += buffer.byteLength;
    if (this.bytes > this.maxBytes) {
      callback(
        safeError(
          "RESPONSE_TOO_LARGE",
          "Document URL response exceeds the maximum size"
        )
      );
      return;
    }
    callback(null, buffer);
  }
}

class BufferCollector extends Writable {
  private readonly chunks: Buffer[] = [];

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    this.chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding)
    );
    callback();
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}

function responseEncoding(response: IncomingMessage): string {
  const value = response.headers["content-encoding"];
  return (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase() ?? "";
}

function decoderFor(response: IncomingMessage): Transform | undefined {
  switch (responseEncoding(response)) {
    case "":
    case "identity":
      return undefined;
    case "gzip":
    case "x-gzip":
      return createGunzip();
    case "deflate":
      return createInflate();
    case "br":
      return createBrotliDecompress();
    default:
      throw safeError(
        "UNSUPPORTED_ENCODING",
        "Document URL response uses an unsupported content encoding"
      );
  }
}

async function readBoundedBody(
  response: IncomingMessage,
  maxBytes: number,
  signal: AbortSignal
): Promise<string> {
  const contentLength = response.headers["content-length"];
  if (typeof contentLength === "string") {
    const announcedBytes = Number(contentLength);
    if (Number.isFinite(announcedBytes) && announcedBytes > maxBytes) {
      response.destroy();
      throw safeError(
        "RESPONSE_TOO_LARGE",
        "Document URL response exceeds the maximum size"
      );
    }
  }

  const collector = new BufferCollector();
  try {
    const decoder = decoderFor(response);
    if (decoder) {
      await pipeline(
        response,
        new ByteLimit(maxBytes),
        decoder,
        new ByteLimit(maxBytes),
        collector
      );
    } else {
      await pipeline(response, new ByteLimit(maxBytes), collector);
    }
  } catch (error) {
    if (error instanceof SafeUrlFetchError) throw error;
    if (signal.aborted) throw abortError();
    throw safeError("REQUEST_FAILED", "Document URL response could not be read");
  }
  return collector.toBuffer().toString("utf8");
}

function statusError(statusCode: number | undefined): SafeUrlFetchError {
  if (statusCode && statusCode >= 100 && statusCode <= 599) {
    return safeError(
      "HTTP_STATUS",
      `Document URL fetch failed with HTTP status ${statusCode}`
    );
  }
  return safeError("HTTP_STATUS", "Document URL returned an invalid HTTP response");
}

export async function fetchPublicUrlText(
  sourceUri: string,
  options: SafeUrlFetchOptions = {},
  dependencies: SafeUrlFetchDependencies = {}
): Promise<string> {
  const timeoutMs = validatePositiveInteger(
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    "timeoutMs"
  );
  const maxBytes = validatePositiveInteger(
    options.maxBytes ?? DEFAULT_MAX_BYTES,
    "maxBytes"
  );
  const maxRedirects = validateRedirectCount(
    options.maxRedirects ?? DEFAULT_MAX_REDIRECTS
  );
  const lookupAll = dependencies.lookupAll ?? defaultLookupAll;
  const requestImplementation = dependencies.request ?? defaultRequest;
  const signal = AbortSignal.timeout(timeoutMs);

  try {
    let currentUrl = parseAndValidateUrl(sourceUri);
    let redirects = 0;

    while (true) {
      const target = await resolvePublicTarget(currentUrl, lookupAll, signal);
      const response = await openResponse(
        currentUrl,
        target,
        signal,
        requestImplementation
      );
      const statusCode = response.statusCode;
      const location = response.headers.location;

      if (statusCode && REDIRECT_STATUSES.has(statusCode) && location) {
        response.destroy();
        if (redirects >= maxRedirects) {
          throw safeError(
            "TOO_MANY_REDIRECTS",
            "Document URL redirected too many times"
          );
        }

        let redirected: URL;
        try {
          redirected = new URL(location, currentUrl);
        } catch {
          throw safeError("INVALID_URL", "Document URL redirect is invalid");
        }
        currentUrl = parseAndValidateUrl(redirected);
        redirects += 1;
        continue;
      }

      if (!statusCode || statusCode < 200 || statusCode >= 300) {
        response.destroy();
        throw statusError(statusCode);
      }

      return await readBoundedBody(response, maxBytes, signal);
    }
  } catch (error) {
    if (error instanceof SafeUrlFetchError) throw error;
    if (signal.aborted) throw abortError();
    throw safeError("REQUEST_FAILED", "Document URL request failed");
  }
}
