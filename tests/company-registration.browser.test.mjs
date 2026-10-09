import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { chromium } from "playwright-core";

const origin = process.env.TALENT_TEST_URL || "http://127.0.0.1:5173";
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
});
after(async () => browser?.close());

function makeUser(role) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    aud: "authenticated",
    role: "authenticated",
    email: "test@example.com",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: role ? { full_name: "Test Account", role } : { full_name: "Test Account" },
    identities: [],
    created_at: new Date().toISOString(),
  };
}

function makeSession(user) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  return {
    access_token: `${header}.${payload}.test-signature`,
    refresh_token: "mock-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}

async function openAuth(options = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  let user = makeUser(options.loginRole);
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    const respond = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/auth/v1/signup") {
      const body = request.postDataJSON();
      requests.push({ body, url });
      user = makeUser(body.data.role);
      if (options.error) return respond({ msg: "Registration failed", code: "test_error" }, 400);
      if (options.confirmEmail) return respond(user);
      return respond(makeSession(user));
    }
    if (url.pathname === "/auth/v1/token") return respond(makeSession(user));
    if (url.pathname === "/auth/v1/user") return respond(user);
    if (url.pathname === "/rest/v1/rpc/has_role") {
      return respond(
        (request.postDataJSON()._role === "admin" && !!options.admin) ||
          (request.postDataJSON()._role === "recruiter" &&
            !!options.authorizedCompany &&
            user.user_metadata.role === "company"),
      );
    }
    if (url.pathname.startsWith("/rest/v1/")) {
      return respond(request.headers().accept?.includes("object+json") ? null : []);
    }
    // All remote requests are mocked/blocked. Never create accounts in the real project.
    return route.abort();
  });
  if (options.stored) {
    await context.addInitScript((stored) => {
      sessionStorage.setItem("momento_post_auth_redirect", JSON.stringify(stored));
    }, options.stored);
  }
  await page.goto(`${origin}/auth${options.search || ""}`);
  await page.getByRole("button", { name: "Empresa", exact: true }).waitFor();
  return { page, context, requests };
}

async function fillRegistration(page) {
  await page.locator("form input").nth(0).fill("Test Account");
  await page.locator('input[type="email"]').fill("test@example.com");
  await page.locator('input[type="password"]').first().fill("Test-password-123");
  await page.getByLabel("Confirmar contraseña").fill("Test-password-123");
}

