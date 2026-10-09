# Graph Report - Lince-Pet-main  (2026-10-08)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1775 nodes · 4467 edges · 182 communities (99 shown, 83 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- api/agendamentos/route.ts
- requireUser
- veterinario/[id]/page.tsx
- updating
- services/veterinarios.ts
- explorar/page.tsx
- onboarding/page.tsx
- dashboard/veterinario/page.tsx
- useAuth
- react
- Header.tsx
- AsaasService
- services/auth.ts
- db.ts
- ok
- serverError
- clinica/perfil/page.tsx
- dashboard/tutor/page.tsx
- veterinario-dashboard.ts
- onboarding/clinica/page.tsx
- services/notifications.ts
- dependencies
- signup/veterinario/page.tsx
- google.ts
- pets/[id]/photo/route.ts
- @vinejs/vine
- compilerOptions
- OBEY Release It! by Michael T. Nygard
- package.json
- env
- server-only
- React Composition Patterns
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- 5. Re-render Optimization
- 7. JavaScript Performance
- Quick Reference
- storage.ts
- OBEY Clean Architecture by Robert C. Martin
- OBEY Working Effectively with Legacy Code by Michael Feathers
- devDependencies
- Code Smell Policy
- 6. Rendering Performance
- UploadedFile
- React Composition Patterns
- 3. Server-Side Performance
- contract.test.ts
- OBEY Clean Architecture by Robert C. Martin
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- OBEY Release It! by Michael T. Nygard
- React Composition Patterns
- React Best Practices
- Sections
- OBEY Working Effectively with Legacy Code by Michael Feathers
- services/brazilapi.ts
- scripts
- upload-photo/route.ts
- Forbidden Patterns
- eslint.config.mjs
- Code Generation Rules
- OBEY Clean Architecture by Robert C. Martin
- Forbidden Patterns
- OBEY Patterns of Enterprise Application Architecture by Martin Fowler
- OBEY Refactoring by Martin Fowler
- OBEY Release It! by Michael T. Nygard
- 1. Eliminating Waterfalls
- 2. Bundle Size Optimization
- OBEY Working Effectively with Legacy Code by Michael Feathers
- services/tutor.ts
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
- signup/page.tsx
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
- SuccessScreen/README.md

## God Nodes (most connected - your core abstractions)
1. `requireUser()` - 139 edges
2. `ok()` - 130 edges
3. `serverError()` - 101 edges
4. `route()` - 89 edges
5. `ApiRequest` - 86 edges
6. `prisma` - 68 edges
7. `updating()` - 67 edges
8. `badRequest()` - 59 edges
9. `react` - 56 edges
10. `json()` - 51 edges

## Surprising Connections (you probably didn't know these)
- `Relacoes User->tutor/veterinario/clinica como listas` --conceptually_related_to--> `requireUser()`  [INFERRED]
  docs/ARQUITETURA.md → src/server/auth/session.ts
- `E-mails via Resend com templates Edge convertidos` --implements--> `sendMail()`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/services/mail.ts
- `Contrato HTTP herdado do Adonis` --implements--> `ApiRequest`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/http.ts
- `Contrato HTTP herdado do Adonis` --implements--> `route()`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/http.ts
- `Compatibilidade com serializacao do Lucid` --implements--> `json()`  [EXTRACTED]
  docs/ARQUITETURA.md → src/server/http.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Pipeline de uma requisicao /api** — src_server_http_route, src_server_http_apirequest, src_server_auth_session_requireuser, src_server_db_prisma, src_server_http_json, src_server_http_handleerror [EXTRACTED 1.00]

## Communities (182 total, 83 thin omitted)

### Community 0 - "api/agendamentos/route.ts"
Cohesion: 0.06
Nodes (49): Testes de contrato Adonis x Next, OAuth Google (login social e Calendar), Backend em Route Handlers do Next.js, Prisma + MySQL (schema derivado das migrations do Adonis), E-mails via Resend com templates Edge convertidos, Arquitetura Lince Pet (Next.js fullstack), luxon, PATCH (+41 more)

### Community 1 - "requireUser"
Cohesion: 0.11
Nodes (31): POST, GET, GET, DELETE, GET, POST, GET, POST (+23 more)

