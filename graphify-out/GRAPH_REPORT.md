# Graph Report - Lince-Pet-main  (2026-10-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1916 nodes · 4945 edges · 183 communities (100 shown, 83 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `290c08a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- react
- services/bloqueios.ts
- dashboard/veterinario/page.tsx
- .from
- onboarding/page.tsx
- services/anotacoes.ts
- BloqueioAgendaModal.tsx
- next
- AuthContext.tsx
- http.ts
- requireUser
- services/onboarding.ts
- server-only
- services/auth.ts
- useAuth
- services/veterinarios.ts
- AsaasService
- ok
- onboarding/clinica/page.tsx
- storage.ts
- SearchBar.tsx
- signup/tutor/page.tsx
- db.ts
- veterinario-dashboard.ts
- package.json
- google.ts
- dependencies
- api.tsx
- compilerOptions
- OBEY Release It! by Michael T. Nygard
- Arquitetura Lince Pet (Next.js fullstack)
- React Composition Patterns
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- 5. Re-render Optimization
- devDependencies
- json
- veterinarios/route.ts
- 7. JavaScript Performance
- Quick Reference
- services/avaliacoes.ts
- OBEY Clean Architecture by Robert C. Martin
- OBEY Working Effectively with Legacy Code by Michael Feathers
- clinicas/[id]/route.ts
- Code Smell Policy
- 6. Rendering Performance
- UploadedFile
- google-calendar.ts
- React Composition Patterns
- 3. Server-Side Performance
- OBEY Clean Architecture by Robert C. Martin
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- OBEY Release It! by Michael T. Nygard
- React Composition Patterns
- React Best Practices
- Sections
- OBEY Working Effectively with Legacy Code by Michael Feathers
- scripts
- Forbidden Patterns
- eslint.config.mjs
- session.ts
- Code Generation Rules
- OBEY Clean Architecture by Robert C. Martin
- Forbidden Patterns
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- OBEY Release It! by Michael T. Nygard
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- OBEY Working Effectively with Legacy Code by Michael Feathers
- Persistence Pattern Rules
- Forbidden Patterns
- Refactoring Catalog Index
- Preferred Refactoring Moves
- Load and Capacity Rules
- Forbidden Patterns
- Sections
- React Best Practices
- Handling Risky Areas
- Preferred Legacy Techniques
- Required Layer Responsibilities
- Architecture Heuristics
- Concurrency and Transaction Rules
- Dependency Protection Rules
- 8. Advanced Patterns
- Web Interface Guidelines
- Dependency Breaking Rules
- Forbidden Patterns
- CityAutocomplete.tsx
- Testing Rules
- Preferred Default Shapes
- Application Workflow Rules
- Choosing the Business Logic Pattern
- Identity, Caching, and Unit-of-Work Rules
- Safety Rules
- Operational Visibility Rules
- async-cheap-condition-before-await.md
- Prefer Statically Analyzable Paths
- server-hoist-static-io.md
- Testing Strategy Rules
- Seam Rules
- cidades-famosas.ts
- doencas.ts
- Runtime State and Restart Safety Rules
- architecture-avoid-boolean-props.md
- architecture-compound-components.md
- patterns-children-over-render-props.md
- patterns-explicit-variants.md
- react19-no-forwardref.md
- state-context-interface.md
- state-decouple-implementation.md
- state-lift-state.md
- vercel-composition-patterns/rules/_template.md
- advanced-effect-event-deps.md
- advanced-event-handler-refs.md
- advanced-init-once.md
- advanced-use-latest.md
- async-api-routes.md
- async-dependencies.md
- async-parallel.md
- async-suspense-boundaries.md
- bundle-barrel-imports.md
- bundle-conditional.md
- bundle-defer-third-party.md
- bundle-dynamic-imports.md
- bundle-preload.md
- client-event-listeners.md
- client-localstorage-schema.md
- client-passive-event-listeners.md
- client-swr-dedup.md
- js-batch-dom-css.md
- js-cache-function-results.md
- js-cache-property-access.md
- js-cache-storage.md
- js-combine-iterations.md
- js-early-exit.md
- js-flatmap-filter.md
- js-hoist-regexp.md
- js-index-maps.md
- js-length-check-first.md
- js-min-max-loop.md
- js-request-idle-callback.md
- js-set-map-lookups.md
- js-tosorted-immutable.md
- rendering-activity.md
- rendering-animate-svg-wrapper.md
- rendering-conditional-render.md
- rendering-content-visibility.md
- rendering-hoist-jsx.md
- rendering-hydration-no-flicker.md
- rendering-hydration-suppress-warning.md
- rendering-resource-hints.md
- rendering-script-defer-async.md
- rendering-svg-precision.md
- rendering-usetransition-loading.md
- rerender-defer-reads.md
- rerender-dependencies.md
- rerender-derived-state.md
- rerender-derived-state-no-effect.md
- rerender-functional-setstate.md
- rerender-lazy-state-init.md
- rerender-memo.md
- rerender-memo-with-default-value.md
- rerender-move-effect-to-event.md
- rerender-no-inline-components.md
- rerender-simple-expression-in-memo.md
- rerender-split-combined-hooks.md
- rerender-transitions.md
- rerender-use-deferred-value.md
- rerender-use-ref-transient-values.md
- server-after-nonblocking.md
- server-auth-actions.md
- server-cache-lru.md
- server-dedup-props.md
- server-parallel-fetching.md
- server-parallel-nested-fetching.md
- server-serialization.md
- vercel-react-best-practices/rules/_template.md
- postcss.config.mjs
- SuccessScreen/README.md

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 154 edges
2. `ok()` - 145 edges
3. `serverError()` - 101 edges
4. `route()` - 95 edges
5. `ApiRequest` - 92 edges
6. `prisma` - 72 edges
7. `updating()` - 71 edges
8. `badRequest()` - 64 edges
9. `react` - 60 edges
10. `notFound()` - 57 edges

