import { spawnSync } from "node:child_process";

const apiHost = process.env.DJANGO_API_HOST?.trim();
if (!apiHost) {
  throw new Error("Render no proporcionó DJANGO_API_HOST para compilar el frontend.");
}

const apiUrl = apiHost.startsWith("http") ? apiHost : `https://${apiHost}`;
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build"], {
  stdio: "inherit",
  env: { ...process.env, NEXT_PUBLIC_API_URL: apiUrl },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
