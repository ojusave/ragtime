import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, request as httpRequest } from "node:http";
import test from "node:test";
import { gzipSync } from "node:zlib";

import {
  SafeUrlFetchError,
  fetchPublicUrlText,
  isPublicIpAddress,
} from "../dist/pipeline/safe-fetch.js";
import { htmlTextExtractor } from "../dist/pipeline/extract.js";

const PUBLIC_IPV4 = "93.184.216.34";
const PUBLIC_IPV6 = "2606:4700:4700::1111";

async function withServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  try {
    return await run(address.port);
  } finally {
    server.closeAllConnections?.();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function localRequest(port, observed = []) {
  return (url, options, onResponse) => {
    observed.push(url.href);

    assert.equal(typeof options.lookup, "function");
    options.lookup(url.hostname, {}, (error, address, family) => {
      assert.equal(error, null);
      assert.ok(address === PUBLIC_IPV4 || address === PUBLIC_IPV6);
      assert.ok(family === 4 || family === 6);
    });

    return httpRequest(
      {
        headers: options.headers,
        hostname: "127.0.0.1",
        method: options.method,
        path: `${url.pathname}${url.search}`,
        port,
        signal: options.signal,
      },
      onResponse
    );
  };
}

function publicLookup(hosts = []) {
  return async (hostname) => {
    hosts.push(hostname);
    return [{ address: PUBLIC_IPV4, family: 4 }];
  };
}

async function expectSafeError(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof SafeUrlFetchError);
    assert.equal(error.code, code);
    return true;
  });
}

test("extractor preserves uploads and routes URLs through the safe fetcher", async () => {
  assert.equal(
    await htmlTextExtractor.extract({
      sourceType: "upload",
      rawText: "  retained upload text  ",
    }),
    "  retained upload text  "
  );

  await expectSafeError(
    () =>
      htmlTextExtractor.extract({
        sourceType: "url",
        sourceUri: "http://127.0.0.1/private",
      }),
    "UNSAFE_ADDRESS"
  );
});

test("public address classification rejects private and special IPv4/IPv6", () => {
  assert.equal(isPublicIpAddress(PUBLIC_IPV4), true);
  assert.equal(isPublicIpAddress(PUBLIC_IPV6), true);
  assert.equal(isPublicIpAddress("2001:4860:4860::8888"), true);

  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "100.64.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "192.168.0.1",
    "198.51.100.1",
    "224.0.0.1",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "fe80::1",
    "ff02::1",
    "2001:100::1",
    "2001:db8::1",
  ]) {
    assert.equal(isPublicIpAddress(address), false, address);
  }
});

test("rejects non-HTTP schemes and embedded credentials without transport", async () => {
  const failLookup = async () => {
    assert.fail("lookup must not run");
  };
  const failRequest = () => {
    assert.fail("request must not run");
  };

  await expectSafeError(
    () =>
      fetchPublicUrlText(
        "file:///etc/passwd",
        {},
        { lookupAll: failLookup, request: failRequest }
      ),
    "UNSAFE_PROTOCOL"
  );

  const secretUrl =
    "http://user:password@example.test/document?api_key=super-secret#token";
  await assert.rejects(
    () =>
      fetchPublicUrlText(secretUrl, {}, {
        lookupAll: failLookup,
        request: failRequest,
      }),
    (error) => {
      assert.ok(error instanceof SafeUrlFetchError);
      assert.equal(error.code, "URL_CREDENTIALS");
      assert.doesNotMatch(error.message, /user|password|api_key|super-secret|token/);
      return true;
    }
  );
});

test("rejects literal and DNS-resolved non-public targets before transport", async () => {
  const failRequest = () => {
    assert.fail("request must not run");
  };

  for (const url of [
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
    "http://[fd00::1]/",
  ]) {
    await expectSafeError(
      () => fetchPublicUrlText(url, {}, { request: failRequest }),
      "UNSAFE_ADDRESS"
    );
  }

  await expectSafeError(
    () =>
      fetchPublicUrlText("http://mixed.example.test/", {}, {
        lookupAll: async () => [
          { address: PUBLIC_IPV4, family: 4 },
          { address: "10.0.0.2", family: 4 },
        ],
        request: failRequest,
      }),
    "UNSAFE_ADDRESS"
  );
});

test("fetches a public-style HTTP target through validated, pinned hooks", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<main>Hello from a bounded response</main>");
    },
    async (port) => {
      const hosts = [];
      const observed = [];
      const body = await fetchPublicUrlText(
        "http://public.example.test/document?view=full",
        {},
        {
          lookupAll: publicLookup(hosts),
          request: localRequest(port, observed),
        }
      );

      assert.equal(body, "<main>Hello from a bounded response</main>");
      assert.deepEqual(hosts, ["public.example.test"]);
      assert.deepEqual(observed, [
        "http://public.example.test/document?view=full",
      ]);
    }
  );
});

