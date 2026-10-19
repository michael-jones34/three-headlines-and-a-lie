# UI Polish: Transitions and Animations

## 1. Objective

The Three Headlines and a Lie web app has a working MVP deployed to Vercel. Core gameplay and functionality are complete, and the current desktop and mobile layouts are acceptable.

This task is to improve the smoothness and responsiveness of the existing Three Headlines and a Lie frontend through subtle animations and transitions.

The primary goal is to make the interface feel cohesive rather than having content appear, disappear, or change abruptly. Preserve the existing visual design, gameplay, and application architecture wherever practical.

Priorities, in order:

1. **Source-link expansion:** animate the appearance of all four source links, with the layout expanding naturally and content below moving down smoothly.
2. **Screen transitions:** introduce smooth fades when navigating between screens or questions.
3. **Answer feedback:** transition answer styling and reveal feedback and source links smoothly without delaying the response.
4. **Other interactions:** add restrained transitions to buttons, progress indicators, and similar elements where useful.

Prioritise a reliable, maintainable implementation over elaborate animation effects.

## 2. Screen and question transitions

Introduce subtle fade transitions for the following navigation paths:

- Start screen → game.
- Question N → question N+1.
- Game → results.
- Results → model explanations.
- Model explanations → results.
- Results → replay.

The outgoing content should fade out, the existing navigation action should occur, and the incoming content should fade in.

Aim for approximately 120–160 ms for fade-out and 160–220 ms for fade-in. Treat these as starting points, adjusting them if necessary to achieve a natural feel.

Requirements:

- Keep transitions consistent across navigation paths.
- Preserve the current screen structure and behaviour.
- Avoid unnecessarily animating every element individually.
- Prevent noticeable flicker, blank screens that persist, or abrupt visual jumps.
- Ensure replay resets the game correctly and does not retain stale answer or progress state.
- Do not introduce unnecessary delays to gameplay.

Inspect the existing conditional rendering and state management in `Game.tsx` before choosing an implementation. Prefer a small, reusable mechanism that works with the current architecture.

If a transition mechanism uses state, timers, or callbacks, ensure that:

- Rapid repeated interactions cannot schedule duplicate navigation actions.
- A synchronous guard, such as a ref, is used where necessary; a React state flag alone may not prevent repeated handlers from running before the next render.
- Relevant controls cannot trigger navigation repeatedly while a transition is in progress.
- Navigation and associated state changes occur exactly once.
- Pending timers or callbacks are cleaned up appropriately.
- The interface cannot become stuck invisible or permanently disabled if a transition is interrupted or the component unmounts.

Prefer CSS transitions and existing React capabilities. Do not add an animation dependency or substantially restructure the component merely to implement fades.

## 3. Answer feedback and source-link appearance

When the user selects a headline, preserve the existing immediate answer-selection and feedback behaviour.

### Answer-state transitions

- Transition the headline styling smoothly into the existing correct and incorrect states.
- Preserve the current visual distinction between the selected answer, the correct answer, and other headlines.
- Keep correctness understandable without relying on colour alone.
- Fade in the existing feedback message where appropriate.
- Preserve existing feedback content and accessibility announcements.
- Do not introduce a noticeable delay before the answer is evaluated or feedback becomes available.

The feedback message itself does not need a height animation. Prioritise the source-link expansion described below.

### Dynamic source-link expansion — highest-priority interaction

After an answer is selected, reveal all four source links, each directly beneath its corresponding headline.

The links must appear through a smooth vertical expansion and opacity transition. Content below the headline list must move down naturally as the links appear, rather than jumping to a new position.

Prefer a CSS Grid technique using `grid-template-rows` transitioning from `0fr` to `1fr`, with an inner wrapper using `min-height: 0` and `overflow: hidden`. Use an equally simple alternative if inspection shows it is more reliable with the existing markup.

Requirements:

- Keep the source-link container mounted if necessary for the expansion animation to work.
- Preserve all existing source URLs, labels, ordering, and placement.
- Keep each link beneath its respective headline, not in a separate list or shared feedback section.
- Support different headline lengths, varying link heights, responsive wrapping, and mobile layouts.
- Avoid fixed heights, manual JavaScript height measurement, clipping, overlapping content, and abrupt layout shifts.
- Ensure the animation completes cleanly and leaves the content in its correct final layout.
- Do not animate or alter the source URLs or link labels themselves beyond the intended visual reveal.

Before an answer is selected, collapsed links must not be keyboard-focusable or activatable. Use an appropriate mechanism, such as the HTML `inert` attribute, alongside appropriate accessibility semantics. Do not rely on `aria-hidden` or `tabIndex` alone to prevent interaction.

When the links become visible, restore normal keyboard navigation and activation.

## 4. Other interaction feedback

Where it improves the existing interface, add subtle transitions to:

- Button hover, active, and focus states.
- Progress indicators when the question changes.
- Other existing elements whose state changes would benefit from smoother feedback.

