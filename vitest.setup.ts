import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import "@testing-library/jest-dom/vitest";

process.env.APP_DEFAULT_TIMEZONE ??= "Asia/Kolkata";
process.env.APP_DEFAULT_CURRENCY ??= "INR";
process.env.APP_DEFAULT_LOCALE ??= "en-IN";