### Community 2 - "veterinario/[id]/page.tsx"
Cohesion: 0.07
Nodes (27): lottie-react, ClinicProfilePage(), loadClinic(), COMODIDADES_LIST, getComodidadeLabel(), TutorDashboard(), Location, Veterinario (+19 more)

### Community 3 - "updating"
Cohesion: 0.10
Nodes (40): POST, statusNormalizado(), DELETE, POST, GET, GET, POST, POST (+32 more)

### Community 4 - "services/veterinarios.ts"
Cohesion: 0.08
Nodes (51): POST, PublicUser, completeOnboarding(), deleteVeterinario(), getProgress(), listVeterinarios(), nextStep(), processStep1() (+43 more)

### Community 5 - "explorar/page.tsx"
Cohesion: 0.06
Nodes (33): react-dom, Clinica, ExplorarContent(), ExplorarPage(), Veterinario, Home(), PlatformFeatures(), SearchBar() (+25 more)

### Community 6 - "onboarding/page.tsx"
Cohesion: 0.08
Nodes (36): DIAS_SEMANA_KEYS, DIAS_SEMANA_MAP, Endereco, Especialidade, PerfilVeterinario(), Toast(), Especialidade, LocationData (+28 more)

### Community 7 - "dashboard/veterinario/page.tsx"
Cohesion: 0.07
Nodes (32): lucide-react, moment, CalendarEvent, DashboardData, CalendarEvent, DashboardData, OnboardingData, OnboardingResponse (+24 more)

### Community 8 - "useAuth"
Cohesion: 0.10
Nodes (23): ClinicsPage(), PerfilTutor(), Toast(), LoginPage(), SocialSignupContent(), SocialSignupPage(), TutorSignup(), AuthRedirect() (+15 more)

### Community 9 - "react"
Cohesion: 0.07
Nodes (17): nextConfig, next, react, ForgotPasswordPage(), metadata, ResetPasswordForm(), ResetPasswordPage(), metadata (+9 more)

### Community 10 - "Header.tsx"
Cohesion: 0.07
Nodes (16): fredoka, inter, metadata, RootLayout(), viewport, Footer(), ClinicRequestModal(), ClinicRequestModalProps (+8 more)

### Community 11 - "AsaasService"
Cohesion: 0.10
Nodes (17): PATCH, POST, GET, POST, AsaasEnv, AsaasService, BillingType, CreateSubscriptionInput (+9 more)

### Community 12 - "services/auth.ts"
Cohesion: 0.11
Nodes (22): @adonisjs/hash, jsonwebtoken, POST, generateToken(), secret(), TOKEN_MAX_AGE_SECONDS, TokenPayload, UserType (+14 more)

### Community 13 - "db.ts"
Cohesion: 0.16
Nodes (21): @prisma/client, GET, GET, POST, POST, GET, POST, GET (+13 more)

### Community 14 - "ok"
Cohesion: 0.16
Nodes (21): GET, POST, GET, GET, GET, GET, GET, GET (+13 more)

### Community 15 - "serverError"
Cohesion: 0.16
Nodes (22): GET, PATCH, GET, POST, GET, GET, POST, POST (+14 more)

### Community 16 - "clinica/perfil/page.tsx"
Cohesion: 0.16
Nodes (16): ClinicaDashboard(), COMODIDADES_MAP, DIAS_KEYS, DIAS_SEMANA_MAP, Especialidade, PerfilClinica(), Toast(), ClinicaOnboardingPage() (+8 more)

### Community 17 - "dashboard/tutor/page.tsx"
Cohesion: 0.11
Nodes (16): AppointmentItem(), AppointmentItemProps, FavoriteItem, FavoritesList(), ESPECIES, Pet, PORTE_OPCOES, RACAS_POR_ESPECIE (+8 more)

### Community 18 - "veterinario-dashboard.ts"
Cohesion: 0.19
Nodes (18): PATCH, PATCH, GET, GET, POST, agendamentosError(), estatisticas(), estatisticasError() (+10 more)

