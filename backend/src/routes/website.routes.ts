import { Router } from "express";
import { getWebsiteSettingsPublic } from "../modules/admin/adminSettings.controller";

export const websiteRoutes = Router();

websiteRoutes.get("/", getWebsiteSettingsPublic);