## Surprising Connections (you probably didn't know these)
- `Relacoes User->tutor/veterinario/clinica como listas` --conceptually_related_to--> `requireUser()`  [INFERRED]
  docs/ARQUITETURA.md → src/server/auth/session.ts
- `E-mails via Resend com templates Edge convertidos` --implements--> `sendMail()`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/services/mail.ts
- `Uploads multipart para S3/CloudFront` --implements--> `uploadPhoto()`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/services/storage.ts
- `Webhook Asaas idempotente via webhook_events.event_id` --implements--> `POST`  [EXTRACTED]
  docs/ARQUITETURA.md → src/app/api/webhooks/asaas/route.ts
- `Contrato HTTP herdado do Adonis` --implements--> `ApiRequest`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/http.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pipeline de uma requisicao /api** — src_server_http_route, src_server_http_apirequest, src_server_auth_session_requireuser, src_server_db_prisma, src_server_http_json, src_server_http_handleerror [EXTRACTED 1.00]

## Communities (183 total, 83 thin omitted)

### Community 0 - "react"
Cohesion: 0.05
Nodes (40): react, ClinicProfilePage(), loadClinic(), COMODIDADES_LIST, getComodidadeLabel(), AppointmentItem(), AppointmentItemProps, FavoriteItem (+32 more)

### Community 1 - "services/bloqueios.ts"
Cohesion: 0.07
Nodes (53): luxon, PATCH, GET, GET, POST, consumeDataConsulta(), jaPassou(), nomeCompleto() (+45 more)

### Community 2 - "dashboard/veterinario/page.tsx"
Cohesion: 0.06
Nodes (40): lucide-react, moment, CalendarEvent, ClinicaDashboard(), DashboardData, BLOQUEIO_SCOPE_VET, CalendarEvent, DashboardData (+32 more)

### Community 3 - ".from"
Cohesion: 0.10
Nodes (35): POST, statusNormalizado(), POST, GET, POST, PATCH, GET, OPTIONS (+27 more)

### Community 4 - "onboarding/page.tsx"
Cohesion: 0.08
Nodes (35): Especialidade, LocationData, LocationModalData, OnboardingPage(), OnboardingStep, onboardingSteps, ClinicaSignup(), Page() (+27 more)

### Community 5 - "services/anotacoes.ts"
Cohesion: 0.07
Nodes (34): vitest, GET, PUT, CurrentUser, HttpError, anotacaoValidator, findAgendamentoDoVet(), FORMAS_PAGAMENTO (+26 more)

