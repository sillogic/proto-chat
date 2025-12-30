import crypto from 'node:crypto';

export interface DecryptionResult {
    plaintext: string;
    wasAuthentic: boolean;
}

export class KeyVaultsGateKeeper {
    private aesKey: any; // Using any for compatibility with subtle crypto types in node

    constructor(aesKey: any) {
        this.aesKey = aesKey;
    }

    static initWithEnvKey = async () => {
        const KEY_VAULTS_SECRET = process.env.KEY_VAULTS_SECRET;
        if (!KEY_VAULTS_SECRET) {
            throw new Error('KEY_VAULTS_SECRET is not set, please set it in your environment variables.');
        }

        const rawKey = Buffer.from(KEY_VAULTS_SECRET, 'base64');
        const aesKey = await (crypto as any).subtle.importKey(
            'raw',
            rawKey,
            { length: 256, name: 'AES-GCM' },
            false,
            ['encrypt', 'decrypt'],
        );
        return new KeyVaultsGateKeeper(aesKey);
    };

    /**
     * encrypt user private data
     */
    encrypt = async (keyVault: string): Promise<string> => {
        const iv = (crypto as any).getRandomValues(new Uint8Array(12));
        const encodedKeyVault = new TextEncoder().encode(keyVault);

        const encryptedData = await (crypto as any).subtle.encrypt(
            {
                iv: iv,
                name: 'AES-GCM',
            },
            this.aesKey,
            encodedKeyVault,
        );

        const buffer = Buffer.from(encryptedData);
        const authTag = buffer.slice(-16);
        const encrypted = buffer.slice(0, -16);

        return `${Buffer.from(iv).toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
    };

    decrypt = async (encryptedData: string): Promise<DecryptionResult> => {
        const parts = encryptedData.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted data format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const authTag = Buffer.from(parts[1], 'hex');
        const encrypted = Buffer.from(parts[2], 'hex');

        const combined = Buffer.concat([encrypted, authTag]);

        try {
            const decryptedBuffer = await (crypto as any).subtle.decrypt(
                {
                    iv: iv,
                    name: 'AES-GCM',
                },
                this.aesKey,
                combined,
            );

            const decrypted = new TextDecoder().decode(decryptedBuffer);
            return {
                plaintext: decrypted,
                wasAuthentic: true,
            };
        } catch {
            return {
                plaintext: '',
                wasAuthentic: false,
            };
        }
    };
}