### Community 19 - "onboarding/clinica/page.tsx"
Cohesion: 0.14
Nodes (16): AlterarPlanoContent(), AlterarPlanoPage(), plansMetadata, AlterarPlanoContent(), AlterarPlanoPage(), plansMetadata, COMODIDADES_LIST, DIAS_SEMANA_MAP (+8 more)

### Community 20 - "services/notifications.ts"
Cohesion: 0.21
Nodes (19): forgotPasswordEmail(), forgotPassword(), escapeHtml(), sendMail(), buildLogoHtml(), composePixEmailHtml(), fromAddress(), generateCode() (+11 more)

### Community 21 - "dependencies"
Cohesion: 0.10
Nodes (21): dependencies, @adonisjs/hash, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, axios, country-state-city, jose, lottie-react (+13 more)

### Community 22 - "signup/veterinario/page.tsx"
Cohesion: 0.21
Nodes (13): ClinicaSignup(), Page(), Page(), plansMetadata, VeterinarioSignup(), Tooltip(), TooltipProps, fetchCep() (+5 more)

### Community 23 - "google.ts"
Cohesion: 0.24
Nodes (15): GET, GET, buildAuthorizeUrl(), callbackError(), clearStateCookie(), createState(), fetchGoogleUser(), frontendBaseUrl() (+7 more)

### Community 24 - "pets/[id]/photo/route.ts"
Cohesion: 0.25
Nodes (14): POST, DELETE, PATCH, GET, POST, POST, HttpError, firstFile() (+6 more)

### Community 25 - "@vinejs/vine"
Cohesion: 0.11
Nodes (11): @vinejs/vine, vitest, createAvaliacaoValidator, createClinicaValidator, createEnderecoValidator, updateEnderecoValidator, createPetValidator, updatePetValidator (+3 more)

### Community 26 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 27 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.11
Nodes (18): API and Contract Rules, Cache Rules, Code Generation Rules, Data Boundary Rules, Deployment and Startup Rules, Final Instruction, Incidents, Capacity, and Runtime Control, Interconnect, Routing, Security, and Chaos Rules (+10 more)

### Community 28 - "package.json"
Cohesion: 0.11
Nodes (17): name, private, version, @aws-sdk/s3-request-presigner, eslint, eslint-config-next, prisma, react-big-calendar (+9 more)

### Community 29 - "env"
Cohesion: 0.21
Nodes (14): jose, CalendarState, decodeState(), GET(), withParam(), env(), isProduction, requiredEnv() (+6 more)

### Community 30 - "server-only"
Cohesion: 0.21
Nodes (12): server-only, appointmentCancellation(), AppointmentCancellationData, appointmentConfirmation(), AppointmentConfirmationData, appointmentRescheduled(), AppointmentRescheduledData, appointmentRescheduledVet() (+4 more)

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

### Community 35 - "7. JavaScript Performance"
Cohesion: 0.13
Nodes (15): 7.10 Hoist RegExp Creation, 7.11 Use flatMap to Map and Filter in One Pass, 7.12 Use Loop for Min/Max Instead of Sort, 7.13 Use Set/Map for O(1) Lookups, 7.14 Use toSorted() Instead of sort() for Immutability, 7.1 Avoid Layout Thrashing, 7.2 Build Index Maps for Repeated Lookups, 7.3 Cache Property Access in Loops (+7 more)

### Community 36 - "Quick Reference"
Cohesion: 0.13
Nodes (14): 1. Eliminating Waterfalls (CRITICAL), 2. Bundle Size Optimization (CRITICAL), 3. Server-Side Performance (HIGH), 4. Client-Side Data Fetching (MEDIUM-HIGH), 5. Re-render Optimization (MEDIUM), 6. Rendering Performance (MEDIUM), 7. JavaScript Performance (LOW-MEDIUM), 8. Advanced Patterns (LOW) (+6 more)

### Community 37 - "storage.ts"
Cohesion: 0.24
Nodes (11): Uploads multipart para S3/CloudFront, @aws-sdk/client-s3, bucket(), deleteObject(), publicBaseUrl(), region(), s3(), StorageFile (+3 more)

