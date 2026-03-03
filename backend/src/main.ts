import dns from "node:dns";
import { createApp } from "./app";
import { env } from "./env";

if (env.SMTP_FAMILY === 4) {
  dns.setDefaultResultOrder("ipv4first");
}

const app = createApp();
const port = env.PORT;

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