### Community 6 - "BloqueioAgendaModal.tsx"
Cohesion: 0.08
Nodes (41): AnotacaoPrivada(), FORMA_OPCOES, Props, STATUS_OPCOES, FORMA_LABEL, formatarData(), HistoricoAnotacoes(), Props (+33 more)

### Community 7 - "next"
Cohesion: 0.06
Nodes (23): nextConfig, next, Clinica, ExplorarContent(), ExplorarPage(), Veterinario, Home(), metadata (+15 more)

### Community 8 - "AuthContext.tsx"
Cohesion: 0.07
Nodes (22): fredoka, inter, metadata, RootLayout(), viewport, Footer(), Header(), ClinicRequestModal() (+14 more)

### Community 9 - "http.ts"
Cohesion: 0.12
Nodes (23): GET, DELETE, GET, POST, GET, POST, DELETE, GET (+15 more)

### Community 10 - "requireUser"
Cohesion: 0.14
Nodes (28): PATCH, GET, DELETE, GET, POST, POST, POST, POST (+20 more)

### Community 11 - "services/onboarding.ts"
Cohesion: 0.12
Nodes (31): POST, POST, POST, POST, POST, POST, POST, POST (+23 more)

### Community 12 - "server-only"
Cohesion: 0.13
Nodes (30): server-only, appointmentCancellation(), AppointmentCancellationData, appointmentConfirmation(), AppointmentConfirmationData, appointmentRescheduled(), AppointmentRescheduledData, appointmentRescheduledVet() (+22 more)

### Community 13 - "services/auth.ts"
Cohesion: 0.09
Nodes (27): @adonisjs/hash, jose, jsonwebtoken, POST, generateToken(), secret(), TOKEN_MAX_AGE_SECONDS, TokenPayload (+19 more)

### Community 14 - "useAuth"
Cohesion: 0.09
Nodes (25): ClinicsPage(), AlterarPlanoContent(), AlterarPlanoPage(), plansMetadata, AlterarPlanoContent(), AlterarPlanoPage(), plansMetadata, DIAS_SEMANA_KEYS (+17 more)

### Community 15 - "services/veterinarios.ts"
Cohesion: 0.12
Nodes (33): PUT, GET, PublicUser, serializeUser(), dateColumn(), Db, dirtyFields(), enderecoWriteData() (+25 more)

### Community 16 - "AsaasService"
Cohesion: 0.12
Nodes (15): @prisma/client, PATCH, POST, AsaasEnv, AsaasService, CreateSubscriptionInput, CustomerUser, getCheckoutUrl() (+7 more)

### Community 17 - "ok"
Cohesion: 0.12
Nodes (17): GET, POST, POST, GET, DELETE, GET, POST, GET (+9 more)

### Community 18 - "onboarding/clinica/page.tsx"
Cohesion: 0.15
Nodes (23): COMODIDADES_MAP, DIAS_KEYS, DIAS_SEMANA_MAP, Especialidade, PerfilClinica(), Toast(), ClinicaOnboardingPage(), COMODIDADES_LIST (+15 more)

### Community 19 - "storage.ts"
Cohesion: 0.15
Nodes (21): CalendarState, decodeState(), GET(), withParam(), env(), requiredEnv(), getAuthUrl(), resend() (+13 more)

### Community 20 - "SearchBar.tsx"
Cohesion: 0.11
Nodes (18): react-dom, SearchBarProps, UserLocation, CitySearchSection(), CitySearchSectionProps, BaseDropdownProps, CityDropdown(), CityOption (+10 more)

### Community 21 - "signup/tutor/page.tsx"
Cohesion: 0.12
Nodes (14): ForgotPasswordPage(), LoginPage(), ResetPasswordForm(), ResetPasswordPage(), TutorSignup(), MiniCalendar(), CustomSelect(), CustomSelectProps (+6 more)

### Community 22 - "db.ts"
Cohesion: 0.21
Nodes (16): POST, DELETE, PATCH, GET, POST, POST, globalForPrisma, prisma (+8 more)

