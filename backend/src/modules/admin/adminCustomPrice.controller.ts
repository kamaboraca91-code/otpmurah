
import { prisma } from "../../prisma";
import { HttpError } from "../../utils/errors";
import { invalidateHeroSmsTopCountriesCaches } from "../herosms/herosms.client";

export async function listCustomPrices(req: any, res: any, next: any) {
  try {
    const service = String(req.query?.service ?? "").trim();
    if (!service) throw new HttpError(400, "Missing service");

    const items = await prisma.adminServiceCountryCustomPrice.findMany({
      where: { service },
      orderBy: [{ country: "asc" }],
    });

    res.json({ ok: true, items });
  } catch (e) {
    next(e);
  }
}

export async function upsertCustomPrice(req: any, res: any, next: any) {
  try {
    const service = String(req.body?.service ?? "").trim();
    const country = Number(req.body?.country);
    const customPrice = Number(req.body?.customPrice);
    const isActive =
      req.body?.isActive === undefined ? true : Boolean(req.body?.isActive);

    if (!service) throw new HttpError(400, "Missing service");
    if (!Number.isFinite(country)) throw new HttpError(400, "Invalid country");
    if (!Number.isFinite(customPrice) || customPrice <= 0)
      throw new HttpError(400, "Invalid customPrice");

    const item = await prisma.adminServiceCountryCustomPrice.upsert({
      where: { service_country: { service, country } },
      create: { service, country, customPrice, isActive },
      update: { customPrice, isActive },
    });

    invalidateHeroSmsTopCountriesCaches();

    res.json({ ok: true, item });
  } catch (e) {
    next(e);
  }
}

export async function deleteCustomPrice(req: any, res: any, next: any) {
  try {
    const id = String(req.params?.id ?? "").trim();
    if (!id) throw new HttpError(400, "Missing id");

    await prisma.adminServiceCountryCustomPrice.delete({ where: { id } });
    invalidateHeroSmsTopCountriesCaches();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}
