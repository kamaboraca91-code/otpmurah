import { Router } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { requireAdminAuth } from "../middleware/requireAdminAuth";
import * as c from "../modules/admin/adminSettings.controller";
import { HttpError } from "../utils/errors";

export const adminSettingsRoutes = Router();

const uploadDir = path.join(process.cwd(), "uploads", "website");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".jpg";
    const safeExt = /\.(jpg|jpeg|png|webp|gif|svg)$/.test(ext) ? ext : ".jpg";
    const stamp = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
    cb(null, `${stamp}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (String(file.mimetype ?? "").startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, "File harus berupa gambar"));
  },
});

adminSettingsRoutes.get("/pricing", requireAdminAuth, c.getPricing);
adminSettingsRoutes.put("/pricing", requireAdminAuth, c.updatePricing);

adminSettingsRoutes.get("/website", requireAdminAuth, c.getWebsiteSettingsAdmin);
adminSettingsRoutes.put("/website", requireAdminAuth, c.updateWebsiteSettings);
adminSettingsRoutes.post(
  "/website/upload-image",
  requireAdminAuth,
  upload.single("image"),
  c.uploadWebsiteImage,
);
adminSettingsRoutes.post("/website/banners", requireAdminAuth, c.createWebsiteBanner);
adminSettingsRoutes.put("/website/banners/:id", requireAdminAuth, c.updateWebsiteBanner);
adminSettingsRoutes.delete("/website/banners/:id", requireAdminAuth, c.deleteWebsiteBanner);
