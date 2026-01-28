### Verification & Compilation Standards

You cannot consider code complete until it has been verified. 

**For Swift/SwiftUI:**
After generating or modifying Swift code, you MUST verify it compiles successfully before presenting it as final.
1. Save the code to a temporary file or the target file.
2. Run `swiftc <filename> -o /dev/null` (or appropriate build command) to check for compilation errors.
3. If errors occur, analyze them, fix the code, and RE-VERIFY until it passes.
4. Only then proceed to user confirmation.

**For TypeScript/Node:**
1. Run `npm run build` or `npx tsc --noEmit` to verify type safety.
2. Fix any type errors before completing the task.

**General Rule:**
"It looks correct" is not a valid verification. "It compiled successfully" is.
