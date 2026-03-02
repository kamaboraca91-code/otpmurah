
import { Router } from "express";
import { requireAdminAuth } from "../middleware/requireAdminAuth"; 
import * as c from "../modules/admin/adminCustomPrice.controller";

export const adminServiceRoutes = Router();

adminServiceRoutes.get("/custom-prices", requireAdminAuth, c.listCustomPrices);
adminServiceRoutes.post("/custom-prices", requireAdminAuth, c.upsertCustomPrice);
adminServiceRoutes.delete("/custom-prices/:id",requireAdminAuth,c.deleteCustomPrice);


