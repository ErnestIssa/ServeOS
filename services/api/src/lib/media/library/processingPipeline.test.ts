import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectImageMimeFromMagic } from "./processingPipeline.js";

describe("detectImageMimeFromMagic", () => {
  it("detects JPEG", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    assert.equal(detectImageMimeFromMagic(buf), "image/jpeg");
  });

  it("detects PNG", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    assert.equal(detectImageMimeFromMagic(buf), "image/png");
  });

  it("rejects random bytes", () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]);
    assert.equal(detectImageMimeFromMagic(buf), null);
  });
});
