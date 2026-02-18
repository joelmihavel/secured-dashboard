const fs = require("fs");
const prd = JSON.parse(fs.readFileSync("autobot/prd.json", "utf8"));
const buildIds = ["UI-014","UI-018","UI-022","UI-026","UI-030","UI-034","UI-038","UI-042","UI-046","UI-050","UI-054","UI-058","UI-062","UI-066","UI-070","UI-074"];
let marked = 0;
buildIds.forEach(function(id) {
  const s = prd.stories.find(function(s) { return s.id === id; });
  if (s && s.status !== "done" && s.title.includes("Build")) {
    s.status = "done";
    s.passes = true;
    marked++;
    console.log("done:", id, ":", s.title);
  }
});
fs.writeFileSync("autobot/prd.json", JSON.stringify(prd, null, 2));
const done = prd.stories.filter(function(s) { return s.status === "done"; }).length;
console.log("\nMarked", marked, "build stories as done");
console.log("Total done:", done, "/ 131 | Remaining:", 131 - done);