### Community 23 - "veterinario-dashboard.ts"
Cohesion: 0.17
Nodes (18): GET, PATCH, PATCH, GET, GET, POST, agendamentosError(), estatisticas() (+10 more)

### Community 24 - "package.json"
Cohesion: 0.09
Nodes (22): name, private, version, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, eslint, eslint-config-next, lottie-react (+14 more)

### Community 25 - "google.ts"
Cohesion: 0.20
Nodes (17): GET, GET, buildAuthorizeUrl(), callbackError(), clearStateCookie(), createState(), fetchGoogleUser(), frontendBaseUrl() (+9 more)

### Community 26 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @adonisjs/hash, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, country-state-city, jose, lottie-react (+13 more)

### Community 27 - "api.tsx"
Cohesion: 0.16
Nodes (11): PerfilTutor(), Toast(), SocialSignupContent(), SocialSignupPage(), api, API_BASE_URL, CriarAvaliacaoPayload, TutorService (+3 more)

### Community 28 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 29 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.11
Nodes (18): API and Contract Rules, Cache Rules, Code Generation Rules, Data Boundary Rules, Deployment and Startup Rules, Final Instruction, Incidents, Capacity, and Runtime Control, Interconnect, Routing, Security, and Chaos Rules (+10 more)

### Community 30 - "Arquitetura Lince Pet (Next.js fullstack)"
Cohesion: 0.14
Nodes (10): Testes de contrato Adonis x Next, OAuth Google (login social e Calendar), Backend em Route Handlers do Next.js, Prisma + MySQL (schema derivado das migrations do Adonis), E-mails via Resend com templates Edge convertidos, Uploads multipart para S3/CloudFront, Arquitetura Lince Pet (Next.js fullstack), handleError() (+2 more)

### Community 31 - "React Composition Patterns"
Cohesion: 0.12
Nodes (16): 1.1 Avoid Boolean Prop Proliferation, 1.2 Use Compound Components, 1. Component Architecture, 2.1 Decouple State Management from UI, 2.2 Define Generic Context Interfaces for Dependency Injection, 2.3 Lift State into Provider Components, 2. State Management, 3.1 Create Explicit Component Variants (+8 more)

### Community 32 - "OBEY Patterns of Enterprise Application Architecture by Martin Fowler"
Cohesion: 0.12
Nodes (16): Architectural Baseline, Code Generation Rules, Distribution Rules, Final Instruction, Layering, OBEY Patterns of Enterprise Application Architecture by Martin Fowler, Object-Relational Mapping Pattern Index, Offline and Integration Rules (+8 more)

### Community 33 - "OBEY Refactoring by Martin Fowler"
Cohesion: 0.12
Nodes (16): Class and Module Rules, Code Generation Rules, Data and Mutation Rules, Error Handling Rules, Final Instruction, Function-Level Rules, Non-Negotiable Rules, OBEY Refactoring by Martin Fowler (+8 more)

### Community 34 - "5. Re-render Optimization"
Cohesion: 0.12
Nodes (16): 5.10 Subscribe to Derived State, 5.11 Use Functional setState Updates, 5.12 Use Lazy State Initialization, 5.13 Use Transitions for Non-Urgent Updates, 5.14 Use useDeferredValue for Expensive Derived Renders, 5.15 Use useRef for Transient Values, 5.1 Calculate Derived State During Rendering, 5.2 Defer State Reads to Usage Point (+8 more)

### Community 35 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, jsonwebtoken, postcss, tailwindcss, @tailwindcss/postcss (+8 more)

### Community 36 - "json"
Cohesion: 0.23
Nodes (12): axios, GET, GET, GET, GET, DELETE, json(), unprocessable() (+4 more)

### Community 37 - "veterinarios/route.ts"
Cohesion: 0.14
Nodes (11): @vinejs/vine, GET, listVeterinarios(), VeterinarioRegistrationData, loginUserValidator, createAvaliacaoValidator, createEnderecoValidator, updateEnderecoValidator (+3 more)

### Community 38 - "7. JavaScript Performance"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 39 - "Quick Reference"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 40 - "services/avaliacoes.ts"
Cohesion: 0.35
Nodes (11): GET, GET, AvaliacaoComRelacoes, formatDataConsulta(), listarAvaliacoes(), media(), petResumo(), quando() (+3 more)