### Community 38 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.15
Nodes (13): Architecture Economics and Priority, Boundary Cost, Deployment, and Operations, Final Instruction, Naming Rules, Non-Negotiable Rules, OBEY Clean Architecture by Robert C. Martin, Output Expectations, Paradigm and Component Rules (+5 more)

### Community 39 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.15
Nodes (13): Code Generation Rules, Default Workflow for Legacy Changes, Dependency-Breaking Technique Index, Final Instruction, Legacy Refactoring Heuristics, Non-Negotiable Rules, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary Directive (+5 more)

### Community 40 - "devDependencies"
Cohesion: 0.15
Nodes (13): devDependencies, eslint, eslint-config-next, @eslint/eslintrc, jsonwebtoken, @types/jsonwebtoken, @types/luxon, @types/node (+5 more)

### Community 41 - "Code Smell Policy"
Cohesion: 0.17
Nodes (12): Code Smell Policy, Data Clumps and Primitive Obsession, Divergent Change, Duplicated Code, Feature Envy, Global Data and Hidden Dependencies, Long Functions, Long Parameter Lists (+4 more)

### Community 42 - "6. Rendering Performance"
Cohesion: 0.17
Nodes (12): 6.10 Use React DOM Resource Hints, 6.11 Use useTransition Over Manual Loading States, 6.1 Animate SVG Wrapper Instead of SVG Element, 6.2 CSS content-visibility for Long Lists, 6.3 Hoist Static JSX Elements, 6.4 Optimize SVG Precision, 6.5 Prevent Hydration Mismatch Without Flickering, 6.6 Suppress Expected Hydration Mismatches (+4 more)

### Community 43 - "UploadedFile"
Cohesion: 0.18
Nodes (3): formatBytes(), parseSize(), UploadedFile

### Community 44 - "React Composition Patterns"
Cohesion: 0.18
Nodes (10): 1. Component Architecture (HIGH), 2. State Management (MEDIUM), 3. Implementation Patterns (MEDIUM), 4. React 19 APIs (MEDIUM), Full Compiled Document, How to Use, Quick Reference, React Composition Patterns (+2 more)

### Community 45 - "3. Server-Side Performance"
Cohesion: 0.18
Nodes (10): 3.10 Use after() for Non-Blocking Operations, 3.1 Authenticate Server Actions Like API Routes, 3.2 Avoid Duplicate Serialization in RSC Props, 3.3 Avoid Shared Module State for Request Data, 3.4 Cross-Request LRU Caching, 3.5 Hoist Static I/O to Module Level, 3.6 Minimize Serialization at RSC Boundaries, 3.7 Parallel Data Fetching with Component Composition (+2 more)

### Community 46 - "contract.test.ts"
Cohesion: 0.24
Nodes (9): ContractCase, contractCases, Role, ADONIS, call(), enabled, fillPath(), NEXT (+1 more)

### Community 47 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Clean Architecture by Robert C. Martin, Primary bias to correct, Trigger rules, When to use, Clean Architecture Skill

### Community 48 - "OBEY Patterns of Enterprise Application Architecture by Martin Fowler"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Patterns of Enterprise Application Architecture by Martin Fowler, Primary bias to correct, Trigger rules, When to use, Patterns of Enterprise Application Architecture Skill

### Community 49 - "OBEY Refactoring by Martin Fowler"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Refactoring by Martin Fowler, Primary bias to correct, Trigger rules, When to use, Refactoring Skill

### Community 50 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.20
Nodes (7): Decision rules, Final checklist, OBEY Release It! by Michael T. Nygard, Primary bias to correct, Trigger rules, When to use, Release It! Skill

### Community 51 - "React Composition Patterns"
Cohesion: 0.20
Nodes (9): Component Architecture (CRITICAL), Core Principles, Creating a New Rule, Impact Levels, Implementation Patterns (MEDIUM), React Composition Patterns, Rules, State Management (HIGH) (+1 more)

### Community 52 - "React Best Practices"
Cohesion: 0.20
Nodes (9): 4.1 Deduplicate Global Event Listeners, 4.2 Use Passive Event Listeners for Scrolling Performance, 4.3 Use SWR for Automatic Deduplication, 4.4 Version and Minimize localStorage Data, 4. Client-Side Data Fetching, Abstract, React Best Practices, References (+1 more)

