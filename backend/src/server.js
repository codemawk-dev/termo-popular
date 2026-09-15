import "dotenv/config";

import { buildApp } from "./app.js";
import { createRepositories } from "./supabase/repositories.js";

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "0.0.0.0";

const app = buildApp(createRepositories());

await app.listen({ port, host });
