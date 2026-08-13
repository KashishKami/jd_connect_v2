import { generateKeyPair, KeyLike, exportJWK, importJWK, JWK } from 'jose';

let privateKey: KeyLike | null = null;
let publicKey: KeyLike | null = null;
let publicJwk: JWK | null = null;

export async function getOrGenerateKeys() {
  if (!privateKey || !publicKey) {
    const pair = await generateKeyPair('RS256');
    privateKey = pair.privateKey;
    publicKey = pair.publicKey;
    publicJwk = await exportJWK(publicKey);
  }
  return { privateKey, publicKey, publicJwk };
}

export async function getPublicKey() {
  const keys = await getOrGenerateKeys();
  return keys.publicKey;
}

export async function getPrivateKey() {
  const keys = await getOrGenerateKeys();
  return keys.privateKey;
}

export async function getPublicJwk() {
  const keys = await getOrGenerateKeys();
  return keys.publicJwk;
}

export async function importPublicKeyFromJwk(jwk: JWK) {
  return await importJWK(jwk, 'RS256');
}