### Community 53 - "Sections"
Cohesion: 0.20
Nodes (9): 1. Eliminating Waterfalls (async), 2. Bundle Size Optimization (bundle), 3. Server-Side Performance (server), 4. Client-Side Data Fetching (client), 5. Re-render Optimization (rerender), 6. Rendering Performance (rendering), 7. JavaScript Performance (js), 8. Advanced Patterns (advanced) (+1 more)

### Community 54 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.20
Nodes (7): Working Effectively with Legacy Code Skill, Decision rules, Final checklist, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary bias to correct, Trigger rules, When to use

### Community 55 - "services/brazilapi.ts"
Cohesion: 0.38
Nodes (7): axios, GET, GET, api, fetchCep(), fetchCnpj(), isNotFoundOrTimeout()

### Community 56 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, db:pull, dev, lint, postinstall, start, test (+1 more)

### Community 57 - "upload-photo/route.ts"
Cohesion: 0.36
Nodes (7): POST, POST, dirtyFields(), saveClinica(), saveUser(), str(), uploadClinicaPhoto()

### Community 58 - "Forbidden Patterns"
Cohesion: 0.25
Nodes (8): Controller-Centric Logic, Database Leakage, Direction Violations, Forbidden Patterns, Framework Leakage, God Services, Layer Bypass, Utility Dumping Grounds

### Community 59 - "eslint.config.mjs"
Cohesion: 0.25
Nodes (5): compat, __dirname, eslintConfig, __filename, @eslint/eslintrc

### Community 60 - "Code Generation Rules"
Cohesion: 0.29
Nodes (7): 1. Define the Use Case First, 2. Use Plain Models at Boundaries, 3. Create Ports for Volatile Dependencies, 4. Keep Wiring in the Main Component, 5. Prefer Stable Dependencies, 6. Keep Boundaries Visible, Code Generation Rules

### Community 61 - "OBEY Clean Architecture by Robert C. Martin"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Clean Architecture by Robert C. Martin, Primary bias to correct, Trigger rules, When to use

### Community 62 - "Forbidden Patterns"
Cohesion: 0.29
Nodes (7): Controller-Centric Enterprise App, Distributed Object Fantasy, Forbidden Patterns, Generic Repository Everywhere, Layering Theater, ORM-Driven Everything, Unclear Transaction Ownership

### Community 63 - "OBEY Patterns of Enterprise Application Architecture by Martin Fowler"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Patterns of Enterprise Application Architecture by Martin Fowler, Primary bias to correct, Trigger rules, When to use

### Community 64 - "OBEY Refactoring by Martin Fowler"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Refactoring by Martin Fowler, Primary bias to correct, Trigger rules, When to use

### Community 65 - "OBEY Release It! by Michael T. Nygard"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Release It! by Michael T. Nygard, Primary bias to correct, Trigger rules, When to use

### Community 66 - "1. Eliminating Waterfalls"
Cohesion: 0.29
Nodes (7): 1.1 Check Cheap Conditions Before Async Flags, 1.2 Defer Await Until Needed, 1.3 Dependency-Based Parallelization, 1.4 Prevent Waterfall Chains in API Routes, 1.5 Promise.all() for Independent Operations, 1.6 Strategic Suspense Boundaries, 1. Eliminating Waterfalls

### Community 67 - "2. Bundle Size Optimization"
Cohesion: 0.29
Nodes (7): 2.1 Avoid Barrel File Imports, 2.2 Conditional Module Loading, 2.3 Defer Non-Critical Third-Party Libraries, 2.4 Dynamic Imports for Heavy Components, 2.5 Prefer Statically Analyzable Paths, 2.6 Preload Based on User Intent, 2. Bundle Size Optimization

### Community 68 - "OBEY Working Effectively with Legacy Code by Michael Feathers"
Cohesion: 0.29
Nodes (6): Decision rules, Final checklist, OBEY Working Effectively with Legacy Code by Michael Feathers, Primary bias to correct, Trigger rules, When to use

### Community 69 - "services/tutor.ts"
Cohesion: 0.43
Nodes (4): POST, registerTutor(), TutorRegistrationData, createTutorValidator

