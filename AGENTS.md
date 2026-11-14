# Project instructions

For frontend work, read [frontend/AGENTS.md](frontend/AGENTS.md) for the component development workflow, [frontend/README.md](frontend/README.md) for existing component contracts, and [the token guide](frontend/tokens/README.md) for design-system usage. Reuse existing components before adding new ones.

## Components

Follow the **declarative compound headless component** pattern for UI controls with cooperating parts:

- Separate interaction behavior and state from visual styling. Use `@base-ui/react` for shared interaction primitives. Do not reimplement state, keyboard navigation, focus management, or dismissal already provided by Base UI. Native HTML remains appropriate where Base UI has no corresponding primitive.
- Expose composable parts through a declarative API, such as `Disclosure`, `Disclosure.Trigger`, and `Disclosure.Panel`. Dot notation groups the public API; React context connects the parts.
- Keep shared state in the root component and provide it to participating descendants through context. Extract custom hooks when they clarify or reuse behavior; separate calls to a state hook do not share state.
- Apply design-system styling through shared styled components, semantic design tokens, and documented variants. Screens should reuse these components rather than repeat behavior or styling wiring.
- Keep application data and product decisions outside generic UI primitives. Use product components to compose primitives for common workflows.
- Test the assembled component through observable behavior, including keyboard interaction, accessibility relationships, and independence between instances.

Use this pattern where composition is useful. Simple controls do not need compound parts or context merely for consistency with the pattern.

Before creating or changing compound UI components, read the [component and test exemplar](docs/design-system/component-exemplar.md). It demonstrates Base UI-backed compound composition and behavior tests. Base UI owns primitive context and interaction state; custom context should be limited to product-specific coordination.

Every public frontend component must have a colocated implementation, Storybook story, and behavior test in its own folder. See `frontend/AGENTS.md` and `frontend/README.md` for the implemented library, state contracts, and verification commands. Consider accessibility, keyboard interaction, async states, supported variance, and extensibility according to each component's responsibility.

Color, spacing, and sizing foundations are documented in `frontend/tokens/README.md`; JSON options and decisions are the source of truth and Style Dictionary generates CSS. Component styles consume decision tokens for color, spacing and sizing. Shared defaults live in the `even-components` CSS layer and support caller classes and inline styles; preserve Base UI behavior and styling APIs.
