import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { chromium } from "playwright-core";

const origin = process.env.TALENT_TEST_URL || "http://localhost:5190";
const selector = 'select[aria-label="Idioma / Language"]:visible';
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => browser?.close());

async function setup({ authenticated = false, failTranslation = false, mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
  });
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { role: "company" },
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  if (authenticated) {
    const payload = Buffer.from(
      JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }),
    ).toString("base64url");
    const session = {
      user,
      access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
      refresh_token: "test",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: "bearer",
    };
    await context.addInitScript((session) => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        return /^sb-.*-auth-token$/.test(key) ? JSON.stringify(session) : original.call(this, key);
      };
    }, session);
  }
  const translationRequests = [],
    signups = [],
    updates = [],
    posts = [];
  const application = {
    id: "app-a",
    user_id: "candidate-a",
    vacancy_id: "vac-a",
    status: "nuevo",
    notas: "Nota privada confidencial 8472",
    vacancy: { title: "Puesto privado 1234" },
    candidate: { nombre: "Ana Privada", email: "private@example.test" },
  };
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    const send = (data, status = 200) =>
      route.fulfill({
        status,
        headers: { "access-control-allow-origin": "*" },
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (url.hostname === "translate.googleapis.com") {
      const language = url.searchParams.get("tl"),
        source = url.searchParams.get("q");
      translationRequests.push({ language, source, headers: request.headers() });
      if (failTranslation) return send({ error: "Unavailable" }, 503);
      const translations =
        language === "fr"
          ? {
              Inicio: "Accueil",
              "Buscar empleo": "Chercher un emploi",
              Candidatos: "Candidats",
              Empresa: "Entreprise",
            }
          : language === "ar"
            ? { Inicio: "الرئيسية", "Buscar empleo": "البحث عن عمل", Menú: "القائمة" }
            : {};
      const translated = source
        .split("\n")
        .map((text) => translations[text] ?? `${language}: ${text}`)
        .join("\n");
      return send([[[translated, source]], null, "es"]);
    }
    if (url.pathname === "/auth/v1/user") return send(user);
    if (url.pathname === "/auth/v1/signup") {
      const body = request.postDataJSON();
      signups.push(body);
      return send({ ...user, email: body.email, user_metadata: body.data, identities: [] });
    }
    if (url.pathname === "/rest/v1/rpc/has_role")
      return send(request.postDataJSON()._role === "recruiter");
    if (url.pathname === "/rest/v1/applications") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        updates.push(body);
        Object.assign(application, body);
        return send(
          url.searchParams.has("select") ? { id: application.id, notas: application.notas } : null,
        );
      }
      return send([application]);
    }
    if (url.pathname === "/rest/v1/profiles")
      return send([
        {
          user_id: "candidate-a",
          nombre: "Ana Privada",
          email: "private@example.test",
          resumen: "Resumen personal confidencial 7431",
          ramos: ["Vida"],
          skills: ["Habilidad privada 9012"],
          certificaciones: [],
          experiencia: 4,
        },
      ]);
    if (url.pathname === "/rest/v1/vacancies") {
      if (request.method() === "POST") posts.push(request.postDataJSON());
      return send([]);
    }
    if (url.pathname.startsWith("/rest/v1/")) return send([]);
    return route.abort();
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|hydrating/i.test(message.text())) errors.push(message.text());
  });
  return { context, page, translationRequests, signups, updates, posts, application, errors };
}

