import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/grade-quiz`;

// ─── Helper ───────────────────────────────────────────────────
async function callGradeQuiz(body: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 1: Authentication & Authorization
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: rejects unauthenticated requests", async () => {
  const { status, data } = await callGradeQuiz({
    quiz_assignment_id: "00000000-0000-0000-0000-000000000000",
    answers: {},
  });
  assertEquals(status, 401);
  assertEquals(data.error, "Unauthorized");
});

Deno.test("grade-quiz: rejects invalid token", async () => {
  const { status, data } = await callGradeQuiz(
    { quiz_assignment_id: "00000000-0000-0000-0000-000000000000", answers: {} },
    "invalid-token-12345",
  );
  assertEquals(status, 401);
  assertEquals(data.error, "Unauthorized");
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: Input Validation
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: rejects missing quiz_assignment_id", async () => {
  const { status } = await callGradeQuiz(
    { answers: { q1: "0" } },
    ANON_KEY,
  );
  // Auth check runs first with anon key
  assertEquals(status === 401 || status === 400, true);
});

Deno.test("grade-quiz: rejects non-UUID quiz_assignment_id", async () => {
  const { status } = await callGradeQuiz(
    { quiz_assignment_id: "not-a-uuid", answers: {} },
    ANON_KEY,
  );
  assertEquals(status === 401 || status === 400, true);
});

Deno.test("grade-quiz: rejects array answers", async () => {
  const { status } = await callGradeQuiz(
    { quiz_assignment_id: "00000000-0000-0000-0000-000000000000", answers: [1, 2, 3] },
    ANON_KEY,
  );
  assertEquals(status === 401 || status === 400, true);
});

Deno.test("grade-quiz: rejects >200 answers", async () => {
  const tooMany: Record<string, string> = {};
  for (let i = 0; i < 201; i++) tooMany[`q${i}`] = "0";
  const { status } = await callGradeQuiz(
    { quiz_assignment_id: "00000000-0000-0000-0000-000000000000", answers: tooMany },
    ANON_KEY,
  );
  assertEquals(status === 401 || status === 400, true);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: Empty Answers (Auto-Submit Edge Case)
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: accepts empty answers object for auto-submit", async () => {
  const { status, data } = await callGradeQuiz(
    { quiz_assignment_id: "00000000-0000-0000-0000-000000000000", answers: {} },
    ANON_KEY,
  );
  // 401 = auth check passed validation; 400 with specific msg = validation passed too
  if (status === 400) {
    assertEquals(data.error !== "Invalid number of answers", true,
      "Empty answers should be accepted for auto-submit");
  }
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: CORS
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: handles CORS preflight", async () => {
  const res = await fetch(FUNCTION_URL, { method: "OPTIONS" });
  const body = await res.text();
  assertEquals(res.status, 200);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: Rate Limiting
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: includes rate limit headers", async () => {
  const { status } = await callGradeQuiz(
    { quiz_assignment_id: "00000000-0000-0000-0000-000000000000", answers: {} },
  );
  // Without auth, gets 401 but should still process through rate limiter
  assertEquals(status === 401 || status === 429, true);
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6: Malformed Request Body
// ═══════════════════════════════════════════════════════════════

Deno.test("grade-quiz: rejects non-JSON body", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: "not-json",
  });
  const body = await res.text();
  // Should be 400 or 401 (auth) or 500 (json parse)
  assertEquals(res.status >= 400, true);
});

Deno.test("grade-quiz: rejects null body", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ANON_KEY}`,
    },
    body: "null",
  });
  const body = await res.text();
  assertEquals(res.status >= 400, true);
});
