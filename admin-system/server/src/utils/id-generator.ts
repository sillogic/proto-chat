import { customAlphabet } from 'nanoid';

const alphabet = '1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const createNanoId = customAlphabet(alphabet, 12);

export const idGenerator = (prefix: string) => {
    return `${prefix}_${createNanoId()}`;
};
