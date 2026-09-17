import type { ServiceError as ServiceErrorType } from "@grpc/grpc-js";
import { Metadata, status as ServiceStatus } from "@grpc/grpc-js";

const DEFAULT_INTERNAL_ERROR_RETRY_MAX_COUNT = 2;

const isServiceStatus = (code: unknown): code is ServiceStatus =>
    typeof code === "number" && typeof ServiceStatus[code] !== "undefined";

const isMetadata = (value: unknown): boolean => {
    if (value instanceof Metadata) {
        return true;
    }

    // The value may come from another copy of `@grpc/grpc-js`, so fall back to the class name.
    // `constructor` can be missing on objects created by `Object.create(null)`.
    return typeof value === "object" && value !== null && value.constructor?.name === "Metadata";
};

/**
 * Check whether the input error is a `ServiceError` from `@grpc/grpc-js`.
 *
 * @returns `true` if it is
 */
export const isServiceError = (error: unknown): error is ServiceErrorType =>
    error instanceof Error &&
    "code" in error &&
    isServiceStatus(error.code) &&
    "details" in error &&
    typeof error.details === "string" &&
    "metadata" in error &&
    isMetadata(error.metadata);

export class ServiceError extends Error {
    constructor(
        message: string,
        public code: ServiceStatus,
        public details: string,
        public metadata: Metadata,
    ) {
        super(message);
        this.name = "ServiceError";
    }

    /**
     * Try to create a `ServiceError` instance from an error.
     *
     * @throws {TypeError} When the input error is not a `ServiceError`
     */
    static fromError(error: unknown): ServiceError {
        if (!isServiceError(error)) {
            throw new TypeError("not a ServiceError");
        }

        const serviceError = new ServiceError(
            error.message,
            error.code,
            error.details,
            error.metadata,
        );

        if ("cause" in error) {
            serviceError.cause = error.cause;
        }

        serviceError.stack = error.stack;

        return serviceError;
    }
}

export interface ServiceCallOptions {
    /**
     * Automatically re-call the input `fn` (when it is a function) if it throws an error such as:
     * `Error: 13 INTERNAL: Received RST_STREAM with code 2 (Internal server error)`, until the max
     * retry count is reached.
     *
     * @default 2 (max 3 calls)
     * @see https://github.com/grpc/grpc-node/issues/2647
     */
    internalErrorRetryMaxCount?: number;
}

/** Change the prototype of the input error to `ServiceError` without creating a new object. */
const markAsServiceError = (error: unknown): void => {
    // Primitive values (and `null`) cannot be changed, so they are rethrown as they are.
    if (typeof error === "object" && error !== null) {
        Object.setPrototypeOf(error, ServiceError.prototype);
        Reflect.set(error, "name", "ServiceError");
    }
};

const isRstStreamInternalError = (error: unknown): boolean =>
    isServiceError(error) &&
    error.code === ServiceStatus.INTERNAL &&
    error.details.startsWith("Received RST_STREAM with code 2");

/**
 * Wrap a gRPC task to handle the errors.
 *
 * **Warning**: this function does not check if the input `fn` is an actual gRPC task or not.
 *
 * @throws {ServiceError}
 */
export const serviceCall = async <T>(
    fn: (() => Promise<T>) | Promise<T>,
    options: ServiceCallOptions = {},
): Promise<T> => {
    if (typeof fn !== "function") {
        try {
            return await fn;
        } catch (error) {
            markAsServiceError(error);

            throw error;
        }
    }

    const { internalErrorRetryMaxCount: inputMaxCount } = options;
    const internalErrorRetryMaxCount =
        typeof inputMaxCount === "number" && inputMaxCount >= 0
            ? inputMaxCount
            : DEFAULT_INTERNAL_ERROR_RETRY_MAX_COUNT;

    for (let attempt = 0; ; attempt++) {
        try {
            // oxlint-disable-next-line eslint/no-await-in-loop -- each retry must wait for the previous call to fail
            return await fn();
        } catch (error) {
            markAsServiceError(error);

            if (attempt >= internalErrorRetryMaxCount || !isRstStreamInternalError(error)) {
                throw error;
            }
        }
    }
};

/**
 * Try to get the gRPC status from an error.
 *
 * @returns The gRPC status code
 */
export const getServiceStatus = (error: unknown): ServiceStatus | undefined => {
    if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        isServiceStatus(error.code)
    ) {
        return error.code;
    }

    return undefined;
};

export { ServiceStatus };