### Community 41 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.15
Nodes (13): Architecture Economics and Priority, Boundary Cost, Deployment, and Operations, Final Instruction, Naming Rules, Non-Negotiable Rules, OBEY Clean Architecture by Robert C. Martin, Output Expectations, Paradigm and Component Rules (+5 more)

### Community 42 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.15
Nodes (13): Code Generation Rules, Default Workflow for Legacy Changes, Dependency-Breaking Technique Index, Final Instruction, Legacy Refactoring Heuristics, Non-Negotiable Rules, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary Directive (+5 more)

### Community 43 - "clinicas/[id]/route.ts"
Cohesion: 0.36
Nodes (9): GET, GET, GET, GET, especialidadesPorEntidade(), mediaAvaliacoes(), serializeClinica(), serializeEndereco() (+1 more)

### Community 44 - "Code Smell Policy"
Cohesion: 0.17
Nodes (12): Code Smell Policy, Data Clumps and Primitive Obsession, Divergent Change, Duplicated Code, Feature Envy, Global Data and Hidden Dependencies, Long Functions, Long Parameter Lists (+4 more)

### Community 45 - "6. Rendering Performance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 46 - "UploadedFile"
Cohesion: 0.18
Nodes (3): formatBytes(), parseSize(), UploadedFile

### Community 47 - "google-calendar.ts"
Cohesion: 0.27
Nodes (11): addEventToUserCalendar(), buildEventDateTime(), CalendarAgendamento, CalendarUser, createEventForAppointment(), EventContext, exchangeCodeForTokens(), findUserWithTokens() (+3 more)

### Community 48 - "React Composition Patterns"
Cohesion: 0.18
Nodes (10): 1. Component Architecture (HIGH), 2. State Management (MEDIUM), 3. Implementation Patterns (MEDIUM), 4. React 19 APIs (MEDIUM), Full Compiled Document, How to Use, Quick Reference, React Composition Patterns (+2 more)

### Community 49 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 50 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Clean Architecture by Robert C. Martin, Primary bias to correct, Trigger rules, When to use, Clean Architecture Skill

### Community 51 - "OBEY Patterns of Enterprise Application Architecture by Martin Fowler"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Patterns of Enterprise Application Architecture by Martin Fowler, Primary bias to correct, Trigger rules, When to use, Patterns of Enterprise Application Architecture Skill

### Community 52 - "OBEY Refactoring by Martin Fowler"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Refactoring by Martin Fowler, Primary bias to correct, Trigger rules, When to use, Refactoring Skill

### Community 53 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Release It! by Michael T. Nygard, Primary bias to correct, Trigger rules, When to use, Release It! Skill

### Community 54 - "React Composition Patterns"
Cohesion: 0.20
Nodes (9): Component Architecture (CRITICAL), Core Principles, Creating a New Rule, Impact Levels, Implementation Patterns (MEDIUM), React Composition Patterns, Rules, State Management (HIGH) (+1 more)

### Community 55 - "React Best Practices"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 56 - "Sections"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 57 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.20
Nodes (7): Working Effectively with Legacy Code Skill, Decision rules, Final checklist, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary bias to correct, Trigger rules, When to use

### Community 58 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:pull, dev, lint, postinstall, start, test (+1 more)

### Community 59 - "Forbidden Patterns"
Cohesion: 0.25
Nodes (8): Controller-Centric Logic, Database Leakage, Direction Violations, Forbidden Patterns, Framework Leakage, God Services, Layer Bypass, Utility Dumping Grounds

### Community 60 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (5): compat, __dirname, eslintConfig, __filename, @eslint/eslintrc

### Community 61 - "session.ts"
Cohesion: 0.43
Nodes (5): POST, GET, AUTH_COOKIE, clearAuthCookie(), getUserProfile()

### Community 62 - "Code Generation Rules"
Cohesion: 0.29
Nodes (7): 1. Define the Use Case First, 2. Use Plain Models at Boundaries, 3. Create Ports for Volatile Dependencies, 4. Keep Wiring in the Main Component, 5. Prefer Stable Dependencies, 6. Keep Boundaries Visible, Code Generation Rules

