const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");
const scriptCode = fs.readFileSync("script.js", "utf8");

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (err) => {
    console.error("JSDOM Error:", err);
});
virtualConsole.on("jsdomError", (err) => {
    console.error("JSDOM jsdomError:", err);
});
virtualConsole.sendTo(console);

const dom = new JSDOM(html, { 
    runScripts: "dangerously", 
    resources: "usable",
    virtualConsole 
});

dom.window.onload = () => {
    console.log("Window loaded. Evaluating script.js...");
    try {
        dom.window.eval(scriptCode);
        console.log("Script evaluated successfully!");
    } catch (e) {
        console.error("Eval error:", e);
    }
};

setTimeout(() => {
    console.log("Timeout reached.");
}, 3000);
