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
const publicDir = path.join(__dirname, "public");
const dataDir = path.join(process.cwd(), "data"); // Define the data directory path
app.use(express.static(publicDir));
app.use(bodyParser.json());

// Function to create the 'data' directory if it doesn't exist
const createDataDirectory = async () => {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    console.log("Created 'data' folder.");
  } catch (error) {
    if (error.code === "ENOENT") {
      await fs.mkdir(dataDir, { recursive: true });
    } else if (error.code === "EEXIST") {
      console.log("'data' folder already exists.");
    } else {
      console.error("Error creating 'data' folder:", error);
    }
  }
};

const checkDataDirectory = async () => {
  try {
    await fs.access(dataDir);
    console.log("'data' folder exists.");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.log("'data' folder does not exist.");
      await createDataDirectory();
    } else {
      console.error("Error checking 'data' folder:", error);
    }
  }
};

const fetchData = async () => {
  // Ensure the 'data' directory exists
  await checkDataDirectory();

  try {
    const jsonFiles = (await fs.readdir(dataDir)).filter((file) =>
      file.endsWith(".json")
    );
    console.log(jsonFiles, "these");
    if (jsonFiles == [] || jsonFiles.length > 0) {
      const firstJsonFile = jsonFiles[0];
      const res = JSON.parse(
        await fs.readFile(path.join(dataDir, firstJsonFile), "utf-8")
      );
      return res;
    }
  } catch (error) {
    console.error("Error reading JSON data:", error, dataDir, "hello");
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
    return jsonData;
  } else {
    console.log("no data here");
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

app.get("/data", async (req, res) => {
  const resp = await fetchData();
  if (resp) {
    console.log(resp, "hi");
    return res.json({ result: resp });
  } else {
    res.status(404).json({ error: "Data not found" });
  }
});

app.put("/update", async (req, res) => {
  const data = req.body;
  try {
    if (
      !data ||
      !data.client ||
      !data.store ||
      !data.software ||
      !data.appsArray
    ) {
      return res.status(400).json({ error: "Invalid data in the request" });
    }
    const dataDir = path.join(__dirname, "data");

    // Use fs.promises.readdir to read the directory asynchronously
    const jsonFiles = await fs.readdir(dataDir);

    // Now you can use the filter method on jsonFiles
    const filteredJsonFiles = jsonFiles.find((file) => file.endsWith(".json"));
    console.log(filteredJsonFiles, "hehehe");
    if (filteredJsonFiles.length > 0) {
      jsonData = {
        client: data.client,
        store: data.store,
        software: data.software,
        appsArray: data.appsArray,
      };
      const dataToWrite = JSON.stringify(jsonData, null, 2);
      const clientFile = path.join(dataDir, filteredJsonFiles);
      const checkFile = await fs.access(clientFile);
      console.log(checkFile);
      //   if (checkFile) {
      fs.writeFile(clientFile, dataToWrite, {
        encoding: "utf8",
        flag: "w",
      });
      return res.status(200).json({ message: "Data updated successfully" });
      //   } else {
      //     console.log("The file doesn't exist.");
      //   }
    } else {
      console.log("No JSON files found in the directory.");
    }
  } catch (error) {
    console.log("error editing file :", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

// app.post("/updatedData", (req, res) => {
//   const data = req.body;
//   console.log(data);
//   jsonData = data;
// });

app.post("/submit", async (req, res) => {
  const formData = req.body;
  console.log(formData);

  if (!formData.client || !formData.store || !formData.software) {
    console.error("Missing client, store, or software in formData.");
    return res.status(400).send("Missing client, store, or software.");
  }

  const filePath = path.join(dataDir, `${formData.client}.json`);

  const result = JSON.stringify(formData, null, 2);
  try {
    await fs.writeFile(filePath, result);
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
  res.sendFile(path.join(publicDir, "index.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(publicDir, "data.html"));
});

app.get("/edit", (req, res) => {
  res.sendFile(path.join(publicDir, "edit.html"));
});

app.get("/success", (req, res) => {
  console.log("hi");
  flag = true;
  res.sendFile(path.join(publicDir, "success.html"));
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
