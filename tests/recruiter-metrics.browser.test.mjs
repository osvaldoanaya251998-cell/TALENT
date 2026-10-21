import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, after, test } from "node:test";
import { chromium } from "playwright-core";

const origin = process.env.TALENT_TEST_URL || "http://127.0.0.1:5173";
let browser;
before(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
});
after(async () => browser?.close());
const owner = "00000000-0000-4000-8000-000000000001";
const vacancies = [
  { id: "vac-a", title: "Vacante privada A", is_active: true },
  { id: "vac-b", title: "Vacante privada B", is_active: false },
];
const baseApps = [
  {
    id: "app-a",
    vacancy_id: "vac-a",
    candidate_id: "person-a",
    user_id: "user-a",
    status: "nuevo",
    created_at: "2026-08-01T12:00:00Z",
    candidate: { nombre: "Ana privada" },
  },
  {
    id: "app-b",
    vacancy_id: "vac-a",
    candidate_id: "person-b",
    user_id: "user-b",
    status: "entrevista",
    created_at: "2026-08-15T12:00:00Z",
    candidate: { nombre: "Luis privado" },
  },
  {
    id: "app-c",
    vacancy_id: "vac-b",
    candidate_id: "person-a",
    user_id: "user-a",
    status: "contratado",
    created_at: "2026-08-20T12:00:00Z",
    candidate: { nombre: "Ana privada" },
  },
  {
    id: "app-d",
    vacancy_id: "vac-b",
    candidate_id: "person-c",
    user_id: "user-c",
    status: "rechazado",
    created_at: "2026-09-10T12:00:00Z",
    candidate: { nombre: "María privada" },
  },
];
async function setup({
  bulk = false,
  missing = false,
  failSave = false,
  candidate = false,
  mobile = false,
} = {}) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: mobile ? { width: 390, height: 844 } : { width: 1360, height: 1000 },
    timezoneId: "America/Mexico_City",
  });
  const user = {
    id: owner,
    email: "owner@example.test",
    aud: "authenticated",
    role: "authenticated",
    user_metadata: { role: candidate ? "candidate" : "company" },
    app_metadata: {},
    created_at: new Date().toISOString(),
  };
  const payload = Buffer.from(
    JSON.stringify({ sub: owner, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString("base64url");
  const session = {
    user,
    access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test`,
    refresh_token: "test",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    expires_in: 3600,
    token_type: "bearer",
  };
  await context.addInitScript(
    ({ session, mobile }) => {
      const original = Storage.prototype.getItem;
      Storage.prototype.getItem = function (key) {
        return /^sb-.*-auth-token$/.test(key) ? JSON.stringify(session) : original.call(this, key);
      };
      if (mobile) localStorage.setItem("momento_theme", "dark");
    },
    { session, mobile },
  );
  const apps = bulk
    ? Array.from({ length: 1001 }, (_, i) => ({
        ...baseApps[0],
        id: `bulk-${String(i).padStart(5, "0")}`,
        candidate_id: `person-${i}`,
        user_id: `user-${i}`,
      }))
    : structuredClone(baseApps);
  const periods = [],
    requests = [],
    posts = [],
    translationRequests = [];
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin === origin) return route.continue();
    requests.push({ url, method: request.method() });
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    };
    const json = (data, status = 200, extra = {}) =>
      route.fulfill({
        status,
        headers: { ...headers, ...extra },
        contentType: "application/json",
        body: JSON.stringify(data),
      });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.hostname === "translate.googleapis.com") {
      translationRequests.push(url.searchParams.get("q"));
      return json({ error: "unavailable" }, 503);
    }
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/rest/v1/rpc/has_role")
      return json(!candidate && request.postDataJSON()._role === "recruiter");
    const page = (rows) => {
      const range = request.headers().range?.split("-").map(Number);
      const offset = range?.[0] ?? Number(url.searchParams.get("offset") ?? 0),
        limit = range ? range[1] - range[0] + 1 : Number(url.searchParams.get("limit") ?? 1000);
      const data = rows.slice(offset, offset + limit);
      return json(data, 200, {
        "content-range": data.length
          ? `${offset}-${offset + data.length - 1}/${rows.length}`
          : `*/${rows.length}`,
      });
    };
    if (url.pathname === "/rest/v1/vacancies")
      return page(url.searchParams.get("created_by") === "eq." + owner ? vacancies : []);
    if (url.pathname === "/rest/v1/applications") {
      const ids = url.searchParams.get("vacancy_id");
      const scoped = apps.filter((app) =>
        !ids || ids.startsWith("eq.")
          ? !ids || app.vacancy_id === ids.slice(3)
          : ids.includes(app.vacancy_id),
      );
      return page(
        scoped.map((app) => ({
          ...app,
          notas: null,
          vacancy: { title: vacancies.find((v) => v.id === app.vacancy_id)?.title },
        })),
      );
    }
    if (url.pathname === "/rest/v1/profiles")
      return json([
        {
          user_id: "user-a",
          nombre: "Ana privada",
          resumen: "Resumen privado",
          ramos: [],
          skills: [],
          certificaciones: [],
        },
      ]);
    if (url.pathname === "/rest/v1/recruiter_workforce_periods") {
      if (missing) return json({ code: "PGRST205", message: "table missing" }, 404);
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        posts.push(body);
        if (failSave) {
          failSave = false;
          return json({ message: "temporarily unavailable", code: "XX000" }, 503);
        }
        const old = periods.find((row) => row.month === body.month);
        const row = {
          ...body,
          id: old?.id || `period-${periods.length + 1}`,
          headcount_end: body.headcount_start + body.hires - body.departures,
          created_at: old?.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (old) Object.assign(old, row);
        else periods.push(row);
        return json(row, 201);
      }
      return page(periods.filter((row) => row.owner_id === owner));
    }
    if (url.pathname.startsWith("/rest/v1/")) return json([]);
    return route.abort();
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return { context, page, requests, posts, periods, translationRequests, errors };
}

test("Recruitment KPIs, cohorts, dynamic pivots and CSV use only the company's vacancies", async () => {
  const { context, page, requests, errors } = await setup();
  try {
    await page.goto(`${origin}/recruiter/metrics`);
    await page.getByTestId("kpi-applications").getByText("4", { exact: true }).waitFor();
    await page.getByTestId("kpi-hired").getByText("1", { exact: true }).waitFor();
    await page.getByText("25%", { exact: false }).first().waitFor();
    const pivot = page.getByRole("table", { name: "Tabla dinámica de reclutamiento" });
    assert.equal(await pivot.locator("tbody tr").count(), 2);
    await page.getByLabel("Agrupar por", { exact: true }).selectOption("month");
    await pivot.getByText("2026-08", { exact: true }).waitFor();
    assert.equal(await pivot.locator("tbody tr").count(), 2);
    await page.getByLabel("Desde", { exact: true }).fill("2026-08-01");
    await page.getByLabel("Hasta", { exact: true }).fill("2026-08-31");
    await page.getByTestId("kpi-applications").getByText("3", { exact: true }).waitFor();
    await page.getByLabel("Filtrar por vacante", { exact: true }).selectOption("vac-a");
    await page.getByTestId("kpi-applications").getByText("2", { exact: true }).waitFor();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar tabla CSV", exact: true }).click();
    const download = await downloading;
    const csv = await readFile(await download.path(), "utf8");
    assert.ok(csv.includes("2026-08"));
    assert.ok(!csv.includes("2026-09"));
    assert.ok(
      requests
        .filter((r) => r.url.pathname === "/rest/v1/vacancies")
        .every((r) => r.url.searchParams.get("created_by") === "eq." + owner),
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("Candidate table filters do not distort KPI denominators and open the selected summary", async () => {
  const { context, page } = await setup();
  try {
    await page.goto(`${origin}/recruiter/metrics`);
    const table = page.getByRole("table", { name: "Seguimiento de candidatos" });
    await table.locator("tbody tr").first().waitFor();
    await page.getByLabel("Etapa en la tabla", { exact: true }).selectOption("entrevista");
    assert.equal(await table.locator("tbody tr").count(), 1);
    assert.equal(
      await page.getByTestId("kpi-applications").getByText("4", { exact: true }).count(),
      1,
    );
    await page.getByLabel("Etapa en la tabla", { exact: true }).selectOption("");
    await page.getByLabel("Buscar candidato o vacante", { exact: true }).fill("Ana privada");
    assert.equal(await table.locator("tbody tr").count(), 2);
    await table.getByRole("link", { name: "Ver resumen", exact: true }).first().click();
    await page.getByRole("dialog", { name: "Ana privada", exact: true }).waitFor();
    assert.ok(new URL(page.url()).searchParams.has("application"));
  } finally {
    await context.close();
  }
});

test("Metrics include more than the PostgREST 1000-row default limit", async () => {
  const { context, page, requests } = await setup({ bulk: true });
  try {
    await page.goto(`${origin}/recruiter/metrics`);
    await page.getByTestId("kpi-applications").getByText("1001", { exact: true }).waitFor();
    const calls = requests.filter((r) => r.url.pathname === "/rest/v1/applications");
    assert.ok(calls.length >= 2);
    assert.ok(calls.some((call) => call.url.searchParams.get("offset") === "1000"));
  } finally {
    await context.close();
  }
});

test("Monthly turnover preview, target, persistence, editing and CSV", async () => {
  const { context, page, posts, periods, errors } = await setup();
  try {
    await page.goto(`${origin}/recruiter/turnover`);
    await page.getByLabel("Mes del indicador", { exact: true }).fill("2026-08");
    await page.getByLabel("Plantilla inicial", { exact: true }).fill("100");
    await page.getByLabel("Altas del mes", { exact: true }).fill("5");
    await page.getByLabel("Bajas del mes", { exact: true }).fill("10");
    await page.getByLabel("Meta de rotación % (opcional)", { exact: true }).fill("8");
    await page
      .getByLabel("Notas del período (opcional)", { exact: true })
      .fill("Contexto privado de la empresa");
    await page.getByTestId("turnover-end").getByText("95", { exact: true }).waitFor();
    await page
      .getByTestId("turnover-rate")
      .getByText(/10[,.]26%/)
      .waitFor();
    await page.getByTestId("turnover-goal").getByText("Sobre la meta", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Guardar período", exact: true }).click();
    await page.getByText("Indicador mensual guardado", { exact: true }).waitFor();
    assert.equal(posts[0].owner_id, owner);
    assert.equal(posts[0].month, "2026-08-01");
    assert.ok(!("headcount_end" in posts[0]));
    await page.reload();
    const history = page.getByRole("table", { name: "Historial de indicadores" });
    await history.getByText("agosto de 2026", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Editar período 2026-08", exact: true }).click();
    assert.equal(
      await page.getByLabel("Notas del período (opcional)", { exact: true }).inputValue(),
      "Contexto privado de la empresa",
    );
    await page.getByLabel("Bajas del mes", { exact: true }).fill("0");
    await page.getByTestId("turnover-goal").getByText("Dentro de meta", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Guardar período", exact: true }).click();
    await page.waitForFunction(
      () => document.querySelector('button[type="submit"]')?.disabled === false,
    );
    assert.equal(periods.length, 1);
    assert.equal(periods[0].departures, 0);
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar historial CSV", exact: true }).click();
    const download = await downloading;
    assert.ok(
      (await readFile(await download.path(), "utf8")).includes('"2026-08","100","5","0","105"'),
    );
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});

test("Impossible headcounts, zero denominator and unavailable history never produce a fake rate or save", async () => {
  const { context, page, posts } = await setup({ missing: true });
  try {
    await page.goto(`${origin}/recruiter/turnover`);
    await page.getByText(/El historial compartido aún no está activado/).waitFor();
    await page.getByLabel("Plantilla inicial", { exact: true }).fill("5");
    await page.getByLabel("Bajas del mes", { exact: true }).fill("6");
    await page.getByRole("alert").filter({ hasText: "Las bajas no pueden superar" }).waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Guardar período", exact: true }).isDisabled(),
      true,
    );
    await page.getByLabel("Plantilla inicial", { exact: true }).fill("0");
    await page.getByLabel("Bajas del mes", { exact: true }).fill("0");
    await page.getByTestId("turnover-rate").getByText("—", { exact: true }).waitFor();
    await page.getByText(/Con una plantilla promedio de cero/).waitFor();
    assert.equal(posts.length, 0);
  } finally {
    await context.close();
  }
});

test("Failed save retains draft and allows retry", async () => {
  const { context, page, posts } = await setup({ failSave: true });
  try {
    await page.goto(`${origin}/recruiter/turnover`);
    await page.getByLabel("Plantilla inicial", { exact: true }).fill("50");
    await page
      .getByLabel("Notas del período (opcional)", { exact: true })
      .fill("Apunte privado conservado");
    await page.getByRole("button", { name: "Guardar período", exact: true }).click();
    await page
      .getByText("No se pudo guardar el período. Tus datos siguen en el formulario.", {
        exact: true,
      })
      .waitFor();
    assert.equal(await page.getByLabel("Plantilla inicial", { exact: true }).inputValue(), "50");
    assert.equal(
      await page.getByLabel("Notas del período (opcional)", { exact: true }).inputValue(),
      "Apunte privado conservado",
    );
    await page.getByRole("button", { name: "Guardar período", exact: true }).click();
    await page.getByText("Indicador mensual guardado", { exact: true }).waitFor();
    assert.equal(posts.length, 2);
  } finally {
    await context.close();
  }
});

test("Candidates cannot load employer metrics", async () => {
  const { context, page, requests } = await setup({ candidate: true });
  try {
    await page.goto(`${origin}/recruiter/metrics`);
    await page.getByText("Tu cuenta no tiene permisos de reclutador.", { exact: true }).waitFor();
    assert.equal(requests.filter((r) => r.url.pathname === "/rest/v1/applications").length, 0);
  } finally {
    await context.close();
  }
});

test("Mobile dark dashboards fit the viewport and private notes stay out of translation requests", async () => {
  const { context, page, translationRequests, errors } = await setup({ mobile: true });
  try {
    await page.goto(`${origin}/recruiter/metrics`);
    await page.getByTestId("kpi-applications").waitFor();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: "/tmp/talent-metrics-mobile.png", fullPage: true });
    await page.goto(`${origin}/recruiter/turnover`);
    await page.getByLabel("Plantilla inicial", { exact: true }).fill("100");
    await page
      .getByLabel("Notas del período (opcional)", { exact: true })
      .fill("Nota secreta de recursos humanos 7219");
    await page.getByRole("button", { name: "Menú", exact: true }).click();
    await page.locator('select[aria-label="Idioma / Language"]:visible').selectOption("en");
    await page.getByRole("heading", { name: "Employee turnover", exact: true }).waitFor();
    assert.equal(
      await page.getByLabel(/Period notes|Notas del período/i).inputValue(),
      "Nota secreta de recursos humanos 7219",
    );
    assert.ok(
      translationRequests.every((text) => !text.includes("Nota secreta de recursos humanos 7219")),
    );
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
});