test("245 languages, French translation, cache reuse and persistent navigation", async () => {
  const { context, page, translationRequests, errors } = await setup();
  try {
    await page.goto(origin);
    await page.locator(selector).waitFor();
    assert.equal(await page.locator(`${selector} option`).count(), 245);
    await page.locator(selector).selectOption("fr");
    await page.getByRole("link", { name: "Accueil", exact: true }).waitFor();
    await page.waitForFunction(
      () =>
        !document
          .querySelector('select[aria-label="Idioma / Language"]')
          ?.closest("div")
          ?.querySelector(".animate-spin"),
    );
    assert.equal(await page.evaluate(() => document.documentElement.lang), "fr");
    assert.equal(await page.evaluate(() => localStorage.getItem("insurtalent_language")), "fr");
    const count = translationRequests.length;
    await page.reload();
    await page.getByRole("link", { name: "Accueil", exact: true }).waitFor();
    await page.waitForTimeout(300);
    assert.equal(
      translationRequests.length,
      count,
      JSON.stringify(translationRequests.slice(count)),
    );
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Chercher un emploi", exact: true })
      .click();
    assert.equal(await page.locator(selector).inputValue(), "fr");
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("English company signup preserves form values and company metadata", async () => {
  const { context, page, signups, translationRequests } = await setup();
  try {
    await page.goto(`${origin}/auth?role=company&mode=signup`);
    await page.locator("form input").nth(0).fill("Empresa privada de prueba");
    await page.locator('input[type="email"]').fill("new-private@example.test");
    await page.locator('input[type="password"]').first().fill("private-password-123");
    await page.getByLabel("Confirmar contraseña").fill("private-password-123");
    await page.locator(selector).selectOption("en");
    await page.getByRole("heading", { name: "Create your company account", exact: true }).waitFor();
    assert.equal(
      await page.locator('input[type="email"]').inputValue(),
      "new-private@example.test",
    );
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page
      .getByText("Account created. Check your email to confirm your account.", { exact: true })
      .waitFor();
    assert.equal(signups.length, 1);
    assert.equal(signups[0].data.role, "company");
    assert.equal(signups[0].password, "private-password-123");
    const sent = translationRequests.map((request) => request.source).join("\n");
    for (const secret of [
      "new-private@example.test",
      "private-password-123",
      "Empresa privada de prueba",
    ])
      assert.ok(!sent.includes(secret));
  } finally {
    await context.close();
  }
});

test("Language changes preserve private interview drafts and database status values", async () => {
  const { context, page, translationRequests, updates, application } = await setup({
    authenticated: true,
  });
  try {
    await page.goto(`${origin}/recruiter/candidates?view=table`);
    const notes = page.locator("main textarea").first();
    await notes.fill("Apunte privado confidencial 9173");
    await page.locator(selector).selectOption("fr");
    await page.getByRole("heading", { name: "Candidats", exact: true }).waitFor();
    assert.equal(await notes.inputValue(), "Apunte privado confidencial 9173");
    const statusSaved = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/rest/v1/applications" &&
        response.request().method() === "PATCH",
    );
    await page.locator("main select").first().selectOption("entrevista");
    await statusSaved;
    assert.deepEqual(updates[0], { status: "entrevista" });
    await page.locator('button[aria-label*="Ana Privada"]').last().click();
    await page.waitForFunction(() =>
      [...document.querySelectorAll('button[aria-label*="Ana Privada"]')].some(
        (button) => button.disabled,
      ),
    );
    assert.equal(application.notas, "Apunte privado confidencial 9173");
    const sent = translationRequests.map((request) => request.source).join("\n");
    for (const privateText of [
      "Ana Privada",
      "private@example.test",
      "Puesto privado 1234",
      "Apunte privado confidencial 9173",
      "Nota privada confidencial 8472",
      "Resumen personal confidencial 7431",
    ])
      assert.ok(!sent.includes(privateText), privateText);
    assert.ok(
      translationRequests.every((request) => !request.headers.cookie && !request.headers.referer),
    );
  } finally {
    await context.close();
  }
});

test("Translated vacancy options persist the original database values", async () => {
  const { context, page, posts } = await setup({ authenticated: true });
  try {
    await page.goto(`${origin}/recruiter/new-job`);
    await page.locator("main input").nth(0).fill("Vacante de prueba privada");
    await page.locator("main input").nth(1).fill("Empresa de prueba privada");
    await page.getByPlaceholder("Ciudad de México", { exact: true }).fill("Puebla");
    await page.getByRole("button", { name: "Vida", exact: true }).click();
    await page.locator(selector).selectOption("en");
    await page.getByRole("button", { name: "Life", exact: true }).waitFor();
    await page.locator("main select").nth(0).selectOption("Solo Comisión");
    await page.locator("main select").nth(1).selectOption("Cédula B");
    await page.locator("main select").nth(2).selectOption("remoto");
    await page.getByRole("button", { name: "Post a job", exact: true }).click();
    await page.waitForURL(`${origin}/recruiter/dashboard`);
    assert.equal(posts.length, 1);
    assert.equal(posts[0].title, "Vacante de prueba privada");
    assert.equal(posts[0].pay_scheme, "Solo Comisión");
    assert.equal(posts[0].cedula, "Cédula B");
    assert.equal(posts[0].modality, "remoto");
    assert.deepEqual(posts[0].ramos, ["Vida"]);
  } finally {
    await context.close();
  }
});

test("Mobile Arabic uses RTL and retains light/dark controls", async () => {
  const { context, page, errors } = await setup({ mobile: true });
  try {
    await page.goto(origin);
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.locator(selector).selectOption("ar");
    await page.getByRole("link", { name: "الرئيسية", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dir), "rtl");
    assert.equal(await page.evaluate(() => document.documentElement.lang), "ar");
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page
      .locator('button[suppresshydrationwarning], button[title*="modo"], button[title*="ar:"]')
      .first()
      .click();
    await page.screenshot({ path: "/tmp/talent-language-arabic.png" });
    await page.locator(selector).selectOption("es");
    await page.getByRole("link", { name: "Inicio", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.dir), "ltr");
    assert.deepEqual(errors, []);
    await page.screenshot({ path: "/tmp/talent-language-mobile.png" });
  } finally {
    await context.close();
  }
});

test("Unavailable browser storage and unsupported preferences keep language selection usable", async () => {
  for (const blocked of [true, false]) {
    const { context, page } = await setup();
    try {
      await context.addInitScript((blocked) => {
        if (blocked) {
          Storage.prototype.getItem = () => {
            throw new Error("Storage blocked");
          };
          Storage.prototype.setItem = () => {
            throw new Error("Storage blocked");
          };
        } else {
          localStorage.setItem("insurtalent_language", "unsupported-code");
        }
      }, blocked);
      await page.goto(origin);
      await page.locator(selector).selectOption("en");
      await page.getByRole("navigation").getByRole("link", { name: "Home", exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.lang), "en");
    } finally {
      await context.close();
    }
  }
});

test("Unavailable free translation falls back without blocking the application", async () => {
  const { context, page, translationRequests } = await setup({ failTranslation: true });
  try {
    await page.goto(origin);
    await page.locator(selector).selectOption("fr");
    await page.getByRole("status").filter({ hasText: "Traducción no disponible" }).waitFor();
    await page.getByRole("link", { name: "Inicio", exact: true }).waitFor();
    assert.equal(translationRequests.length, 1);
    await page.locator(selector).selectOption("es");
    assert.equal(await page.evaluate(() => document.documentElement.lang), "es");
    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Buscar empleo", exact: true })
      .click();
    assert.equal(new URL(page.url()).pathname, "/jobs");
  } finally {
    await context.close();
  }
});
