const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const app = express();
const { exec } = require("child_process");

const port = 3001;
let check = false;
let track = false;
// Serve static files (HTML, CSS, etc.) from the public directory
app.use(express.static("public"));

// Parse application/json
app.use(bodyParser.json());

//Function to fetch json data
const fetchData = async () => {
  const dataDir = path.join(__dirname, "heartbeatData");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir);
  }

  const jsonFiles = fs
    .readdirSync(dataDir)
    .filter((file) => file.endsWith(".json"));
  if (jsonFiles.length > 0) {
    const firstJsonFile = jsonFiles[0];
    let jsonData = JSON.parse(
      fs.readFileSync(path.join(dataDir, firstJsonFile))
    );
    return jsonData;
  }
  return null;
};

//Function to check if app is running
const checkAppRunning = async (appName) => {
  if (!appName) return false;
  return new Promise((resolve, reject) => {
    if (process.platform == "darwin" || process.platform == "linux") {
      exec(`ps aux | grep -v grep | grep '${appName}'`, (error, stdout) => {
        if (!error && stdout) {
          resolve({ success: true, isRunning: true });
        } else {
          // resolve({ success: false, isRunning: false });
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
// Function to send post request via url
const sendPing = async (jsonData) => {
  try {
    const apiResponse = await axios.post(
      "http://localhost:3000/ping",
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

  // Store the data locally in a JSON file

  const filePath = path.join(
    __dirname,
    "heartbeatData",
    `${formData.client}.json`
  );

  const jsonData = JSON.stringify(formData, null, 2);
  fs.writeFileSync(filePath, jsonData);

  initializeJsonData();
  const appsArray = formData.appsArray || [];
  console.log(appsArray);
  flag = true;
  return res.redirect("/success");
  //   for (let i = 0; i < appsArray.length; i++) {
  //     let eachApp = appsArray[i];
  //     console.log(eachApp, "that's it");

  //     try {
  //       const checkApp = await checkAppRunning(eachApp);
  //       if (checkApp) {
  //         console.log(`app ${eachApp} is running`);
  //         const appData = {
  //           client: formData.client,
  //           store: formData.store,
  //           software: formData.software,
  //           app: eachApp,
  //         };
  //         console.log(appData, "this is app data");

  //         await sendPing(appData); // Don't handle response here, let it propagate up
  //       } else {
  //         console.log("App is not running");
  //       }
  //     } catch (error) {
  //       console.error("Error checking app status:", error.message);
  //       return res.status(500).send("Error checking app status.");
  //     }
  //   }

  // Send a successful response after all iterations are complete
  //   return res.redirect("success.html");
});

// app.use((req, res, next) => {
//   const currentPath = req.path;
//   if (currentPath === "/success") {
//     flag = true;
//   } else if (currentPath === "/" || currentPath === "/home") {
//     flag = false;
//   }
//   console.log(`Flag updated to: ${flag}`);

//   next();
// });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/home", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "data.html"));
});

app.get("/success", (req, res) => {
  console.log("hi");
  flag = true;
  res.sendFile(path.join(__dirname, "public", "success.html"));
});

app.post("/flag", (req, res) => {
  let { flag } = req.body;

  // Update the flag variable with the received value
  if (flag !== undefined) {
    // Convert the value to a boolean
    const newFlag = Boolean(flag);

    // Update the global flag variable
    flag = newFlag;
    check = flag;
    console.log(check);
    res.json({ flag: newFlag }); // Send back the updated flag value
  } else {
    res.status(400).json({ error: "Invalid flag value" });
  }
});

let jsonData;
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
  const open = await import("open");

  // Open the HTML page in the default web browser
  jsonData = await fetchData();
  console.log(jsonData, "this is json data");
  flag = false;
  if (jsonData) {
    open.default(`http://localhost:${port}/home`);
  } else {
    open.default(`http://localhost:${port}`);
  }
});

const main = async () => {
  console.log(check);
  if (check === false) {
    console.log("Not started interval yet");
  } else {
    if (!jsonData) {
      console.log("data not found");
    } else {
      console.log("Checking app status of :", jsonData);
      const appsArray = jsonData.appsArray || []; // Ensure appsArray is an array
      console.log(appsArray, "appsArray");
      for (let i = 0; i < appsArray.length; i++) {
        let eachApp = appsArray[i];
        console.log(eachApp, "that's it");

        try {
          const checkApp = await checkAppRunning(eachApp);
          if (checkApp) {
            console.log(`app ${eachApp} is running`);
            const appData = {
              client: jsonData.client, // Use jsonData.client
              store: jsonData.store, // Use jsonData.store
              software: jsonData.software, // Use jsonData.software
              app: eachApp,
            };
            console.log(appData, "this is app data");

            await sendPing(appData); // Don't handle response here, let it propagate up
          } else {
            console.log("App is not running");
          }
        } catch (error) {
          console.error("Error checking app status:", error.message);
          // You might want to handle errors differently here
        }
      }
    }
  }
};

setInterval(() => {
  main();
}, 5 * 1000);
