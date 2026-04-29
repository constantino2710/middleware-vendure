// Pessoa 5 — Segurança (JWT Guard)
//
// import { Injectable } from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
//
// @Injectable()
// export class JwtAuthGuard extends AuthGuard('jwt') {}
//
// Configurar JwtModule.register({ secret: process.env.JWT_SECRET, signOptions: { expiresIn: '1h' } })
// e PassportModule + JwtStrategy no AppModule.
//
// JwtStrategy:
//   validate(payload) → return { userId: payload.sub, role: payload.role }
//   anexa em req.user (acessível via @Req() no controller).