### Community 63 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Clean Architecture by Robert C. Martin, Primary bias to correct, Trigger rules, When to use

### Community 64 - "Forbidden Patterns"
Cohesion: 0.29
Nodes (7): Controller-Centric Enterprise App, Distributed Object Fantasy, Forbidden Patterns, Generic Repository Everywhere, Layering Theater, ORM-Driven Everything, Unclear Transaction Ownership

### Community 65 - "OBEY Patterns of Enterprise Application Architecture by Martin Fowler"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Patterns of Enterprise Application Architecture by Martin Fowler, Primary bias to correct, Trigger rules, When to use

### Community 66 - "OBEY Refactoring by Martin Fowler"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Refactoring by Martin Fowler, Primary bias to correct, Trigger rules, When to use

### Community 67 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Release It! by Michael T. Nygard, Primary bias to correct, Trigger rules, When to use

### Community 68 - "1. Eliminating Waterfalls"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 69 - "2. Bundle Size Optimization"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 70 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary bias to correct, Trigger rules, When to use

### Community 71 - "Persistence Pattern Rules"
Cohesion: 0.33
Nodes (6): Active Record, Data Mapper, Persistence Pattern Rules, Repository, Row Data Gateway, Table Data Gateway

### Community 72 - "Forbidden Patterns"
Cohesion: 0.33
Nodes (6): Abstracting Too Early, Big-Bang Rewrite, Forbidden Patterns, Mixed-Intent Patches, Refactoring Theater, Untested Structural Surgery

### Community 73 - "Refactoring Catalog Index"
Cohesion: 0.33
Nodes (6): Composing Methods, Generalization and Big Refactorings, Moving Features, Organizing Data, Refactoring Catalog Index, Simplifying Calls and Conditionals

### Community 74 - "Preferred Refactoring Moves"
Cohesion: 0.33
Nodes (6): Data Refactorings, Extraction Refactorings, Movement Refactorings, Naming Refactorings, Preferred Refactoring Moves, Simplification Refactorings

### Community 75 - "Load and Capacity Rules"
Cohesion: 0.33
Nodes (6): Additional Stability Patterns, Back Pressure, Demand Control, Load and Capacity Rules, Load Shedding, Queues

### Community 76 - "Forbidden Patterns"
Cohesion: 0.33
Nodes (6): Blast-Radius Amplification, Collapse by Queue, Forbidden Patterns, Happy-Path Design, Retry Storms, Silent Failure

### Community 77 - "Sections"
Cohesion: 0.33
Nodes (5): 1. Component Architecture (architecture), 2. State Management (state), 3. Implementation Patterns (patterns), 4. React 19 APIs (react19), Sections

### Community 78 - "React Best Practices"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 79 - "Handling Risky Areas"
Cohesion: 0.33
Nodes (6): Constructors Doing Too Much, Database-Heavy Code, Handling Risky Areas, Large Methods, Static and Global Dependencies, UI or Framework Code

### Community 80 - "Preferred Legacy Techniques"
Cohesion: 0.33
Nodes (6): Extract and Override Call, Preferred Legacy Techniques, Sprout Class, Sprout Method, Wrap Class, Wrap Method

### Community 81 - "Required Layer Responsibilities"
Cohesion: 0.40
Nodes (5): Application Layer, Domain Layer, Infrastructure Layer, Interface Adapters Layer, Required Layer Responsibilities

### Community 82 - "Architecture Heuristics"
Cohesion: 0.40
Nodes (5): Architecture Heuristics, Dependency Direction, Feature First Structure, Policy vs Detail, Stable Core, Replaceable Edge

### Community 83 - "Concurrency and Transaction Rules"
Cohesion: 0.40
Nodes (5): Additional Offline Concurrency Patterns, Concurrency and Transaction Rules, Optimistic Offline Lock, Pessimistic Locking, Transaction Boundaries

### Community 84 - "Dependency Protection Rules"
Cohesion: 0.40
Nodes (5): Bulkheads and Isolation, Circuit Breakers and Fast Failure, Dependency Protection Rules, Retries Must Be Disciplined, Timeouts Are Mandatory

