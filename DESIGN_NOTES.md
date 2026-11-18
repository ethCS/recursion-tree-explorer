# Design notes

This is a log of how the Recursion Tree Explorer was built: what I decided, what I considered instead, what went wrong, and what I would do next. The order of work followed the brief: maths first, then the tree and the bars, then the explanations, then polish and QA.

## The goal everything serves

The user should come away knowing that **level ℓ+1's total = level ℓ's total × r**, with r = Σ aᵢ/bᵢ^d. Once that is clear, the three cases are just the three ways a geometric series can behave. I judged each feature by whether it makes that multiplication visible.

## 1. Maths module (`src/math/`)

**Exact rationals with BigInt.** r, tuple counts, work coefficients and level totals are all `{num, den}` BigInt fractions.
- *Alternative:* floating point with an epsilon. Rejected because the case decision hinges on r = 1 exactly. For example, 1/3 + 1/3 + 1/3 must be 1, not 0.9999999. With rationals, `classify` is a plain comparison, and a test checks that 1/3 × 3 is exactly 1.
- *Cost:* d has to be a whole number. With d = 1.5, bᵢ^d is irrational and r cannot be exact. I limited d to the integers 0–4, and the validation message explains why.

**Level tuples by composition.** At level ℓ, a node is described by how many times it took each branch: a vector k with Σk = ℓ. Its size is n / Π bᵢ^kᵢ, and the number of such nodes is multinomial(ℓ; k) × Π aᵢ^kᵢ.
- Tuples are grouped by denominator, because different paths can reach the same size. For example, with b = 2 and b = 4, taking ÷2 twice and ÷4 once both give n/4. The tests cover this case.
- Compositions are enumerated with the first entry descending, which reproduces the column order of the course table for 2T(n/4) + T(n/2) + n.
- A test checks that every level's total coefficient equals r^ℓ. That test is the insight written as code.

**Big-O.** The method depends on the case:
- **Root (r < 1):** Θ(n^d).
- **Equal (r = 1):** Θ(n^d log n). For d = 0 this is Θ(log n).
- **Leaves (r > 1), one term:** n^(log_b a). `exactLog` finds a rational log_b a when there is one (for example, log₄ 8 = 3/2), so the display says n^{3/2} or n² rather than a rounded decimal.
- **Leaves (r > 1), several terms:** solve Σ aᵢ/bᵢ^p = 1 by bisection and show p to three decimals. This is Akra–Bazzi's p.
  - *Alternative considered:* Newton's method. Bisection on [0, 64] is monotone, can't diverge, and is fast enough at 200 iterations. The left-hand side is strictly decreasing in p, so the root is unique.

**Critical exponent p₀.** The same equation also gives the leaf count n^p₀, so the leaves row and the derivation use it in every case. A bug found here is listed under Failures below.

**Concrete mode** recomputes every level for an actual n:
- A node with size ≤ 1 is a base case that does 1 unit of work and stops.
- Totals are tracked per branch so the bars stay coloured.
- The summary compares the sum over all levels with the Big-O evaluated at n. It shows the ratio at n = 16, 64, 256 and 1024 so you can see whether the ratio stays bounded.

**Randomizer.** I enumerate every recurrence within the limits, bucket them by case and by single- or multi-term, then pick a case uniformly and a bucket within it.
- *Alternative:* sampling a, b and d uniformly. Rejected because the leaves case dominates heavily (most random a and b give r > 1), so the user would rarely see the other two.
- Tests require each case to appear at least 28% of the time and multi-term recurrences at least 35%.

All 8 required test cases pass, along with 26 more tests (34 in total).

## 2. Tree (`src/tree/layout.ts`, `TreeView.tsx`)

**Drawing individual nodes, then groups.** Level 0 to a default depth draws one node per call. Deeper levels collapse into grouped bands such as "8 × n/64", one chip per tuple.
- The default depth stops before a level would push the drawn total past ~32 nodes, or before a level would exceed 12 nodes. This keeps the tree readable at first glance.
- Each grouped band has a "+" button that expands one more level, up to a hard cap of 150 drawn nodes. Past the cap, a notice explains why it won't expand further.
- Each node's knob collapses or expands its subtree.
- A grouped band shows the remainder: the level's tuples minus the nodes drawn individually. As a result, the band and the drawn nodes always add up to the full level.
- *Alternative:* always drawing every node. With a = 4 that means 256 nodes at level 4, which was unreadable and slow, so I dropped it.

