grpc-js-helper
==========

[![CI](https://github.com/magiclen/grpc-js-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/magiclen/grpc-js-helper/actions/workflows/ci.yml)

Some useful items for playing with `@grpc/grpc-js`.

## Usage

```typescript
import { ServiceError, ServiceStatus, serviceCall } from "grpc-js-helper";

// ..

try {
    const result = await serviceCall(serviceClient.method1());
} catch (error) {
    if (error instanceof ServiceError) {
        switch (error.code) {
            case ServiceStatus.UNAVAILABLE:
                // do something
                break;
        }
    } else {
        // should be unreachable
    }
}
```

### Retry on RST_STREAM Errors

Pass a function instead of a promise, so that `serviceCall` can call it again when it fails with an error like `13 INTERNAL: Received RST_STREAM with code 2 (Internal server error)` (see [grpc/grpc-node#2647](https://github.com/grpc/grpc-node/issues/2647)).

```typescript
// retry at most 2 times by default (max 3 calls)
const result = await serviceCall(() => serviceClient.method1());

// set the max retry count, or use `0` to disable the retry
const result2 = await serviceCall(() => serviceClient.method1(), { internalErrorRetryMaxCount: 5 });
```

A promise cannot be called again, so `serviceCall(serviceClient.method1())` never retries.

### Other Helpers

```typescript
import { ServiceStatus, getServiceStatus, isServiceError } from "grpc-js-helper";

// ..

if (isServiceError(error)) {
    // `error` is a `ServiceError` from `@grpc/grpc-js`
}

if (getServiceStatus(error) === ServiceStatus.NOT_FOUND) {
    // do something
}
```

## License

[MIT](LICENSE)
