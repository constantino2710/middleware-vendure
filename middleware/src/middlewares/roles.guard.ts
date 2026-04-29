// Pessoa 5 — Segurança (Roles Guard)
//
// @Injectable()
// export class RolesGuard implements CanActivate {
//   constructor(private reflector: Reflector) {}
//
//   canActivate(ctx: ExecutionContext): boolean {
//     const required = this.reflector.getAllAndOverride<string[]>('roles', [ctx.getHandler(), ctx.getClass()]);
//     if (!required) return true;
//     const { user } = ctx.switchToHttp().getRequest();
//     return required.includes(user.role);
//   }
// }
//
// Decorator @Roles(...roles): SetMetadata('roles', roles)
//
// Roles (seção 12 contexto-geral):
//   USER  → /process-order
//   ADMIN → tudo