### Community 70 - "Persistence Pattern Rules"
Cohesion: 0.33
Nodes (6): Active Record, Data Mapper, Persistence Pattern Rules, Repository, Row Data Gateway, Table Data Gateway

### Community 71 - "Forbidden Patterns"
Cohesion: 0.33
Nodes (6): Abstracting Too Early, Big-Bang Rewrite, Forbidden Patterns, Mixed-Intent Patches, Refactoring Theater, Untested Structural Surgery

### Community 72 - "Refactoring Catalog Index"
Cohesion: 0.33
Nodes (6): Composing Methods, Generalization and Big Refactorings, Moving Features, Organizing Data, Refactoring Catalog Index, Simplifying Calls and Conditionals

### Community 73 - "Preferred Refactoring Moves"
Cohesion: 0.33
Nodes (6): Data Refactorings, Extraction Refactorings, Movement Refactorings, Naming Refactorings, Preferred Refactoring Moves, Simplification Refactorings

### Community 74 - "Load and Capacity Rules"
Cohesion: 0.33
Nodes (6): Additional Stability Patterns, Back Pressure, Demand Control, Load and Capacity Rules, Load Shedding, Queues

### Community 75 - "Forbidden Patterns"
Cohesion: 0.33
Nodes (6): Blast-Radius Amplification, Collapse by Queue, Forbidden Patterns, Happy-Path Design, Retry Storms, Silent Failure

### Community 76 - "Sections"
Cohesion: 0.33
Nodes (5): 1. Component Architecture (architecture), 2. State Management (state), 3. Implementation Patterns (patterns), 4. React 19 APIs (react19), Sections

### Community 77 - "React Best Practices"
Cohesion: 0.33
Nodes (5): Creating a New Rule, Getting Started, React Best Practices, Rule File Structure, Structure

### Community 78 - "Handling Risky Areas"
Cohesion: 0.33
Nodes (6): Constructors Doing Too Much, Database-Heavy Code, Handling Risky Areas, Large Methods, Static and Global Dependencies, UI or Framework Code

### Community 79 - "Preferred Legacy Techniques"
Cohesion: 0.33
Nodes (6): Extract and Override Call, Preferred Legacy Techniques, Sprout Class, Sprout Method, Wrap Class, Wrap Method

### Community 80 - "Required Layer Responsibilities"
Cohesion: 0.40
Nodes (5): Application Layer, Domain Layer, Infrastructure Layer, Interface Adapters Layer, Required Layer Responsibilities

### Community 81 - "Architecture Heuristics"
Cohesion: 0.40
Nodes (5): Architecture Heuristics, Dependency Direction, Feature First Structure, Policy vs Detail, Stable Core, Replaceable Edge

### Community 82 - "Concurrency and Transaction Rules"
Cohesion: 0.40
Nodes (5): Additional Offline Concurrency Patterns, Concurrency and Transaction Rules, Optimistic Offline Lock, Pessimistic Locking, Transaction Boundaries

### Community 83 - "Dependency Protection Rules"
Cohesion: 0.40
Nodes (5): Bulkheads and Isolation, Circuit Breakers and Fast Failure, Dependency Protection Rules, Retries Must Be Disciplined, Timeouts Are Mandatory

### Community 84 - "8. Advanced Patterns"
Cohesion: 0.40
Nodes (5): 8.1 Do Not Put Effect Events in Dependency Arrays, 8.2 Initialize App Once, Not Per Mount, 8.3 Store Event Handlers in Refs, 8.4 useEffectEvent for Stable Callback Refs, 8. Advanced Patterns

### Community 85 - "Web Interface Guidelines"
Cohesion: 0.40
Nodes (4): Guidelines Source, How It Works, Usage, Web Interface Guidelines

### Community 86 - "Dependency Breaking Rules"
Cohesion: 0.40
Nodes (5): Construction Problems, Dependency Breaking Rules, Hard Outputs, Hidden Inputs, Required Moves

### Community 87 - "Forbidden Patterns"
Cohesion: 0.40
Nodes (5): Cosmetic Refactoring Only, Forbidden Patterns, Hidden Dependency Expansion, No-Safety Change, Rewrite as the First Move

