import { writeFileSync } from "node:fs";
import { template } from "../src/template.js";
writeFileSync("pakistan-report-template.zip", template());
console.log(
  "Created pakistan-report-template.zip. Both entries are disposable tests scheduled tomorrow PKT.",
);
