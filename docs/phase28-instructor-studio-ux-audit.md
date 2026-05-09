# Phase 28 Instructor Studio UX Audit

## Scope
- Instructor flow: `instructor/courses` -> create course -> edit steps -> publish.
- Learner flow: `courses/[slug]` -> enroll -> `learn/[courseId]` -> lesson navigation.

## Baseline Findings
- Instructor layout rendered blank screen while auth state was resolving.
- Course list silently failed into empty state when API errored.
- Learn redirect page could stay in loading state forever when learn payload failed.
- Keyboard lesson navigation relied on `:has(...)` selector and was brittle.

## Metrics to Track
- Time to first visible content for instructor layout.
- Error surfaced rate on instructor course list load failures.
- Learner redirect success rate from `learn/[courseId]` to first target lesson.
- Keyboard navigation success rate for previous/next lesson actions.

## Quick Wins Implemented
- Added loading placeholder for instructor layout while auth is being resolved.
- Added visible warning message for instructor courses API failures.
- Added fallback redirect from learn entry page to `dashboard/courses` when payload missing.
- Simplified keyboard selectors to stable `data-nav` attributes.

## Instrumentation Plan
- Add analytic events:
  - `instructor_layout_loading_duration`
  - `instructor_courses_load_failed`
  - `learn_entry_redirect_failed`
  - `learn_keyboard_navigation_used`
- Capture page-level timing markers via `performance.mark()` around:
  - instructor layout mount + auth resolved
  - learn page data fetch + redirect completion

## Next Iteration Backlog
- Split large instructor course editor page into step-specific components.
- Cache learn payload in context to avoid duplicate fetching between layout and lesson page.
- Add guided empty/error states with one-click recovery actions.
