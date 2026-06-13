import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;
const LOCAL_DB_PATH = path.join(process.cwd(), "disease_images_local.json");
const FALLBACK_DB_PATH = path.join(process.cwd(), "public", "disease_images_fallback.json");

// Parse large payloads for Base64 images
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Supabase Client if credentials are provided
const rawSupabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
let supabaseClient: any = null;
let supabaseUrl = rawSupabaseUrl.trim();

if (supabaseUrl) {
  // Strip trailing slashes
  supabaseUrl = supabaseUrl.replace(/\/+$/, "");
  // If the user mistakenly appended /rest/v1 or /rest/v1/ (very common from Supabase Dashboard), strip it
  if (supabaseUrl.endsWith("/rest/v1")) {
    supabaseUrl = supabaseUrl.substring(0, supabaseUrl.length - 8);
  }
  supabaseUrl = supabaseUrl.replace(/\/+$/, "");
}

if (supabaseUrl && supabaseKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseKey);
    console.log("Supabase Client has been initialized successfully with Base URL:", supabaseUrl);
  } catch (err) {
    console.error("Failed to initialize Supabase client:", err);
  }
} else {
  console.log("Supabase URL or Key missing. Running with local fallback JSON database.");
}

// Ensure local db and fallback db exist
if (!fs.existsSync(LOCAL_DB_PATH)) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify({}, null, 2));
}
if (!fs.existsSync(FALLBACK_DB_PATH)) {
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify({}, null, 2));
}

// Database Operations
async function getDiseaseImages() {
  let images: Record<string, string> = {};

  // 1. First fetch what we have locally
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      images = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf-8"));
    } else if (fs.existsSync(FALLBACK_DB_PATH)) {
      images = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, "utf-8"));
    }
  } catch (e) {
    console.error("Error reading local JSON file:", e);
  }

  // 2. If Supabase is configured, fetch and merge/sync
  if (supabaseClient) {
    try {
      const { data, error } = await supabaseClient
         .from("disease_images")
        .select("*");

      if (!error && Array.isArray(data)) {
        console.log(`Fetched ${data.length} custom disease images from Supabase.`);
        data.forEach((row: any) => {
          if (row.key && row.image_data) {
            images[row.key] = row.image_data;
          }
        });
        // Cache synced data locally in both spots
        fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(images, null, 2));
        fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(images, null, 2));
      } else if (error) {
        console.log("Supabase notice: Table 'disease_images' might not be created yet. Falling back to local container database file.", error.message);
      }
    } catch (err: any) {
      console.log("Supabase notice: Connection not configured or table missing. Using local container fallback:", err.message);
    }
  }

  return images;
}

async function saveDiseaseImage(key: string, imageData: string) {
  // 1. Save locally to file
  let images: Record<string, string> = {};
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      images = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf-8"));
    } else if (fs.existsSync(FALLBACK_DB_PATH)) {
      images = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, "utf-8"));
    }
  } catch (e) {}
  
  images[key] = imageData;
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(images, null, 2));
  fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(images, null, 2));

  // 2. Save copy to Supabase if configured
  if (supabaseClient) {
    try {
      console.log(`Attempting to upsert custom image for image key: ${key} to Supabase...`);
      const { error } = await supabaseClient
        .from("disease_images")
        .upsert({ key, image_data: imageData }, { onConflict: "key" });

      if (error) {
        console.error("Supabase upsert error:", error.message);
        throw error;
      } else {
        console.log(`Successfully persisted image key: ${key} to Supabase.`);
      }
    } catch (dbErr: any) {
      console.error("Supabase error during save, but saved locally on container:", dbErr.message || dbErr);
    }
  }
}

