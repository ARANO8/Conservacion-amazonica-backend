# AGENTS.md — Conservación Amazónica Backend (SIFIN)

NestJS 11 REST API for the _Sistema Financiero Integrado_ (SIFIN) of Conservación Amazónica.
Manages POA budgets, fund requests (solicitudes), viáticos, gastos, and disbursements under
Bolivian tax rules. Stack: **NestJS 11 · TypeScript 5.7 · Prisma 5.21 · PostgreSQL**.

---

## Build, Lint & Test Commands

All commands use **pnpm**.

```bash
# Development
pnpm start:dev          # watch mode (nodemon-like)
pnpm build              # compile to dist/

# Linting & formatting
pnpm lint               # ESLint --fix on src/ and test/
pnpm format             # Prettier --write on src/ and test/

# Unit tests (Jest, rootDir = src/, matches **/*.spec.ts)
pnpm test               # run all unit tests once
pnpm test:watch         # watch mode
pnpm test:cov           # with coverage report

# Run a SINGLE test file
pnpm test -- --testPathPattern="poa.service"        # by file name fragment
pnpm test -- src/poa/poa.service.spec.ts            # by exact path

# Run a SINGLE test by name
pnpm test -- --testNamePattern="should be defined"

# E2E tests (separate jest config, supertest against full AppModule)
pnpm test:e2e           # uses test/jest-e2e.json

# Database
npx prisma migrate dev          # apply pending migrations
npx prisma migrate deploy       # production-safe apply
npx prisma db seed              # run prisma/seed.ts
npx prisma studio               # visual DB browser
```

The pre-commit hook runs `lint-staged` (ESLint + Prettier on staged `.ts` files).
Commit messages must follow **Conventional Commits** enforced by commitlint:
`feat | fix | docs | style | refactor | test | chore | perf | ci | revert`

---

## Project Structure

```
src/
├── app.module.ts
├── main.ts
├── auth/               # JWT + Passport, RolesGuard, @Roles decorator
├── catalogos/          # Read-only reference data (proyectos, grupos, partidas, …)
├── common/constants/   # Shared constants (e.g. financial.constants.ts)
├── poa/                # Plan Operativo Anual CRUD + budget calculations
├── prisma/             # @Global PrismaModule + PrismaService
├── reports/            # PDF/CSV report generation (pdfmake, pdfkit)
├── shared/utils/       # Pure utility functions (formatters.util.ts)
├── solicitudes/        # Core domain: fund requests + financial state machine
├── solicitudes-presupuestos/  # Budget allocation per solicitud
└── usuarios/           # User management
prisma/
├── schema.prisma
├── seed.ts
└── seeds/
test/                   # E2E tests (app.e2e-spec.ts)
```

---

## Code Style

### TypeScript

- **Target**: ES2023; `module: nodenext`, `moduleResolution: nodenext`.
- `strictNullChecks: true`; `noImplicitAny: false` (explicit `any` is allowed but
  `@typescript-eslint/no-explicit-any` is off — prefer typed alternatives when practical).
- Decorators: `emitDecoratorMetadata` and `experimentalDecorators` are enabled — required for
  NestJS DI and `class-validator`/`class-transformer`.

### Formatting (Prettier)

- **Single quotes** for strings.
- **Trailing commas** everywhere (`"trailingComma": "all"`).
- `endOfLine: auto` (LF on Linux/macOS, CRLF on Windows — committed files should be LF).
- Run `pnpm format` before committing if the pre-commit hook is bypassed.

### Imports

- Use path aliases defined in `tsconfig.json` (`baseUrl: "./"`) for cross-module imports.
- Group imports: NestJS framework → third-party → local (no blank-line separation required,
  but keep them ordered logically).
- Avoid barrel `index.ts` re-exports unless the module already has one.
- Use `import type` where a type-only import suffices to keep runtime footprint lean.

### Naming Conventions

| Construct                       | Convention                                           | Example                                             |
| ------------------------------- | ---------------------------------------------------- | --------------------------------------------------- |
| Classes, decorators, enums      | PascalCase                                           | `SolicitudesService`, `EstadoSolicitud`             |
| Variables, functions, methods   | camelCase                                            | `calcularMontosViaticos`                            |
| Constants (module-level)        | UPPER_SNAKE_CASE                                     | `SOLICITUD_INCLUDE`, `USER_SAFE_SELECT`             |
| Files                           | kebab-case                                           | `solicitudes.service.ts`, `create-solicitud.dto.ts` |
| Prisma models/fields            | PascalCase models, camelCase fields (Prisma default) |                                                     |
| Database columns                | snake_case (mapped by Prisma)                        |                                                     |
| Swagger/comments/error messages | **Spanish** (domain language of the project)         |                                                     |

### NestJS Module Patterns

- One module per domain feature; register the module in `app.module.ts`.
- `PrismaModule` is `@Global()` — do **not** re-import it in feature modules; inject
  `PrismaService` directly via constructor DI.