### Community 85 - "8. Advanced Patterns"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 86 - "Web Interface Guidelines"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 87 - "Dependency Breaking Rules"
Cohesion: 0.40
Nodes (5): Construction Problems, Dependency Breaking Rules, Hard Outputs, Hidden Inputs, Required Moves

### Community 88 - "Forbidden Patterns"
Cohesion: 0.40
Nodes (5): Cosmetic Refactoring Only, Forbidden Patterns, Hidden Dependency Expansion, No-Safety Change, Rewrite as the First Move

### Community 89 - "CityAutocomplete.tsx"
Cohesion: 0.40
Nodes (3): country-state-city, CityAutocompleteProps, CityOption

### Community 90 - "Testing Rules"
Cohesion: 0.50
Nodes (4): Adapter Tests, Core Tests First, Test Through Supported Boundaries, Testing Rules

### Community 91 - "Preferred Default Shapes"
Cohesion: 0.50
Nodes (4): Preferred Default Shapes, Preferred dependency pattern, Preferred feature shape, Preferred use case shape

### Community 92 - "Application Workflow Rules"
Cohesion: 0.50
Nodes (4): Application Workflow Rules, Data Transfer Object, Remote Facade, Service Layer

### Community 93 - "Choosing the Business Logic Pattern"
Cohesion: 0.50
Nodes (4): Choosing the Business Logic Pattern, Domain Model, Table Module, Transaction Script

### Community 94 - "Identity, Caching, and Unit-of-Work Rules"
Cohesion: 0.50
Nodes (4): Identity, Caching, and Unit-of-Work Rules, Identity Map, Lazy Load, Unit of Work

### Community 95 - "Safety Rules"
Cohesion: 0.50
Nodes (4): Commit and Patch Discipline, Preparatory Refactoring, Safety Rules, Tests and Verification

### Community 96 - "Operational Visibility Rules"
Cohesion: 0.50
Nodes (4): Logging, Metrics, Observability Is Part of the Design, Operational Visibility Rules

### Community 98 - "Prefer Statically Analyzable Paths"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 100 - "Testing Strategy Rules"
Cohesion: 0.50
Nodes (4): Characterization Tests, New Behavior Tests, Testability Improvements, Testing Strategy Rules

### Community 101 - "Seam Rules"
Cohesion: 0.67
Nodes (3): Required Behavior, Seam Rules, What Counts as a Useful Seam

## Knowledge Gaps
- **16 isolated node(s):** `@aws-sdk/s3-request-presigner`, `eslint`, `eslint-config-next`, `postcss`, `prisma` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 914 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `next` to `react`, `services/bloqueios.ts`, `dashboard/veterinario/page.tsx`, `onboarding/page.tsx`, `services/anotacoes.ts`, `AuthContext.tsx`, `http.ts`, `useAuth`, `onboarding/clinica/page.tsx`, `storage.ts`, `SearchBar.tsx`, `signup/tutor/page.tsx`, `package.json`, `google.ts`, `api.tsx`, `session.ts`?**
  _High betweenness centrality (0.178) - this node is a cross-community bridge._
- **What connects `@aws-sdk/s3-request-presigner`, `eslint`, `eslint-config-next` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.04847963281698221 - nodes in this community are weakly interconnected._
- **Why does `server-only` connect `server-only` to `services/bloqueios.ts`, `.from`, `services/anotacoes.ts`, `http.ts`, `requireUser`, `services/onboarding.ts`, `services/auth.ts`, `services/veterinarios.ts`, `AsaasService`, `storage.ts`, `db.ts`, `veterinario-dashboard.ts`, `package.json`, `google.ts`, `json`, `veterinarios/route.ts`, `services/avaliacoes.ts`, `google-calendar.ts`, `session.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `services/bloqueios.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06558558558558558 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `dashboard/veterinario/page.tsx`, `onboarding/page.tsx`, `BloqueioAgendaModal.tsx`, `next`, `AuthContext.tsx`, `useAuth`, `onboarding/clinica/page.tsx`, `SearchBar.tsx`, `signup/tutor/page.tsx`, `package.json`, `CityAutocomplete.tsx`, `api.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `dashboard/veterinario/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05834464043419267 - nodes in this community are weakly interconnected._