### Community 88 - "CityAutocomplete.tsx"
Cohesion: 0.40
Nodes (3): country-state-city, CityAutocompleteProps, CityOption

### Community 89 - "Testing Rules"
Cohesion: 0.50
Nodes (4): Adapter Tests, Core Tests First, Test Through Supported Boundaries, Testing Rules

### Community 90 - "Preferred Default Shapes"
Cohesion: 0.50
Nodes (4): Preferred Default Shapes, Preferred dependency pattern, Preferred feature shape, Preferred use case shape

### Community 91 - "Application Workflow Rules"
Cohesion: 0.50
Nodes (4): Application Workflow Rules, Data Transfer Object, Remote Facade, Service Layer

### Community 92 - "Choosing the Business Logic Pattern"
Cohesion: 0.50
Nodes (4): Choosing the Business Logic Pattern, Domain Model, Table Module, Transaction Script

### Community 93 - "Identity, Caching, and Unit-of-Work Rules"
Cohesion: 0.50
Nodes (4): Identity, Caching, and Unit-of-Work Rules, Identity Map, Lazy Load, Unit of Work

### Community 94 - "Safety Rules"
Cohesion: 0.50
Nodes (4): Commit and Patch Discipline, Preparatory Refactoring, Safety Rules, Tests and Verification

### Community 95 - "Operational Visibility Rules"
Cohesion: 0.50
Nodes (4): Logging, Metrics, Observability Is Part of the Design, Operational Visibility Rules

### Community 97 - "Prefer Statically Analyzable Paths"
Cohesion: 0.50
Nodes (3): File-System Paths, Import Paths, Prefer Statically Analyzable Paths

### Community 99 - "Testing Strategy Rules"
Cohesion: 0.50
Nodes (4): Characterization Tests, New Behavior Tests, Testability Improvements, Testing Strategy Rules

### Community 101 - "Seam Rules"
Cohesion: 0.67
Nodes (3): Required Behavior, Seam Rules, What Counts as a Useful Seam

## Knowledge Gaps
- **13 isolated node(s):** `@aws-sdk/s3-request-presigner`, `eslint`, `eslint-config-next`, `prisma`, `react-big-calendar` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 876 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **83 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `react` to `api/agendamentos/route.ts`, `requireUser`, `veterinario/[id]/page.tsx`, `signup/page.tsx`, `explorar/page.tsx`, `onboarding/page.tsx`, `dashboard/veterinario/page.tsx`, `useAuth`, `Header.tsx`, `clinica/perfil/page.tsx`, `dashboard/tutor/page.tsx`, `onboarding/clinica/page.tsx`, `signup/veterinario/page.tsx`, `google.ts`, `@vinejs/vine`, `package.json`, `env`?**
  _High betweenness centrality (0.190) - this node is a cross-community bridge._
- **What connects `@aws-sdk/s3-request-presigner`, `eslint`, `eslint-config-next` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api/agendamentos/route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Why does `server-only` connect `server-only` to `api/agendamentos/route.ts`, `requireUser`, `updating`, `services/veterinarios.ts`, `storage.ts`, `services/tutor.ts`, `AsaasService`, `services/auth.ts`, `db.ts`, `ok`, `veterinario-dashboard.ts`, `services/notifications.ts`, `services/brazilapi.ts`, `google.ts`, `pets/[id]/photo/route.ts`, `@vinejs/vine`, `package.json`, `env`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Should `requireUser` be split into smaller, more focused modules?**
  _Cohesion score 0.10673076923076923 - nodes in this community are weakly interconnected._
- **Why does `react` connect `react` to `veterinario/[id]/page.tsx`, `explorar/page.tsx`, `onboarding/page.tsx`, `dashboard/veterinario/page.tsx`, `useAuth`, `Header.tsx`, `clinica/perfil/page.tsx`, `dashboard/tutor/page.tsx`, `onboarding/clinica/page.tsx`, `signup/veterinario/page.tsx`, `CityAutocomplete.tsx`, `package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Should `veterinario/[id]/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0672316384180791 - nodes in this community are weakly interconnected._