package com.etqadem.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.ByteBuffer;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Holds the app-session record (a JSON string with the refresh token) encrypted
 * with a non-exportable AES-256-GCM key in the AndroidKeyStore. The ciphertext
 * sits in a private SharedPreferences file that is excluded from backup and
 * device transfer. No library dependency (androidx.security-crypto is
 * deprecated).
 *
 * Any Keystore / decrypt failure (key lost after a restore, corrupted blob)
 * wipes the entry and reads as "signed out"; it never throws to callers.
 */
final class SessionVault {
    private static final String PREFS = "etq_session_vault";
    private static final String PREF_KEY = "v1";
    private static final String KEY_ALIAS = "etq_session_vault_key";
    private static final String KEYSTORE = "AndroidKeyStore";

    private SessionVault() {}

    /** The stored value, or null when absent / unreadable. */
    static synchronized String get(Context ctx) {
        SharedPreferences sp = prefs(ctx);
        String blob = sp.getString(PREF_KEY, null);
        if (blob == null) return null;
        try {
            byte[] all = Base64.decode(blob, Base64.NO_WRAP);
            ByteBuffer bb = ByteBuffer.wrap(all);
            int ivLen = bb.get() & 0xff;
            byte[] iv = new byte[ivLen];
            bb.get(iv);
            byte[] ct = new byte[bb.remaining()];
            bb.get(ct);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, iv));
            return new String(c.doFinal(ct), "UTF-8");
        } catch (Throwable t) {
            reset(ctx);
            return null;
        }
    }

    /** Stores value (null/empty clears). Returns false if it could not be stored (then nothing is kept). */
    static synchronized boolean set(Context ctx, String value) {
        if (value == null || value.isEmpty()) {
            clear(ctx);
            return true;
        }
        try {
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key());
            byte[] iv = c.getIV();
            byte[] ct = c.doFinal(value.getBytes("UTF-8"));
            ByteBuffer bb = ByteBuffer.allocate(1 + iv.length + ct.length);
            bb.put((byte) iv.length).put(iv).put(ct);
            return prefs(ctx).edit().putString(PREF_KEY, Base64.encodeToString(bb.array(), Base64.NO_WRAP)).commit();
        } catch (Throwable t) {
            reset(ctx);
            return false;
        }
    }

    static synchronized void clear(Context ctx) {
        prefs(ctx).edit().remove(PREF_KEY).commit();
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Drops the entry and the key so the next set() starts from a clean slate. */
    private static void reset(Context ctx) {
        try { clear(ctx); } catch (Throwable ignored) {}
        try {
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            ks.deleteEntry(KEY_ALIAS);
        } catch (Throwable ignored) {}
    }

    private static SecretKey key() throws Exception {
        KeyStore ks = KeyStore.getInstance(KEYSTORE);
        ks.load(null);
        KeyStore.Entry e = ks.getEntry(KEY_ALIAS, null);
        if (e instanceof KeyStore.SecretKeyEntry) return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE);
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }
}
