# ECOMANAGER — COD Platform Algeria

## Stack
- Backend:  NestJS, TypeORM, PostgreSQL 16 (port 3001)
- Frontend: Next.js 15 App Router, Tailwind, React Query (port 3000)
- DB:       host=db (Docker) or localhost (local), db=ecomanager
- Cache:    Redis

## Brand colors
- Primary:    #BF4C98
- Background: #FFF7F2
- Border:     #E2D8E2

## Rules
- ALWAYS scope DB queries by tenant_id — never skip this
- Controllers are thin — services contain all logic
- class-validator decorators on every DTO
- French UI labels
- UUID primary keys, soft deletes via deleted_at
- synchronize: false — schema is final in migrations/

## Structure
- apps/api/src/modules/  one folder per domain
- apps/web/app/dashboard/ one folder per page
- Each module: entities/ dto/ .service.ts .controller.ts .module.ts

## RBAC
- roles.permissions JSONB: {"orders.en_confirmation.confirm": true}
- Super Admin: {"*": true} — wildcard