**Branch colours.**
- Teal, indigo and magenta mean branch 1, 2 and 3 everywhere: the formula, the edges, the r terms, the tuples and the bar segments.
- Amber is the single accent and is used only for selection and focus.
- A node is coloured by the branch of its *last* step. This is what makes the bar segments line up with the edges coming into a level.

**Animation.** Nodes move with CSS transforms. A new node fades and scales in, using a double `requestAnimationFrame` so the transition actually runs. Edges are unit lines scaled with `vector-effect: non-scaling-stroke`, which lets them animate with a transform as well. When you randomize or pick a preset, the tree builds one level every 320 ms.
- Removed nodes vanish without an exit animation. See What I'd change below.

**Pan and zoom** are written by hand: pointer drag, a non-passive wheel listener, two-finger pinch, keyboard arrows/+/−/0, and a reset/fit button.
- *Alternative:* d3-zoom or a pan-zoom library. Rejected to avoid a dependency for about 120 lines of code, and because I wanted the fit logic under my control.

**Fit.** The default view fits both width and height. For tall, narrow trees in concrete mode, that made everything tiny, so the fit now prefers the width and lets tall trees scroll (see Failures).

## 3. Level table and bars (`LevelPanel.tsx`, `Verdict.tsx`)

**The table follows the course format:** Level | (work per node, number of nodes) … | Total.
- Each tuple is clickable, and so is each level number.
- Hovering a row highlights the matching nodes and bands in the tree, and the reverse also works.

**Bars.** Each bar's length is the level total relative to the largest level shown, split into one segment per branch.
- Between rows sits a small "×r" chip. This is how the insight is carried: you read the chip down the table and watch every bar become the previous one × r.
- *Alternative:* a separate line chart of level totals. Rejected because it pulls the eye away from the table it summarises. Keeping the bars inline next to each total was clearer.

**r strip.** It sits above the tree and shows the per-term shares coloured by branch, then their exact sum, then the verdict and the Big-O pill.
- When the term already is the value, the "= value" part is skipped so nothing reads twice; this happens for a single term with d = 0, or d = 1 with gcd(a, b) = 1. The ≈ decimal is still shown.

## 4. Derivation and explanations (`src/explain/`)

**Derivation steps** are generated from live values and come in single-term and multi-term variants. The steps are: read a, b, d → size → count → work → level total → r → pattern → which level dominates → number of levels → number of leaves → Big-O.
- For several terms, the derivation says the depth comes from the smallest b. It also says the tree is only complete down to the largest b's depth.
- In the root case the derivation states the exact bound: total ≤ n^d / (1 − r).

**Click to learn.**
- Every learnable item (each number in the formula, each r term, node, tuple, level, step, the answer and the concrete sum) has an entity key plus a list of related keys.
- Selecting an item highlights it as "on" and its relatives as "rel" everywhere in the app.
- The explanation card has sections: What it is / Why this value / What it feeds / Check it. It also offers a "next" link that walks you up the chain.

**Positioning the explanation card.** It docks on the side opposite the item you clicked, because the first version covered the thing being explained. On a phone it becomes a bottom sheet.

**Predict, then reveal.**
- *When it asks:* only after Randomize or a preset, when you are looking at a recurrence you haven't seen. Manual edits cancel a pending prediction, since asking after every keystroke would be noise.
- *While a prediction is pending:* r, the totals and the verdict steps are hidden, and any explanation that would give away the answer is blocked.
- *Hint:* reveals the first two level totals.
- *Turning it off:* Skip or Stop asking, plus a switch in the top bar that is remembered.
- *After you answer:* the feedback is written from the live r ("each bar grows to 3/2 times the one above…").

**Plug-in, not template (second pass).** The first version of the solution read like a textbook: "level ℓ has aᵏ calls of size n/bᵏ". Feedback was that newcomers need to see *their* numbers worked through. Every step now has the same parts:
- a display formula;
- a plain-words note that substitutes the actual values ("a call on $n/3$ makes calls on $n/9$ and $n/6$…");
- a "why";
- for most steps, a **Check** box that redoes the claim with a real number.
Helpers live in `words.ts`. A few examples:
- *Level counts:* for levels ≤ 3, the count step lists every path to a size. "÷4 → ÷2 gives 2·1 = 2; ÷2 → ÷4 gives 1·2 = 2. Together 2 + 2 = 4".
- *Depth:* checked with an example n, the largest power of the smallest b that is ≤ 4096. For example, "n = 4,096: the deepest path is 12 levels below the root, the shortest is 6".
- *Leaves:* counted exactly ("3^{12} = 531,441 leaves"). For several terms, the check plugs p₀ back into Σ aᵢ/bᵢ^{p₀} and shows that it comes to 1.000.
- *Final answer:* the check adds up the actual tree at that n and compares it with the Big-O.
- *What-if:* the explanation for a, b or d re-analyses the recurrence with that number ±1 and states the new r, case and Big-O. These come from running `analyze` again, not from a rule of thumb.

