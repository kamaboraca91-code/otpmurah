import { createApp } from "./app";
import { env } from "./env";

const app = createApp();
const port = env.PORT;

app.listen(port, () => {
  console.log(`API running on port ${port}`);
});