async function deleteDiseaseImage(key: string) {
  // 1. Delete locally from file
  try {
    if (fs.existsSync(LOCAL_DB_PATH)) {
      const images = JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf-8"));
      delete images[key];
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(images, null, 2));
    }
    if (fs.existsSync(FALLBACK_DB_PATH)) {
      const images = JSON.parse(fs.readFileSync(FALLBACK_DB_PATH, "utf-8"));
      delete images[key];
      fs.writeFileSync(FALLBACK_DB_PATH, JSON.stringify(images, null, 2));
    }
  } catch (e) {}

  // 2. Remove from Supabase if configured
  if (supabaseClient) {
    try {
      console.log(`Attempting to delete image key: ${key} from Supabase...`);
      const { error } = await supabaseClient
        .from("disease_images")
        .delete()
        .eq("key", key);

      if (error) {
        console.error("Supabase delete error:", error.message);
        throw error;
      } else {
        console.log(`Successfully deleted image key: ${key} from Supabase.`);
      }
    } catch (dbErr: any) {
      console.error("Supabase error during delete, but deleted locally on container:", dbErr.message || dbErr);
    }
  }
}

// Middleware to verify admin passcode
const verifyAdminPasscode = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  const configuredPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized access. Passcode is missing." });
  }

  const token = authHeader.split(" ")[1];
  if (token !== configuredPassword) {
    return res.status(403).json({ error: "Invalid admin passcode." });
  }

  next();
};

// ==========================================
// REST API SYSTEM ROUTES
// ==========================================

// Get Configuration Status
app.get("/api/config", async (req, res) => {
  let tableExists = false;
  if (supabaseClient) {
    try {
      const { error } = await supabaseClient
        .from("disease_images")
        .select("key")
        .limit(1);

      // If there is no error, or the error is merely that no rows were found, then table exists.
      // If error.message has "does not exist" or "Could not find the table", then table does NOT exist.
      if (!error) {
        tableExists = true;
      } else if (error && error.message) {
        const msg = error.message.toLowerCase();
        if (!msg.includes("does not exist") && !msg.includes("could not find the table") && !msg.includes("relation")) {
          tableExists = true;
        }
      }
    } catch (err) {
      tableExists = false;
    }
  }

  res.json({
    supabaseConnected: !!supabaseClient,
    supabaseUrlConfigured: !!rawSupabaseUrl,
    hasLocalDb: fs.existsSync(LOCAL_DB_PATH),
    tableExists,
  });
});

// Admin Passcode Check
app.post("/api/admin/verify", (req, res) => {
  const { passcode } = req.body;
  const configuredPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (passcode === configuredPassword) {
    res.json({ success: true, message: "Authentication successful." });
  } else {
    res.status(401).json({ success: false, error: "Invalid passcode. Please try again." });
  }
});

// Fetch all customized disease images
app.get("/api/disease-images", async (req, res) => {
  try {
    const images = await getDiseaseImages();
    res.json(images);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch disease images." });
  }
});

// Save or Update a disease image (Admin Only - One-time upload restriction)
app.post("/api/disease-images", verifyAdminPasscode, async (req, res) => {
  const { key, image_data } = req.body;
  if (!key || !image_data) {
    return res.status(400).json({ error: "Missing key or image_data parameter." });
  }

  try {
    const existingImages = await getDiseaseImages();
    if (existingImages[key]) {
      return res.status(403).json({ error: "This image has already been uploaded once and is locked. It cannot be replaced or edited." });
    }
    await saveDiseaseImage(key, image_data);
    res.json({ success: true, message: `Successfully updated image for key: ${key}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to save disease image." });
  }
});

// Reset or Delete a disease image (Admin Only - Prevent deletion of locked images)
app.post("/api/disease-images/delete", verifyAdminPasscode, async (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: "Missing key parameter." });
  }

  try {
    const existingImages = await getDiseaseImages();
    if (existingImages[key]) {
      return res.status(403).json({ error: "This image has been locked and cannot be deleted or reset." });
    }
    await deleteDiseaseImage(key);
    res.json({ success: true, message: `Successfully reset image for key: ${key}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to reset disease image." });
  }
});

// Serving UI through Vite/Static Files
async function setupViteOrStatic() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files serving mounted.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

setupViteOrStatic();
