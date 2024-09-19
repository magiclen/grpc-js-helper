import { Metadata, ServiceError as ServiceErrorType, status as ServiceStatus } from "@grpc/grpc-js";

export class ServiceError extends Error {
    constructor(message: string, public code: ServiceStatus, public details: string, public metadata: Metadata) {
        super(message);
    }
    
    /**
     * Try to create a `ServiceError` instance from an error.
     *
     * @throws {TypeError} when the input error is not a `ServiceError`
     */
    static fromError(error: unknown) {
        if (!isServiceError(error)) {
            throw new TypeError("not a ServiceError");
        }

        const serviceError = new ServiceError(error.message, error.code, error.details, error.metadata);

        serviceError.cause = error.cause;
        serviceError.stack = error.stack;

        return serviceError;
    }
}

/**
 * Wrap a gRPC task to handle the errors.
 *
 * **Warning**: this function does not check if the input `fn` is an actuall gRPC task or not.
 *
 * @throws {ServiceError}
 */
export const serviceCall = <T>(fn: Promise<T>): Promise<T> => {
    return fn.catch((error: unknown) => {
        Object.setPrototypeOf(error, ServiceError.prototype);

        (error as ServiceError).name = "ServiceError";

        throw error;
    });
};

/**
 * Check whether the input error is a `ServiceError` from `@grpc/grpc-js`.
 *
 * @returns `true` if it is
 */
export const isServiceError = (error: unknown): error is ServiceErrorType => {
    if (error instanceof Error) {
        const serviceError = error as Partial<ServiceErrorType> & Error;

        if (typeof serviceError.code !== "number" || typeof ServiceStatus[serviceError.code] === "undefined") {
            return false;
        }

        if (typeof serviceError.details !== "string") {
            return false;
        }

        if (!((typeof serviceError.metadata === "object") && (serviceError.metadata as object).constructor.name === "Metadata")) {
            return false;
        }

        return true;
    }

    return false;
};

/**
 * Try to get the gRPC status from an error.
 *
 * @returns the gRPC status code
 */
export const getServiceStatus = (error: unknown): ServiceStatus | undefined => {
    const serviceError = error as Partial<ServiceErrorType>;

    if (typeof serviceError.code === "number" && typeof ServiceStatus[serviceError.code] !== "undefined") {
        return serviceError.code;
    }

    return undefined;
};

export { ServiceStatus };
