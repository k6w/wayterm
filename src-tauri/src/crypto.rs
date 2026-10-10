use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use sha2::{Sha256, Digest};
use rand::Rng;

const NONCE_LEN: usize = 12;

/// Key-derivation tag for data written by this build.
const KEY_TAG: &str = "wayterm-key-encryption-v1";
/// Tag used before the app was renamed from Nexterm. Only read, so keys stored by
/// an older build (and copied over by the data-dir migration) still decrypt.
const LEGACY_KEY_TAG: &str = "nexterm-key-encryption-v1";

fn derive_key(tag: &str) -> [u8; 32] {
    let mut seed = String::new();

    if let Some(data_dir) = dirs::data_dir() {
        seed.push_str(&data_dir.to_string_lossy());
    }
    seed.push_str(tag);
    if let Ok(hostname) = std::env::var("COMPUTERNAME")
        .or_else(|_| std::env::var("HOSTNAME"))
    {
        seed.push_str(&hostname);
    }

    let hash = Sha256::digest(seed.as_bytes());
    let mut key = [0u8; 32];
    key.copy_from_slice(&hash);
    key
}

pub fn encrypt(plaintext: &[u8]) -> Result<Vec<u8>, String> {
    encrypt_with(plaintext, KEY_TAG)
}

fn encrypt_with(plaintext: &[u8], tag: &str) -> Result<Vec<u8>, String> {
    let key = derive_key(tag);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Encryption init failed: {e}"))?;

    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("Encryption failed: {e}"))?;

    let mut result = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    result.extend_from_slice(&nonce_bytes);
    result.extend_from_slice(&ciphertext);
    Ok(result)
}

pub fn decrypt(data: &[u8]) -> Result<Vec<u8>, String> {
    if data.len() < NONCE_LEN {
        return Err("Encrypted data too short".to_string());
    }

    decrypt_with(data, KEY_TAG)
        .or_else(|_| decrypt_with(data, LEGACY_KEY_TAG))
        .map_err(|_| "Decryption failed: data may be corrupted or from a different machine".to_string())
}

fn decrypt_with(data: &[u8], tag: &str) -> Result<Vec<u8>, String> {
    let key = derive_key(tag);
    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|e| format!("Decryption init failed: {e}"))?;

    let nonce = Nonce::from_slice(&data[..NONCE_LEN]);
    let ciphertext = &data[NONCE_LEN..];

    cipher.decrypt(nonce, ciphertext).map_err(|_| "decryption failed".to_string())
}

pub fn is_encrypted(data: &[u8]) -> bool {
    if data.len() < NONCE_LEN + 16 {
        return false;
    }
    // PEM keys always start with "-----BEGIN" in ASCII
    !data.starts_with(b"-----BEGIN")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let plaintext = b"-----BEGIN OPENSSH PRIVATE KEY-----\ntest key data\n-----END OPENSSH PRIVATE KEY-----\n";
        let encrypted = encrypt(plaintext).expect("encryption should succeed");
        let decrypted = decrypt(&encrypted).expect("decryption should succeed");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn encrypted_data_differs_from_plaintext() {
        let plaintext = b"-----BEGIN RSA PRIVATE KEY-----\nsecret\n-----END RSA PRIVATE KEY-----\n";
        let encrypted = encrypt(plaintext).expect("encryption should succeed");
        assert_ne!(encrypted, plaintext);
    }

    #[test]
    fn tampered_data_fails_decryption() {
        let plaintext = b"test data for tamper detection";
        let mut encrypted = encrypt(plaintext).expect("encryption should succeed");
        if let Some(last) = encrypted.last_mut() {
            *last ^= 0xFF;
        }
        assert!(decrypt(&encrypted).is_err());
    }

    #[test]
    fn data_encrypted_before_the_rename_still_decrypts() {
        let plaintext = b"-----BEGIN OPENSSH PRIVATE KEY-----\nold\n-----END OPENSSH PRIVATE KEY-----\n";
        let legacy = encrypt_with(plaintext, LEGACY_KEY_TAG).expect("encryption should succeed");
        assert_eq!(decrypt(&legacy).expect("legacy data should decrypt"), plaintext);
        assert_ne!(derive_key(KEY_TAG), derive_key(LEGACY_KEY_TAG));
    }

    #[test]
    fn too_short_data_fails() {
        assert!(decrypt(&[0u8; 5]).is_err());
    }

    #[test]
    fn is_encrypted_detects_pem() {
        let pem = b"-----BEGIN OPENSSH PRIVATE KEY-----\ndata\n-----END OPENSSH PRIVATE KEY-----\n";
        assert!(!is_encrypted(pem));
    }

    #[test]
    fn is_encrypted_detects_encrypted() {
        let plaintext = b"-----BEGIN OPENSSH PRIVATE KEY-----\ndata\n-----END OPENSSH PRIVATE KEY-----\n";
        let encrypted = encrypt(plaintext).expect("encryption should succeed");
        assert!(is_encrypted(&encrypted));
    }
}
