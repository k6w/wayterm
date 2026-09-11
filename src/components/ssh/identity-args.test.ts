import { describe, expect, it } from "vitest";
import { identityFileArgs } from "./identity-args";

describe("identityFileArgs", () => {
  it("passes the key file as its own argv element after -i", () => {
    expect(identityFileArgs({ authMethod: "key", privateKeyId: null, identityFile: "/home/me/my keys/id; rm -rf" })).toEqual([
      "-i",
      "/home/me/my keys/id; rm -rf",
    ]);
  });

  it("is empty without a path, for other auth methods, or when a stored key is used", () => {
    expect(identityFileArgs({ authMethod: "key", privateKeyId: null, identityFile: null })).toEqual([]);
    expect(identityFileArgs({ authMethod: "key", privateKeyId: null })).toEqual([]);
    expect(identityFileArgs({ authMethod: "password", privateKeyId: null, identityFile: "/k" })).toEqual([]);
    expect(identityFileArgs({ authMethod: "key", privateKeyId: "k1", identityFile: "/k" })).toEqual([]);
  });
});