Keep these effects restrained and consistent with the current styling. Avoid unnecessary motion, decorative animation, or changes to the visual design.

## 5. Accessibility and responsive behaviour

All transitions must respect accessibility and remain usable across devices.

- Respect `prefers-reduced-motion`. Disable or substantially reduce non-essential animations when reduced motion is requested, without affecting functionality.
- Keep keyboard navigation working throughout the game.
- Preserve visible focus indicators.
- Ensure collapsed source links cannot receive focus or be activated.
- Preserve appropriate semantic HTML, ARIA attributes, and existing live-region announcements.
- Do not use colour as the sole indication of correctness.
- Ensure animations work at mobile widths and when text wraps onto multiple lines.
- Avoid unnecessary JavaScript work, layout measurements, dependencies, or performance overhead.

Reduced-motion handling must cover both screen transitions and source-link expansion, rather than only one category of animation.

## 6. Constraints and scope

This task is limited to UI transitions and interaction polish.

Do not change:

- Quiz data or quiz ordering.
- Headline ordering within a quiz.
- Answer evaluation, score calculation, answer history, or rankings.
- Minimum game length, early exit, replay semantics, or other gameplay rules.
- Source URLs, source-link labels, or their intended placement.
- Attribution, model explanations, or results content.
- Existing application functionality unrelated to these animations.

Do not redesign the application, add new features, introduce an animation library without a concrete necessity, or undertake unrelated refactoring.

Keep changes within the frontend. Do not modify the Python/ML project files.

Preserve compatibility with the existing Next.js static export and Vercel deployment. Do not introduce backend functionality or browser APIs that break server rendering.

Do not commit, push, or deploy changes.

## 7. Acceptance criteria

The task is complete when the following criteria have been met.

### Source links
- [ ] Selecting a headline reveals all four source links beneath their respective headlines.
- [ ] The links appear through a smooth vertical expansion and opacity transition.
- [ ] Content below the list moves down naturally rather than jumping.
- [ ] Variable text lengths and responsive wrapping do not cause clipping or overlap.
- [ ] Links are not focusable or activatable before the answer is selected.
- [ ] Once revealed, links work normally and retain their existing destinations and labels.

### Screen transitions
- [ ] All navigation paths listed in Section 2 have appropriate fade transitions.
- [ ] Outgoing and incoming content transition smoothly without persistent blank states.
- [ ] Rapid repeated interactions cannot cause duplicate navigation or corrupt game state.
- [ ] Replay and model-explanation navigation continue to behave correctly.

### Answer feedback and other interactions
- [ ] Correctness feedback remains immediate and visually clear.
- [ ] Headline styling and feedback appearance transition smoothly.
- [ ] Optional button and progress transitions are subtle and consistent with the existing design.

### Accessibility and validation
- [ ] Reduced-motion preferences are respected across all animations.
- [ ] Keyboard navigation, focus indicators, and feedback announcements remain functional.
- [ ] The layout remains usable on mobile.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] The final diff contains only changes relevant to this task.

## 8. Workflow

### Phase 1: Inspect and propose

Read the applicable `AGENTS.md` instructions and inspect the existing frontend.

**Read this entire specification before beginning the inspection. Evaluate the implementation against all requirements, not just the first few. Do not act on any implementation requirement until you have read the full document and produced the proposal for changes.**

Identify:

- The files and components involved.
- How screen transitions, answer feedback, and navigation state currently work.
- How source links are inserted into the layout.
- The main technical challenges, particularly dynamic-height animation and interaction accessibility.
- The simplest reliable implementation approach that meets the requirements.
- Any relevant accessibility, responsive-layout, or maintainability considerations.
- Any trade-offs, constraints, or proposed deviations from this specification.

Return a concise plan explaining the proposed changes and how they will satisfy the requirements. Identify any requirement that cannot be met as written and explain why.

**Do not edit any files during Phase 1. Stop after presenting the plan and wait for explicit approval.**

### Phase 2: Implement and validate

Begin only after the user approves the plan.

- Implement the approved changes with minimal, targeted edits.
- Follow the requirements and constraints in this document.
- If inspection during implementation reveals a material problem with the approved approach, explain it and seek approval before making a significant scope or architecture change.
- Run `npm run lint` and `npm run build` from `web/`.
- Review the diff for unintended changes.
- Report which files changed, the implementation approach, validation results, and any remaining limitations or manual testing required.

Do not commit, push, or deploy.

# Claude's final summary

This document covers two sequential UI improvement tasks for the Three Headlines and a Lie frontend.

---

## Task 1: Transitions and Animation

### 1. Context and objective

The Three Headlines and a Lie web app has a working MVP deployed to Vercel. Core gameplay and functionality are complete, and the current desktop and mobile layouts are acceptable.

This task was to improve the smoothness and responsiveness of the existing Three Headlines and a Lie frontend through subtle animations and transitions.

The primary goal was to make the interface feel cohesive rather than having content appear, disappear, or change abruptly. Preserved the existing visual design, gameplay, and application architecture wherever practical.

