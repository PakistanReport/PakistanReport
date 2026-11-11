import { zipSync, strToU8 } from "fflate";
import { pakistanTime } from "./validation.js";
export function template(now = Date.now()) {
  const date = pakistanTime(now + 86400000).slice(0, 10);
  const png = Uint8Array.from(
    atob(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAAAoCAIAAADBrGu+AAAAWklEQVR4nO3PUQkAIBTAwBfCPMawfxRD+HEIgwW4zTr764YLGtCCBrSgAS1oQAsa0IIGtKABLWhACxrQgga0oAEtaEALGtCCBrSgAS1oQAsa0IIGtKABLXjsAoahkFsUUGKSAAAAAElFTkSuQmCC",
    ),
    (c) => c.charCodeAt(0),
  );
  const items = [1, 2].map((n) => ({
    article: `articles/${date}-disposable-publisher-test-${n}.md`,
    image: `images/disposable-publisher-test-${n}.png`,
    schedule: `${date}T${n === 1 ? "10" : "11"}:00:00+05:00`,
  }));
  const files = {
    "manifest.json": strToU8(
      JSON.stringify(
        {
          version: 1,
          timezone: "Asia/Karachi",
          name: "Disposable test batch — replace before editorial use",
          items,
        },
        null,
        2,
      ),
    ),
  };
  for (const [i, item] of items.entries()) {
    files[item.article] = strToU8(
      `---\nlayout: article\ntitle: "Disposable Publisher Test ${i + 1}"\ncategory: "Pakistan"\nauthor: "Pakistan Report Editorial Desk"\ndescription: "Disposable technical test; not a news article."\npublished: true\nimage: "/assets/${item.image}"\nimage_alt: "Disposable test pixel"\n---\n\nThis is disposable technical test content for the Pakistan Report Publisher. It is not a news report. Remove after testing.\n`,
    );
    files[item.image] = png;
  }
  return zipSync(files, { level: 0 });
}
