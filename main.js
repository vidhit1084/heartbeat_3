const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs/promises"); // Using 'fs/promises' for async file operations
const path = require("path");
const { exec, spawn } = require("child_process"); // Import spawn from child_process

const app = express();
const port = 3001;
let check = false;
let flag = false;
let jsonData;

const publicDir = path.join(process.cwd(), "public");

app.use(express.static(publicDir));
app.use(bodyParser.json());

const fetchData = async () => {
  const dataDir = path.join(process.cwd(), "data");
  try {
    await fs.mkdir(dataDir, { recursive: true }); // Ensure the directory exists
    const jsonFiles = (await fs.readdir(dataDir)).filter((file) =>
      file.endsWith(".json")
    );
    if (jsonFiles.length > 0) {
      const firstJsonFile = jsonFiles[0];
      const jsonData = JSON.parse(
        await fs.readFile(path.join(dataDir, firstJsonFile), "utf-8")
      );
      return jsonData;
    }
  } catch (error) {
    console.error("Error reading JSON data:", error);
  }
  return null;
};

const checkAppRunning = async (appName) => {
  if (!appName) return false;
  return new Promise((resolve, reject) => {
    if (process.platform == "darwin" || process.platform == "linux") {
      exec(`ps aux | grep -v grep | grep '${appName}'`, (error, stdout) => {
        if (!error && stdout) {
          resolve({ success: true, isRunning: true });
        } else {
          console.log(`app ${appName} isn't running`);
          reject(new Error(`app ${appName} isn't running`));
          console.log("failed");
        }
      });
    } else if (process.platform === "win32") {
      console.log("Checking on Windows...");
      exec(`tasklist /FI "IMAGENAME eq ${appName}"`, (error, stdout) => {
        if (!error && stdout.toLowerCase().includes(appName.toLowerCase())) {
          resolve({ success: true, isRunning: true });
          console.log("App is running on Windows.");
        } else {
          reject("App is not running on Windows.");
          console.error("App is not running on Windows.");
        }
      });
    } else {
      console.log("Unsupported operating system.");
      reject("Unsupported operating system.");
    }
  });
};

const initializeJsonData = async () => {
  jsonData = await fetchData();
  if (jsonData) {
    console.log(jsonData);
  }
};

const sendPing = async (jsonData) => {
  try {
    const apiResponse = await axios.post(
      "https://api.metadome.ai/heartbeat-dev/ping",
      jsonData
    );
    console.log("API response:", apiResponse.data);
    return apiResponse.data;
  } catch (error) {
    console.error("API error:", error);
    throw new Error("Error submitting data to the API.");
  }
};

app.post("/submit", async (req, res) => {
  const formData = req.body;
  console.log(formData);

  if (!formData.client || !formData.store || !formData.software) {
    console.error("Missing client, store, or software in formData.");
    return res.status(400).send("Missing client, store, or software.");
  }

  const filePath = path.join(process.cwd(), "data", `${formData.client}.json`);

  const jsonData = JSON.stringify(formData, null, 2);
  try {
    await fs.writeFile(filePath, jsonData);
    initializeJsonData();
    const appsArray = formData.appsArray || [];
    console.log(appsArray);
    flag = true;
    return res.redirect("/success");
  } catch (error) {
    console.error("Error writing JSON file:", error);
    return res.status(500).send("Error writing JSON file.");
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "index.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "data.html"));
});

app.get("/success", (req, res) => {
  console.log("hi");
  flag = true;
  res.sendFile(path.join(process.cwd(), "public", "success.html"));
});

app.post("/flag", (req, res) => {
  let { flag } = req.body;

  if (flag !== undefined) {
    const newFlag = Boolean(flag);
    flag = newFlag;
    check = flag;
    console.log(check);
    res.json({ flag: newFlag });
  } else {
    res.status(400).json({ error: "Invalid flag value" });
  }
});

app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  jsonData = await fetchData();
  console.log(jsonData, "this is json data");
  flag = false;
  if (jsonData) {
    openBrowser(`http://localhost:${port}/home`);
  } else {
    openBrowser(`http://localhost:${port}`);
  }
});

const openBrowser = (url) => {
  switch (process.platform) {
    case "darwin":
      spawn("open", [url]);
      break;
    case "win32":
      spawn("start", [url], { shell: true });
      break;
    default:
      spawn("xdg-open", [url]);
  }
};

const main = async () => {
  console.log(check);
  if (check === false) {
    console.log("Not started interval yet");
  } else {
    if (!jsonData) {
      console.log("data not found");
    } else {
      console.log("Checking app status of :", jsonData);
      const appsArray = jsonData.appsArray || [];
      console.log(appsArray, "appsArray");
      for (let i = 0; i < appsArray.length; i++) {
        let eachApp = appsArray[i];
        console.log(eachApp, "that's it");

        try {
          const checkApp = await checkAppRunning(eachApp);
          if (checkApp) {
            console.log(`app ${eachApp} is running`);
            const appData = {
              client: jsonData.client,
              store: jsonData.store,
              software: jsonData.software,
              app: eachApp,
            };
            console.log(appData, "this is app data");

            await sendPing(appData);
          } else {
            console.log("App is not running");
          }
        } catch (error) {
          console.error("Error checking app status:", error.message);
        }
      }
    }
  }
};

setInterval(() => {
  main();
}, 5 * 1000);