Priorities, in order:

1. **Source-link expansion:** animate the appearance of all four source links, with the layout expanding naturally and content below moving down smoothly.
2. **Screen transitions:** introduce smooth fades when navigating between screens or questions.
3. **Answer feedback:** transition answer styling and reveal feedback and source links smoothly without delaying the response.
4. **Other interactions:** add restrained transitions to buttons, progress indicators, and similar elements where useful.

### 2. Acceptance criteria

All criteria met.

- [x] Selecting a headline reveals all four source links beneath their respective headlines.
- [x] The links appear through a smooth vertical expansion and opacity transition.
- [x] Content below the list moves down naturally rather than jumping.
- [x] Variable text lengths and responsive wrapping do not cause clipping or overlap.
- [x] Links are not focusable or activatable before the answer is selected (`inert` attribute used).
- [x] Once revealed, links work normally and retain their existing destinations and labels.
- [x] All navigation paths have appropriate fade transitions.
- [x] Outgoing and incoming content transition smoothly without persistent blank states.
- [x] Rapid repeated interactions cannot cause duplicate navigation or corrupt game state.
- [x] Replay and model-explanation navigation behave correctly.
- [x] Correctness feedback remains immediate and visually clear.
- [x] Headline styling and feedback appearance transition smoothly.
- [x] Button and progress transitions are subtle and consistent with the existing design.
- [x] Reduced-motion preferences are respected across all animations.
- [x] Keyboard navigation, focus indicators, and feedback announcements remain functional.
- [x] The layout remains usable on mobile.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

### 3. Implementation notes

- Screen transitions use a `fadeState` ("in"/"out") controlled by `navigateWithTransition`, with a synchronous `isTransitioningRef` guard to prevent duplicate navigation.
- Question-to-question transitions use a separate `questionFadeState` and a height animation on the question container (`questionContainerRef`), measured with `useIsomorphicLayoutEffect` after the content swap, to smoothly animate from the old height to the new height.
- Source-link expansion uses CSS Grid `grid-template-rows: 0fr → 1fr` transition with an inner wrapper (`min-height: 0; overflow: hidden`). The `inert` attribute prevents interaction before reveal.
- All transition timers are cleaned up on component unmount.
- Reduced-motion preference is checked at the point of navigation and skips the fade accordingly.

---

## Task 2: Editorial Styling

### 1. Context and objective

Following the transitions task, apply an editorial aesthetic to the application: classy, slightly old-timey, reminiscent of a well-designed newspaper or magazine, while retaining the feel of a modern web application.

Palette:
- **Warm ivory:** `#FAF7F0` — page background
- **Ink navy:** `#18283D` — primary text, buttons, strong visual elements
- **Muted red:** `#C6534B` — restrained accents (progress bar)
- **Soft green:** `#DCEBE3` — correct-answer feedback
- **Muted rose:** `#F7E5E3` with `#5C1D18` text — incorrect-answer feedback

Typography:
- Source Serif 4 (via `next/font/google`) for headings and quiz headlines
- Geist Sans for UI elements (buttons, scores, labels)
- Medium and semibold weights; no thin text

### 2. Files changed

- `web/src/app/globals.css` — ivory background, navy foreground, sans/serif/mono font stacks, `fadeIn` animation, reduced-motion support.
- `web/src/app/layout.tsx` — Source Serif 4 imported with weights 400/500/600/700; variable exposed as `--font-source-serif-4`.
- `web/src/components/Game.tsx` — palette and typography applied consistently across all screens: start, playing, results, model explanations, loading, and error states.

### 3. Acceptance criteria

- [x] Palette applied consistently across all screens and states.
- [x] Source Serif 4 used for main heading and quiz headlines; Geist Sans for UI elements.
- [x] Medium/semibold weights used throughout; no thin or lightweight text.
- [x] Correct-answer feedback uses soft green (`#DCEBE3`) background.
- [x] Incorrect-answer feedback uses muted rose (`#F7E5E3`) with dark text (`#5C1D18`).
- [x] Muted red (`#C6534B`) used for progress bar and category labels.
- [x] Accessible colour contrast maintained; colour is not the sole indicator of correctness.
- [x] Existing transitions, animations, reduced-motion support, and game logic preserved.
- [x] Mobile responsiveness and readability maintained.
- [x] No new dependencies introduced.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.

### 4. Implementation notes

- `globals.css` defines `--font-serif` in the `@theme inline` block, making `font-serif` a Tailwind utility that resolves to Source Serif 4 with Georgia/Cambria fallbacks.
- Dark mode CSS was removed from `globals.css`; the application uses a fixed warm-ivory palette without a dark mode.
- Card components use `bg-white` against the ivory page background to provide a subtle visual lift.
- The `animate-fade-in` class on the feedback section provides a gentle reveal on answer selection.
- The `progress` pseudo-element reduced-motion rules were removed; the app uses a `<div>` bar, not a `<progress>` element.