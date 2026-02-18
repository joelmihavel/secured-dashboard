const fs = require("fs");
const prd = JSON.parse(fs.readFileSync("autobot/prd.json", "utf8"));
const extractionIds = ["UI-013","UI-017","UI-021","UI-025","UI-029","UI-033","UI-037","UI-041","UI-045","UI-049","UI-053","UI-057","UI-061","UI-065","UI-069","UI-073"];
let marked = 0;
extractionIds.forEach(function(id) {
  const s = prd.stories.find(function(s) { return s.id === id; });
  if (s && s.status !== "done" && s.title.includes("Extract")) {
    s.status = "done";
    s.passes = true;
    marked++;
    console.log("done:", id, ":", s.title);
  }
});
fs.writeFileSync("autobot/prd.json", JSON.stringify(prd, null, 2));
const done = prd.stories.filter(function(s) { return s.status === "done"; }).length;
console.log("\nMarked", marked, "extraction stories as done");
console.log("Total done:", done, "/ 131 | Remaining:", 131 - done);
