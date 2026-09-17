import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ServiceError as GrpcServiceError } from "@grpc/grpc-js";
import { Metadata } from "@grpc/grpc-js";

import {
    ServiceError,
    ServiceStatus,
    getServiceStatus,
    isServiceError,
    serviceCall,
} from "../src/index.ts";

const RST_STREAM_DETAILS = "Received RST_STREAM with code 2 (Internal server error)";

// Build an error in the same shape as the ones created by `@grpc/grpc-js`.
const createGrpcError = (code: ServiceStatus, details: string): GrpcServiceError =>
    Object.assign(new Error(`${code} ${ServiceStatus[code]}: ${details}`), {
        code,
        details,
        metadata: new Metadata(),
    });

describe("isServiceError", () => {
    it("returns true for a gRPC error", () => {
        assert.equal(
            isServiceError(createGrpcError(ServiceStatus.UNAVAILABLE, "No connection")),
            true,
        );
    });

    it("returns false for a normal error", () => {
        assert.equal(isServiceError(new Error("oops")), false);
    });
});

describe("ServiceError.fromError", () => {
    it("copies the fields of a gRPC error", () => {
        const error = createGrpcError(ServiceStatus.NOT_FOUND, "Not found");
        const serviceError = ServiceError.fromError(error);

        assert.ok(serviceError instanceof ServiceError);
        assert.equal(serviceError.name, "ServiceError");
        assert.equal(serviceError.message, error.message);
        assert.equal(serviceError.code, ServiceStatus.NOT_FOUND);
        assert.equal(serviceError.details, "Not found");
        assert.equal(serviceError.metadata, error.metadata);
        assert.equal(serviceError.stack, error.stack);
    });
});

describe("serviceCall", () => {
    it("resolves the value of a promise", async () => {
        assert.equal(await serviceCall(Promise.resolve(1)), 1);
    });

    it("turns the rejected error of a promise into a ServiceError", async () => {
        const error = createGrpcError(ServiceStatus.UNAVAILABLE, "No connection");

        await assert.rejects(serviceCall(Promise.reject(error)), (thrown: unknown) => {
            assert.equal(thrown, error);
            assert.ok(thrown instanceof ServiceError);
            assert.equal(thrown.name, "ServiceError");

            return true;
        });
    });

    it("retries a function which fails with an RST_STREAM internal error", async () => {
        let calls = 0;

        const result = await serviceCall(async () => {
            calls += 1;

            if (calls < 3) {
                throw createGrpcError(ServiceStatus.INTERNAL, RST_STREAM_DETAILS);
            }

            return "done";
        });

        assert.equal(result, "done");
        assert.equal(calls, 3);
    });

    it("does not retry when internalErrorRetryMaxCount is 0", async () => {
        let calls = 0;

        await assert.rejects(
            serviceCall(
                async () => {
                    calls += 1;

                    throw createGrpcError(ServiceStatus.INTERNAL, RST_STREAM_DETAILS);
                },
                { internalErrorRetryMaxCount: 0 },
            ),
            ServiceError,
        );

        assert.equal(calls, 1);
    });
});

describe("getServiceStatus", () => {
    it("returns the status code of a gRPC error", () => {
        const error = createGrpcError(ServiceStatus.DEADLINE_EXCEEDED, "Deadline exceeded");

        assert.equal(getServiceStatus(error), ServiceStatus.DEADLINE_EXCEEDED);
    });

    it("returns undefined for a normal error", () => {
        assert.equal(getServiceStatus(new Error("oops")), undefined);
    });
});
