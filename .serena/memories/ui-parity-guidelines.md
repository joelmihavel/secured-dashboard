# UI Parity Guidelines

*   **Data Source:** Focus exclusively on extracted Figma data (found in the `buildbot` pipeline or retrieved via Figma MCP tools/REST API).
*   **Determinism:** Work deterministically using ONLY that data to fix the UI for parity across each screen and its states. DO NOT use imagination for UI values; use only deterministic input values from Figma.
*   **Consistency:** Detect and reuse shared components (e.g., buttons, input form fields) to maintain consistency across the app.
*   **Goal:** The React Native app screens must look EXACTLY as per the Figma design with NO deviation.
*   **Verification:** Use the iOS simulator to take screenshots. Utilize Maestro (e.g., `inspect_view_hierarchy`, `run_flow`) and XcodeBuildMCP tools to get a code-level UI feedback loop and verify exact parity.