test("Empresa sends company metadata and overrides candidate destinations", async () => {
  const { page, context, requests } = await openAuth({
    search: "?next=%2Fprofile",
    stored: { next: "/apply", vacancy: "test-vacancy" },
  });
  try {
    await page.getByRole("button", { name: "Empresa", exact: true }).click();
    assert.equal(
      await page.getByRole("button", { name: "Empresa", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page.waitForURL(`${origin}/recruiter/dashboard`);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0].body.data, { full_name: "Test Account", role: "company" });
    const confirmation = new URL(requests[0].url.searchParams.get("redirect_to"));
    assert.equal(confirmation.pathname, "/auth/callback");
    assert.equal(confirmation.searchParams.get("next"), "/recruiter/dashboard");
    // Account-type metadata must not bypass the recruiter's database permission.
    await page.getByText("Tu cuenta no tiene permisos de reclutador.", { exact: true }).waitFor();
  } finally {
    await context.close();
  }
});

for (const switchBack of [false, true]) {
  test(
    switchBack
      ? "Switching Empresa back to Candidato sends candidate"
      : "Default Candidato redirects to profile",
    async () => {
      const { page, context, requests } = await openAuth();
      try {
        if (switchBack) {
          await page.getByRole("button", { name: "Empresa", exact: true }).click();
          await page.getByRole("button", { name: "Candidato", exact: true }).click();
        }
        await fillRegistration(page);
        await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
        await page.waitForURL(`${origin}/profile`);
        assert.equal(requests[0].body.data.role, "candidate");
      } finally {
        await context.close();
      }
    },
  );
}

test("Pending email confirmation keeps company destination and waits for a session", async () => {
  const { page, context, requests } = await openAuth({ confirmEmail: true });
  try {
    await page.getByRole("button", { name: "Empresa", exact: true }).click();
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page
      .getByText("Cuenta creada. Revisa tu correo para confirmar tu cuenta.", { exact: true })
      .waitFor();
    assert.equal(new URL(page.url()).pathname, "/auth");
    assert.equal(requests[0].body.data.role, "company");
    assert.equal(
      new URL(requests[0].url.searchParams.get("redirect_to")).searchParams.get("next"),
      "/recruiter/dashboard",
    );
  } finally {
    await context.close();
  }
});

test("Signup errors do not navigate and allow retry with Empresa selected", async () => {
  const { page, context } = await openAuth({ error: true });
  try {
    await page.getByRole("button", { name: "Empresa", exact: true }).click();
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page.getByText("Registration failed", { exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/auth");
    assert.equal(
      await page.getByRole("button", { name: "Empresa", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    assert.equal(
      await page.getByRole("button", { name: "Crear cuenta", exact: true }).isEnabled(),
      true,
    );
  } finally {
    await context.close();
  }
});

test("Login uses persisted company role regardless of default selector", async () => {
  const { page, context, requests } = await openAuth({ loginRole: "company" });
  try {
    await page.getByRole("button", { name: "Inicia sesión", exact: true }).click();
    await page.locator('input[type="email"]').fill("test@example.com");
    await page.locator('input[type="password"]').first().fill("Test-password-123");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    await page.waitForURL(`${origin}/recruiter/dashboard`);
    assert.equal(requests.length, 0);
  } finally {
    await context.close();
  }
});

test("Admin routing remains unchanged even for company metadata", async () => {
  const { page, context } = await openAuth({ admin: true });
  try {
    await page.getByRole("button", { name: "Empresa", exact: true }).click();
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page.waitForURL(`${origin}/admin`);
  } finally {
    await context.close();
  }
});

for (const scenario of [
  { role: "company", next: "/profile", expected: "/recruiter/dashboard" },
  { role: "company", expected: "/recruiter/dashboard" },
  { role: "candidate", next: "/jobs", expected: "/jobs" },
  { role: undefined, expected: "/profile" },
  { role: "candidate", next: "https://example.com", expected: "/profile" },
]) {
  test(`Confirmation callback: ${scenario.role || "legacy"} next=${scenario.next || "none"} -> ${scenario.expected}`, async () => {
    const { page, context } = await openAuth({ loginRole: scenario.role });
    try {
      const session = makeSession(makeUser(scenario.role));
      const params = new URLSearchParams({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        token_type: "bearer",
        expires_in: "3600",
        type: "signup",
      });
      const search = scenario.next ? `?next=${encodeURIComponent(scenario.next)}` : "";
      await page.goto(`${origin}/auth/callback${search}#${params}`);
      await page.waitForURL(`${origin}${scenario.expected}`);
    } finally {
      await context.close();
    }
  });
}

test("Company registration link opens Empresa preselected", async () => {
  const { page, context, requests } = await openAuth();
  try {
    await page.goto(`${origin}/empresas`);
    await page.getByRole("button", { name: "Registrarme como Empresa", exact: true }).click();
    await page.getByRole("heading", { name: "Crea tu cuenta de empresa", exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get("role"), "company");
    assert.equal(
      await page.getByRole("button", { name: "Empresa", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page.waitForURL(`${origin}/recruiter/dashboard`);
    assert.equal(requests[0].body.data.role, "company");
    await page.getByRole("button", { name: "Panel de empresa", exact: true }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Mi perfil", exact: true }).count(), 0);
  } finally {
    await context.close();
  }
});

test("Company login retains Empresa when switching to registration", async () => {
  const { page, context } = await openAuth();
  try {
    await page.goto(`${origin}/empresas`);
    await page.getByRole("button", { name: "Iniciar sesión como Empresa", exact: true }).click();
    await page.getByRole("heading", { name: "Acceso para empresas", exact: true }).waitFor();
    await page.getByRole("button", { name: "Registra tu empresa", exact: true }).click();
    await page.getByRole("heading", { name: "Crea tu cuenta de empresa", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Empresa", exact: true }).getAttribute("aria-pressed"),
      "true",
    );
  } finally {
    await context.close();
  }
});

test("Unauthenticated company dashboard preserves company registration", async () => {
  const { page, context } = await openAuth();
  try {
    await page.goto(`${origin}/recruiter/dashboard`);
    await page.getByRole("heading", { name: "Crea tu cuenta de empresa", exact: true }).waitFor();
    const u = new URL(page.url());
    assert.equal(u.pathname, "/auth");
    assert.equal(u.searchParams.get("role"), "company");
    assert.equal(u.searchParams.get("next"), "/recruiter/dashboard");
  } finally {
    await context.close();
  }
});

test("Authorized public company signup opens enterprise menu and vacancy form", async () => {
  const { page, context, requests } = await openAuth({
    search: "?role=company&mode=signup",
    authorizedCompany: true,
  });
  try {
    await page.getByRole("heading", { name: "Crea tu cuenta de empresa", exact: true }).waitFor();
    await fillRegistration(page);
    await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
    await page.waitForURL(`${origin}/recruiter/dashboard`);
    assert.equal(requests[0].body.data.role, "company");
    await page.getByRole("heading", { name: "Dashboard", exact: true }).waitFor();
    await page.getByRole("link", { name: "Publicar vacante", exact: true }).click();
    await page.getByRole("heading", { name: "Publicar nueva vacante", exact: true }).waitFor();
    assert.equal(
      await page.getByRole("link", { name: "Rankings y evaluaciones", exact: true }).count(),
      0,
    );
  } finally {
    await context.close();
  }
});

test("Signup rejects mismatched confirmation without sending a request", async () => {
  const {page,context,requests}=await openAuth({search:"?role=company&mode=signup"});
  try {
    await fillRegistration(page);
    await page.getByLabel("Confirmar contraseña").fill("different");
    await page.getByRole("button",{name:"Crear cuenta",exact:true}).click();
    await page.getByText("Las contraseñas no coinciden. Escríbelas iguales.").waitFor();
    assert.equal(requests.length,0);
  } finally { await context.close(); }
});

test("Signup does not impose character composition or length in the form", async () => {
  const {page,context,requests}=await openAuth({search:"?role=company&mode=signup",confirmEmail:true});
  try {
    await fillRegistration(page);
    await page.locator('input[type="password"]').first().fill("abc");
    await page.getByLabel("Confirmar contraseña").fill("abc");
    await page.getByRole("button",{name:"Crear cuenta",exact:true}).click();
    await page.getByText("Cuenta creada. Revisa tu correo para confirmar tu cuenta.").waitFor();
    assert.equal(requests[0].body.password,"abc");
  } finally { await context.close(); }
});
