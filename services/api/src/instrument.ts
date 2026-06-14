import { loadServeOsEnv } from "@serveos/core-env";

loadServeOsEnv();

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN?.trim();
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE?.trim(),
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    sendDefaultPii: false
  });
}
