import { Router } from "express";
import { requireAuth } from "../middleware/requireUserAuth";
import { getBalanceMutationHistoryForUser } from "../modules/balance/balanceMutations.service";

export const balanceMutationsRoutes = Router();

balanceMutationsRoutes.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const type = String(req.query.type ?? "ALL").trim();
    const direction = String(req.query.direction ?? "ALL").trim();
    const query = String(req.query.q ?? req.query.query ?? "").trim();

    const data = await getBalanceMutationHistoryForUser(req.userId!, {
      page,
      pageSize,
      type,
      direction,
      query,
    });

    return res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
});
