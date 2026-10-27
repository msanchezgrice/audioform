import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TALKFORM_GA_MEASUREMENT_ID, talkformGaMeasurementId } from "./ga4";

test("always resolves Talkform's canonical GA4 measurement id", () => {
  assert.equal(TALKFORM_GA_MEASUREMENT_ID, "G-H3363LXJ61");
  assert.equal(talkformGaMeasurementId(" g-abc123xyz "), "G-ABC123XYZ");
  assert.equal(talkformGaMeasurementId("https://example.com/collect"), TALKFORM_GA_MEASUREMENT_ID);
  assert.equal(talkformGaMeasurementId(""), TALKFORM_GA_MEASUREMENT_ID);
  assert.equal(talkformGaMeasurementId(undefined), TALKFORM_GA_MEASUREMENT_ID);
});

test("Talkform's loader honors Do Not Track and disables Google advertising signals", async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here, "../components/talkform-google-analytics.tsx"), "utf8");
  assert.match(source, /navigator\.doNotTrack/);
  assert.match(source, /window\.doNotTrack/);
  assert.match(source, /navigator\.globalPrivacyControl/);
  assert.match(source, /window\.globalPrivacyControl/);
  assert.match(source, /allow_google_signals:\s*false/);
  assert.match(source, /allow_ad_personalization_signals:\s*false/);
  assert.match(source, /location\.pathname/);
  assert.match(source, /respond/);
});


test("QA browser sessions never start aggregate analytics, including later untagged navigation", async () => {
  const {runInNewContext} = await import("node:vm");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const source = await readFile(path.join(here,"../app/layout.tsx"),"utf8");
  const script = source.match(/__html: `([\s\S]*?)` \}\}/)?.[1];
  assert.ok(script);
  const entries = new Map<string,string>();
  const loaded: string[] = [];
  const makeContext = (url:string) => {
    const location = new URL(url);
    const window = {location,history:{pushState(){},replaceState(){}},sessionStorage:{getItem:(key:string)=>entries.get(key)??null,setItem:(key:string,value:string)=>entries.set(key,value)},dispatchEvent(){},addEventListener(){}};
    return {window,navigator:{},URL,URLSearchParams,CustomEvent:class {},document:{documentElement:{classList:{toggle(){}}},createElement:()=>({src:"",dataset:{},async:false}),head:{appendChild:(script:{src:string})=>loaded.push(script.src)}}};
  };
  runInNewContext(script, makeContext("https://talkform.ai/?pb_traffic_type=qa"));
  runInNewContext(script, makeContext("https://talkform.ai/dashboard"));
  assert.deepEqual(loaded,[]);
  entries.clear();
  runInNewContext(script, makeContext("https://talkform.ai/docs"));
  assert.equal(loaded.length,1,"ordinary external visitor retains analytics");
});
