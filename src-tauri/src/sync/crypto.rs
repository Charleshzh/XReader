//! Simple credential encryption for sync config at rest.
//!
//! Uses ChaCha20-Poly1305 via ring crate with a key derived from
//! machine-specific identifiers. This prevents casual plaintext reads
//! of the SQLite app_settings table but does NOT protect against
//! targeted attacks (the key material is on the same machine).

use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, CHACHA20_POLY1305};
use ring::rand::{SecureRandom, SystemRandom};

const NONCE_LEN: usize = 12;

/// Derive an encryption key from machine identifiers.
fn derive_key() -> [u8; 32] {
    let mut material = Vec::new();
    if let Ok(hostname) = hostname::get() {
        material.extend(hostname.to_string_lossy().as_bytes());
    }
    if let Ok(user) = std::env::var("USERNAME").or_else(|_| std::env::var("USER")) {
        material.push(b':');
        material.extend(user.as_bytes());
    }
    // Fallback: use a constant if nothing is available
    if material.is_empty() {
        material = b"xreader-fixed-salt-2026".to_vec();
    }
    // HMAC-based key derivation
    let tag = ring::hmac::sign(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, b"xreader-cred-v1"),
        &material,
    );
    let mut key = [0u8; 32];
    key.copy_from_slice(&tag.as_ref()[..32]);
    key
}

/// Encrypt plaintext → base64-encoded "nonce:ciphertext".
pub fn encrypt(plaintext: &str) -> Result<String, String> {
    let key = derive_key();
    let unbound =
        UnboundKey::new(&CHACHA20_POLY1305, &key).map_err(|e| format!("crypto: {}", e))?;
    let less_safe = LessSafeKey::new(unbound);

    let rng = SystemRandom::new();
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rng.fill(&mut nonce_bytes)
        .map_err(|e| format!("crypto: {}", e))?;

    let nonce = Nonce::assume_unique_for_key(nonce_bytes);
    let mut in_out = plaintext.as_bytes().to_vec();
    less_safe
        .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("crypto: {}", e))?;

    // prepend nonce, base64 the whole thing
    let mut packet = nonce_bytes.to_vec();
    packet.extend_from_slice(&in_out);
    Ok(base64::Engine::encode(
        &base64::engine::general_purpose::STANDARD,
        &packet,
    ))
}

/// Decrypt base64-encoded "nonce:ciphertext" → plaintext.
pub fn decrypt(encoded: &str) -> Result<String, String> {
    let key = derive_key();
    let unbound =
        UnboundKey::new(&CHACHA20_POLY1305, &key).map_err(|e| format!("crypto: {}", e))?;
    let less_safe = LessSafeKey::new(unbound);

    let packet = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
        .map_err(|e| format!("crypto: {}", e))?;

    if packet.len() < NONCE_LEN + 16 {
        return Err("Invalid encrypted data".to_string());
    }

    let (nonce_bytes, ciphertext) = packet.split_at(NONCE_LEN);
    let nonce = Nonce::assume_unique_for_key(
        nonce_bytes
            .try_into()
            .map_err(|_| "Bad nonce".to_string())?,
    );

    let mut in_out = ciphertext.to_vec();
    let plain = less_safe
        .open_in_place(nonce, Aad::empty(), &mut in_out)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    Ok(String::from_utf8_lossy(plain).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = "secret-password-12345";
        let enc = encrypt(original).unwrap();
        let dec = decrypt(&enc).unwrap();
        assert_eq!(original, dec);
    }

    #[test]
    fn test_encrypt_produces_different_outputs() {
        let pw = "test-password";
        let enc1 = encrypt(pw).unwrap();
        let enc2 = encrypt(pw).unwrap();
        // Nonce makes each encryption unique
        assert_ne!(enc1, enc2);
        // Both decrypt correctly
        assert_eq!(decrypt(&enc1).unwrap(), pw);
        assert_eq!(decrypt(&enc2).unwrap(), pw);
    }

    #[test]
    fn test_decrypt_garbage_fails() {
        assert!(decrypt("not-valid-base64!!!").is_err());
        assert!(decrypt("").is_err());
    }
}
