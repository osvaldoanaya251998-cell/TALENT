import { defineConfig } from "nitro/config";

export default defineConfig({
  plugins: ["./src/server/plugins/application-notifications.ts"],
});
