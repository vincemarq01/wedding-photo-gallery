import { app } from "./app.js";
import { config } from "./config.js";
import { checkFolder } from "./services/drive.js";
try {
  await checkFolder();
  app.listen(config.PORT, "0.0.0.0", () =>
    console.log(
      `Wedding upload API listening on ${config.PORT}; destination access verified.`,
    ),
  );
} catch {
  console.error(
    "Startup failed: check Google OAuth credentials, scope and destination folder write access.",
  );
  process.exit(1);
}