test("revalidates every redirect and blocks a public-to-private hop", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(302, {
        Location: "http://private.example.test/secret",
      });
      response.end();
    },
    async (port) => {
      const hosts = [];
      const observed = [];
      await expectSafeError(
        () =>
          fetchPublicUrlText("http://public.example.test/start", {}, {
            lookupAll: async (hostname) => {
              hosts.push(hostname);
              return [
                hostname === "private.example.test"
                  ? { address: "192.168.1.10", family: 4 }
                  : { address: PUBLIC_IPV4, family: 4 },
              ];
            },
            request: localRequest(port, observed),
          }),
        "UNSAFE_ADDRESS"
      );

      assert.deepEqual(hosts, [
        "public.example.test",
        "private.example.test",
      ]);
      assert.equal(observed.length, 1);
    }
  );
});

test("bounds redirects", async () => {
  await withServer(
    (request, response) => {
      const hop = Number(new URL(request.url, "http://local").searchParams.get("hop"));
      response.writeHead(302, {
        Location: `http://public.example.test/redirect?hop=${hop + 1}`,
      });
      response.end();
    },
    async (port) => {
      const observed = [];
      await expectSafeError(
        () =>
          fetchPublicUrlText(
            "http://public.example.test/redirect?hop=0",
            { maxRedirects: 1 },
            {
              lookupAll: publicLookup(),
              request: localRequest(port, observed),
            }
          ),
        "TOO_MANY_REDIRECTS"
      );
      assert.equal(observed.length, 2);
    }
  );
});

test("enforces streamed byte limits including the exact boundary", async () => {
  await withServer(
    (request, response) => {
      if (request.url === "/exact") {
        response.write("1234");
        response.end("5678");
        return;
      }
      response.write("1234");
      response.end("56789");
    },
    async (port) => {
      const dependencies = {
        lookupAll: publicLookup(),
        request: localRequest(port),
      };
      assert.equal(
        await fetchPublicUrlText(
          "http://public.example.test/exact",
          { maxBytes: 8 },
          dependencies
        ),
        "12345678"
      );
      await expectSafeError(
        () =>
          fetchPublicUrlText(
            "http://public.example.test/too-large",
            { maxBytes: 8 },
            dependencies
          ),
        "RESPONSE_TOO_LARGE"
      );
    }
  );
});

test("enforces the byte limit after decompression", async () => {
  const compressed = gzipSync("A".repeat(256));
  assert.ok(compressed.byteLength < 64);

  await withServer(
    (_request, response) => {
      response.writeHead(200, { "Content-Encoding": "gzip" });
      response.end(compressed);
    },
    async (port) => {
      await expectSafeError(
        () =>
          fetchPublicUrlText(
            "http://public.example.test/compressed",
            { maxBytes: 64 },
            {
              lookupAll: publicLookup(),
              request: localRequest(port),
            }
          ),
        "RESPONSE_TOO_LARGE"
      );
    }
  );
});

test("enforces a total request timeout", async () => {
  await withServer(
    () => {
      // Keep the connection open until the client-side deadline aborts it.
    },
    async (port) => {
      await expectSafeError(
        () =>
          fetchPublicUrlText(
            "http://public.example.test/slow",
            { timeoutMs: 40 },
            {
              lookupAll: publicLookup(),
              request: localRequest(port),
            }
          ),
        "TIMEOUT"
      );
    }
  );
});

test("HTTP failures never disclose URL secrets", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(503);
      response.end("unavailable");
    },
    async (port) => {
      const source =
        "http://public.example.test/document?api_key=super-secret#fragment-secret";
      await assert.rejects(
        () =>
          fetchPublicUrlText(source, {}, {
            lookupAll: publicLookup(),
            request: localRequest(port),
          }),
        (error) => {
          assert.ok(error instanceof SafeUrlFetchError);
          assert.equal(error.code, "HTTP_STATUS");
          assert.equal(
            error.message,
            "Document URL fetch failed with HTTP status 503"
          );
          assert.doesNotMatch(
            error.message,
            /api_key|super-secret|fragment-secret/
          );
          return true;
        }
      );
    }
  );
});

test("transport failures never disclose URL secrets", async () => {
  const source =
    "http://public.example.test/document?api_key=super-secret#fragment-secret";
  await assert.rejects(
    () =>
      fetchPublicUrlText(source, {}, {
        lookupAll: publicLookup(),
        request: () => {
          throw new Error(`socket failed while requesting ${source}`);
        },
      }),
    (error) => {
      assert.ok(error instanceof SafeUrlFetchError);
      assert.equal(error.code, "REQUEST_FAILED");
      assert.equal(error.message, "Document URL request failed");
      assert.doesNotMatch(
        error.message,
        /api_key|super-secret|fragment-secret/
      );
      return true;
    }
  );
});