`explain.test.ts` renders every step, explanation and tooltip with KaTeX `throwOnError` for presets, a 320-recurrence single-term sweep and about 200 multi-term recurrences. It also fails on template leftovers such as `a_i`, `\sum_i`, `undefined` or `NaN`, and checks that specific numbers appear.

**What's editable, and what each part means.**
- *Editable numbers* look like input fields: a tinted, dashed box with a pencil badge. Non-editable parts have a help cursor. A line under the formula says "Numbers with a pencil are editable."
- *Tooltips:* every part of the formula is a hover/focus target with its own tooltip: T(n), each recursive call, each a, each b, the non-recursive work and d. Each tooltip has a name (e.g. "n · the non-recursive work"), a sentence built from the live values, and a footer. For an editable number the footer says "Editable: click to change it"; otherwise it says which number to edit instead. Its button opens the full explanation.
- *Behaviour:* the tooltip stays open while the pointer is on it, and it stays pinned while a number is being edited.
- *Keyboard:* Tab reaches every part. Enter explains a non-editable part; on a number, Enter edits and `?` explains.
- *Touch:* the first tap shows the tooltip and a second tap opens the explanation.

## 5. Polish

- **Themes:** light and dark tokens. The theme follows the system unless you choose one. An inline script in `index.html` applies the saved theme before first paint, so the page doesn't flash the wrong theme.
- **Responsive layout:** breakpoints at 1020 px (one column) and 640 px. At 640 px:
  - level rows switch to a two-line grid;
  - the preset bar scrolls sideways;
  - the explanation becomes a bottom sheet;
  - the formula shrinks so `+ n^d` doesn't wrap onto a line by itself.

  Checked at 390 × 844 with no horizontal overflow.
- **Accessibility:**
  - every learnable item is a real button or has `role="button"` and is keyboard operable;
  - focus is shown with an amber `:focus-visible` ring;
  - Esc closes the explanation and cancels an edit;
  - arrow keys step the edited number;
  - validation errors use `role="alert"`;
  - `prefers-reduced-motion` turns off transitions and the build animation.
- **Onboarding:** a three-step intro that you can dismiss and reopen from the footer, plus "Numbers with a pencil are editable. Point at any part to see what it means." under the formula.
- **Shareable state:** the recurrence is stored in the URL hash.

## What failed, and why

- **Θ(n^1.000) when r = 1.** I first took p₀ from the numeric solve in every case, so merge sort's leaf count displayed as n^1.000. Fix: when r = 1, p₀ is exactly d, and a rational log is shown exactly. Both are handled in `criticalExponent` / `p0Parts`.
- **"O(n^1)".** The exact-log path printed a denominator of 1 as an exponent. Fix: print the bare n when q = 1.
- **A wrong unit test.** I wrote a concrete-mode assertion about level-4 denominators that was itself wrong; the code was right. I replaced it with checks I verified by hand: the n/64 tuple at level 3 is a leaf, and n/256 never appears.
- **Unreadable wide trees.** My first default depth drew far too many nodes for a = 4 or 3 terms. Fix: tighter limits on the default depth and the grouped bands.
- **Explanation covering its subject.** Fixed with side-aware docking.
- **Node text too small** to read at the default fit. Raised to 17 px for size and 11.5 px for work.
- **Concrete-mode tree squeezed** into a thin strip, because fitting a tall tree's height shrank it to almost nothing. Fix: fit by width first and let it scroll vertically.
- **Concrete ratio explanation.** My first wording didn't say why the concrete level ratio drifts from r near the bottom. It now names the cause: paths that have already reached size 1 stop, and a base case costs 1 even when its fractional size is below 1.
- **My QA script, not the app.**
  - On macOS, `Control+A` doesn't select all, so scripted edits never committed. I switched to `locator.fill()`.
  - The switch's checkbox is visually hidden, so the script now clicks the label.
