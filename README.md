grpc-js-helper
==========

[![CI](https://github.com/magiclen/grpc-js-helper/actions/workflows/ci.yml/badge.svg)](https://github.com/magiclen/grpc-js-helper/actions/workflows/ci.yml)

Some useful items for playing with `@grpc/grpc-js`.

## Usage

```typescript
import { ServiceError, Status, serviceCall } from 'grpc-js-helper';

// ..

try {
    const result = await serviceCall(serviceClient.method1());
} catch (error) {
    if (error instanceof ServiceError) {
        switch (error.code) {
            case Status.UNAVAILABLE:
                // do something
                break;
        }
    }

    // should be unreachable
}
```

## License

[MIT](LICENSE)