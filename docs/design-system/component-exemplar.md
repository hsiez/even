# Base UI-backed compound component exemplar

Use Base UI for common interaction primitives. Do not build another context/state/keyboard engine for behavior it already provides. Product features may compose these controls and own their data. Keep presentation separate from behavior; shared CSS consumes decision tokens.

## Component: disclosure

The actual implementation is [Disclosure.jsx](../../frontend/src/components/Disclosure/Disclosure.jsx). It uses Base UI Collapsible to own context, expanded state, accessible relationships, and keyboard activation. Our wrapper provides compound naming and a keep-mounted default:

```jsx
import React from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { styledPart } from '../presentation';

const Root = styledPart(Collapsible.Root, "even-disclosure");
const StyledPanel = styledPart(Collapsible.Panel, "even-disclosure-panel");
function Panel(props) {
  return <StyledPanel keepMounted {...props} />;
}
export const Disclosure = Object.assign(Root, {
  Trigger: styledPart(Collapsible.Trigger, "even-button even-disclosure-trigger"),
  Panel,
});
```

`styledPart` only adds a default class, preserving refs, Base UI state-based `className` callbacks, styles, and events. It adds no interaction state or context. CSS in the `even-components` layer uses decision tokens; ordinary consumer CSS can override it.

Consumers arrange the parts without prop-drilling state:

```jsx
<Disclosure>
  <header><Disclosure.Trigger>Trace details</Disclosure.Trigger></header>
  <Disclosure.Panel>Recorded execution details</Disclosure.Panel>
</Disclosure>
```

Use `defaultOpen` for local initial state, or `open` and `onOpenChange(open, details)` for controlled state. Preserve Base UI event details so a caller can cancel a transition. Event handlers can use `event.preventBaseUIHandler()`; browser `preventDefault()` and primitive cancellation are distinct. Base UI exposes `aria-expanded`, and links the panel through `aria-controls` while open. `keepMounted` preserves child state while collapsed.

## Story and behavior test

Each component has `Name.jsx`, `Name.stories.jsx`, and `Name.test.jsx` in its own folder. The colocated [Disclosure stories](../../frontend/src/components/Disclosure/Disclosure.stories.jsx) demonstrate controlled and uncontrolled usage; [tests](../../frontend/src/components/Disclosure/Disclosure.test.jsx) verify keyboard interaction, instance isolation, controlled updates and cancellation.

A representative test using the actual public API:

```jsx
import React from 'react';
import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Disclosure } from './Disclosure';

test('keyboard activation updates visibility and accessible state', async () => {
  const user = userEvent.setup();
  render(<Disclosure>
    <Disclosure.Trigger>Trace details</Disclosure.Trigger>
    <Disclosure.Panel>Recorded operations</Disclosure.Panel>
  </Disclosure>);
  const trigger = screen.getByRole('button', { name: 'Trace details' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await user.tab();
  await user.keyboard('{Enter}');
  const panel = screen.getByText('Recorded operations');
  expect(panel).toBeVisible();
  expect(trigger).toHaveAttribute('aria-controls', panel.id);
  await user.keyboard(' ');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(panel).not.toBeVisible();
});
```

Test consumer-observable contracts, not Base UI internals. Use Chromium to verify portal interactions, real focus behavior, and rendered accessibility; DOM tests alone do not establish complete accessibility. Keep accessible names on controls even when a visual tooltip exists.

References: [Base UI Collapsible](https://base-ui.com/react/components/collapsible), [composition](https://base-ui.com/react/handbook/composition), [Tooltip guidance](https://base-ui.com/react/components/tooltip).