- **Bundle-size warning.** The production build warned about a 555 kB chunk, mostly KaTeX and React. The page needs both on first paint, so code-splitting would not reduce what loads. I raised the warning limit to 700 kB rather than add a split that wouldn't help.
- **Phone layout.**
  - The sticky top bar took about 15% of a 390 px screen, and the theme button wrapped onto its own row. Fix: the bar is no longer sticky on phones, and the theme button sits in the title row.
  - The "leaves" label overflowed its badge.

- **Clicking a number didn't start editing.** The tooltip's pop-in animation used `transform`, which overrode the `translate(-50%,-100%)` that lifts it above the number. For 160 ms the tooltip sat on top of the number and took the click. Fix: position with the CSS `translate` property, which the animation doesn't touch.
- **Tooltip un-pinned mid-edit.** Focusing the input fired a plain "show" that replaced the pinned tooltip. Fix: a pinned tooltip can only be replaced by another pinned one.
- **Taps on the "n" of n^d started editing d.** Chrome's touch adjustment snaps a tap to the nearest element that listens for clicks. React's delegated listeners don't count, so the tiny exponent button won. Fix: no-op native click listeners on the formula's symbols. On touch, lifting the finger also closed the tooltip (it counted as pointer-leave). Touch tooltips now close only on a tap outside the formula.

## Which feature best delivers the insight

**The level-total bars with the "×r" chips between them.** You see one bar, then the next bar multiplied by r, then the next. Put three recurrences side by side and the three shapes (shrinking, flat, growing) *are* the three cases, before any formula. **Predict, then reveal** makes the bars count: the user commits to a guess from the tree, and the bars then confirm it or correct it. The concrete-n mode supports this from the other direction, showing that the sum over all levels really does track the Big-O as n grows.

## Verification done

- `npm test`: 46/46 passing (34 maths, 12 explanation suites). `tsc --noEmit`: clean. `npm run build`: clean.
- Ran the production build from a plain static server at `/projects/dsa/live/`. Ran `build:root` and checked that its asset paths start at `/`.
- Drove headless Chrome with `scripts/qa.mjs` and checked every result by hand:
  - **The four presets:** merge sort O(n log n), binary search O(log n), Karatsuba O(n^1.585), and the course example O(n log n).
  - **24 randomized recurrences** across two runs. For example, the multi-term p values satisfy Σ aᵢ/bᵢ^p ≈ 1.
  - **Interactions:** the predict / hint / feedback flow, the b = 1 error, the merge toast, d = 0, concrete n, intro dismissal, and selection.
  - **Layouts:** 390 × 844 phone (no overflow) and dark mode.
  - **Formula tooltips:** each part's tooltip text; the tooltip staying open over itself; edit → pinned → Enter applies; keyboard Tab and `?`; touch tap once to show, twice to explain, tap elsewhere to close.
  - **Worked solution:** read through for the course example and 2T(n/3) + T(n/2) + n, checking the numbers by hand (e.g. 7/6 ratio, 49n/36 level 2, p₀ ≈ 1.167, the what-if r values).
- No console errors in any run.

## What I couldn't verify

- **Touch:** pinch-zoom, touch drag and the tap-to-show tooltips were tested only with Chrome's mobile emulation, not on a real phone.
- **Browsers:** only Chrome was tested. Safari and Firefox were not.
- **Screen readers:** only checked by reading the markup (labels, roles, live regions). I did not try VoiceOver or NVDA.
- **Explanation wording for every input:** the tests prove every explanation renders and contains no template leftovers. I read the wording closely for only a handful of recurrences, so an awkward sentence may remain for unusual inputs.
- **The "stays bounded" message** in concrete mode uses a heuristic: it appears when max/min of the ratio over n = 16…1024 is below 2.2. It is a sanity check, not a proof.

## What I'd change with more time

- Exit animations for removed nodes. Currently they vanish while the remaining nodes glide to their new places.
- Non-integer d, shown with floating-point r and a clear "≈" whenever r is within ε of 1.
- Line up each bar row vertically with its tree level, so the eye can go straight across.
- A "compare" mode with two recurrences side by side, which would make the three bar shapes even more obvious.
- Floors and ceilings as an option in concrete mode, to show they don't change the Big-O.
- Visual regression tests that compare QA screenshots, instead of checking them by eye.
