// Generates an ES256 (P-256) signing key for AegisID access tokens.
// Usage: node scripts/gen-jwt-key.mjs
// Prints the private JWK as one line. Store it as secret JWT_PRIVATE_JWK:
//   local: add to .dev.vars as JWT_PRIVATE_JWK='<json>'
//   prod:  pnpm exec wrangler secret put JWT_PRIVATE_JWK
// Never commit the output.
import { generateKeyPairSync, createHash } from "node:crypto";

const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const jwk = privateKey.export({ format: "jwk" });
// kid = SHA-256 thumbprint of the public part, so it is stable per key.
const thumbInput = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
jwk.kid = createHash("sha256").update(thumbInput).digest("base64url");
jwk.alg = "ES256";
jwk.use = "sig";
console.log(JSON.stringify(jwk));