- Controllers contain **no business logic** — delegate entirely to the service.
- Use `forwardRef(() => Module)` only to break true circular dependencies (see
  `SolicitudesModule` ↔ `SolicitudesPresupuestosModule`).
- Apply `@UseGuards(JwtAuthGuard, RolesGuard)` and `@ApiBearerAuth()` at class level on
  controllers that require authentication. Add `@Roles(Rol.ADMIN)` at method level only for
  admin-restricted endpoints.

### DTOs

- Every DTO field must have a `class-validator` decorator (`@IsString`, `@IsInt`, `@IsEnum`,
  `@IsOptional`, `@Min`, etc.).
- Nested object DTOs must use `@ValidateNested()` + `@Type(() => NestedDto)`.
- Every field must have `@ApiProperty({ example: … })` for Swagger auto-generation (the
  `@nestjs/swagger` compiler plugin is active via `nest-cli.json`).
- Mutation DTOs live in `<module>/dto/`; update DTOs extend the create DTO with
  `PartialType(CreateXDto)`.

### Services & Business Logic

- All multi-table writes must be wrapped in `this.prisma.$transaction(async (tx) => { … })`.
- Use `Promise.all([…])` for independent parallel queries within a request.
- Soft-delete pattern: set `deletedAt: new Date()` instead of hard-deleting; all queries
  must include `where: { deletedAt: null }` unless intentionally querying deleted records.
- Extract pure computation helpers (tax calc, financial aggregation) into dedicated
  `*.helper.ts` or `shared/utils/` files — keep services free of raw arithmetic.
- Financial amounts are **always** `Prisma.Decimal` — never use `number` or `float` for
  monetary values to avoid floating-point errors.

### Bolivian Tax Calculations

Tax logic lives in `src/solicitudes/solicitudes.helper.ts`:

- **IVA**: 13% — `iva = total - (total / 1.13)`
- **IT**: 3% on gross amount
- **IUE**: 5% on net — grossed-up formula `total = neto / factor`
- Always use `Prisma.Decimal` operations (`.plus()`, `.times()`, `.div()`) for all tax math.

### Error Handling

- Throw NestJS built-in HTTP exceptions from services:
  `NotFoundException`, `BadRequestException`, `ForbiddenException`, `ConflictException`.
- Error messages must be in **Spanish** (e.g. `'POA no encontrado'`, `'Saldo insuficiente'`).
- Do not catch-and-swallow errors; let them propagate to NestJS's global exception filter.
- Validate preconditions (sufficient budget, valid state transitions) at the start of service
  methods before touching the database.

### Authentication & Authorization

- Auth is JWT bearer token. The `JwtStrategy` validates the user exists and is not
  soft-deleted on every request.
- Use `@Auth()` decorator (combines `@UseGuards` + `@ApiBearerAuth`) from
  `src/auth/decorators/auth.decorator.ts` when available.
- Role checks via `@Roles(Rol.ADMIN | Rol.TESORERO | Rol.USUARIO)` + `RolesGuard`; if no
  `@Roles` is set, the guard allows all authenticated users through.
- Additional role-based authorization can be enforced inside service methods using the
  injected user object for fine-grained checks.

### Swagger / API Documentation

- Swagger UI is available at `GET /doc`.
- Tag every controller with `@ApiTags('nombre-modulo')`.
- Annotate every endpoint with `@ApiOperation({ summary: '…' })` in Spanish.
- The `@nestjs/swagger` plugin infers types from DTOs automatically — avoid redundant
  `@ApiResponse` unless the response shape differs from the DTO.

### Database (Prisma)

- Keep `prisma/schema.prisma` as the single source of truth.
- Monetary columns: `Decimal @db.Decimal(10, 2)`.
- Enums are defined in the Prisma schema and imported from `@prisma/client`.
- The `SOLICITUD_INCLUDE` and `USER_SAFE_SELECT` constants in
  `src/solicitudes/solicitudes.constants.ts` are typed with `satisfies Prisma.XxxInclude` /
  `satisfies Prisma.XxxSelect` — follow the same pattern for new reusable query shapes.
- Run `npx prisma migrate dev --name <descriptive-name>` after schema changes during
  development; use `npx prisma migrate deploy` in CI/production.

### Testing

- Unit test files are `*.spec.ts` co-located with the source file they test.
- E2E tests are in `test/*.e2e-spec.ts`.
- Use `@nestjs/testing` `Test.createTestingModule(…)` for unit tests; mock all providers
  that have external dependencies (PrismaService, external HTTP clients) using Jest mocks or
  custom provider overrides.
- When mocking `PrismaService`, provide a mock object covering the exact Prisma model
  methods the service calls (`findUnique`, `findMany`, `create`, `update`, `$transaction`, …).
- Test names should describe behavior in plain language (English or Spanish, be consistent
  within a file).
