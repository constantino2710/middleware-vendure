// Gera um JWT válido pra o Vendure (ou outro caller) usar quando chamar
// o middleware. Lê o JWT_SECRET de middleware/.env e assina com role 'service'.
//
// Uso:
//   npm run generate:jwt
//
// Depois cole o token impresso no MIDDLEWARE_JWT do .env do Vendure.

import { sign } from 'jsonwebtoken';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '..', '.env') });

const secret = process.env.JWT_SECRET;
if (!secret) {
    // eslint-disable-next-line no-console
    console.error('ERRO: JWT_SECRET não está definido em middleware/.env');
    process.exit(1);
}

const token = sign(
    { sub: 'vendure-bridge', roles: ['service'] },
    secret,
    { expiresIn: '100y' },
);

// eslint-disable-next-line no-console
console.log(token);
