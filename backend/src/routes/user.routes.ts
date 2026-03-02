import { Router } from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../middleware/requireUserAuth";
import { prisma } from "../prisma";
import { HttpError } from "../utils/errors";

export const userRoutes = Router();

function validatePassword(value: string) {
  if (value.length < 10) {
    throw new HttpError(400, "Password minimal 10 karakter");
  }
  if (value.length > 72) {
    throw new HttpError(400, "Password maksimal 72 karakter");
  }
  if (!/[a-z]/.test(value)) {
    throw new HttpError(400, "Password harus ada huruf kecil");
  }
  if (!/[A-Z]/.test(value)) {
    throw new HttpError(400, "Password harus ada huruf besar");
  }
  if (!/\d/.test(value)) {
    throw new HttpError(400, "Password harus ada angka");
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    throw new HttpError(400, "Password harus ada simbol");
  }
}

userRoutes.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, email: true, name: true, balance: true, createdAt: true },
  });

  return res.json({ user });
});

userRoutes.put("/me", requireAuth, async (req, res) => {
  const rawName = req.body?.name;
  const name = String(rawName ?? "").trim();

  if (!name) {
    throw new HttpError(400, "Nama wajib diisi");
  }
  if (name.length > 100) {
    throw new HttpError(400, "Nama maksimal 100 karakter");
  }

  const user = await prisma.user.update({
    where: { id: req.userId! },
    data: { name },
    select: {
      id: true,
      email: true,
      name: true,
      balance: true,
      createdAt: true,
    },
  });

  return res.json({ user });
});

userRoutes.put("/password", requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? "");
  const newPassword = String(req.body?.newPassword ?? "");

  if (!currentPassword) {
    throw new HttpError(400, "Password saat ini wajib diisi");
  }
  if (!newPassword) {
    throw new HttpError(400, "Password baru wajib diisi");
  }

  validatePassword(newPassword);

  if (currentPassword === newPassword) {
    throw new HttpError(400, "Password baru harus berbeda dari password saat ini");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { id: true, passwordHash: true },
  });

  if (!currentUser) {
    throw new HttpError(404, "User tidak ditemukan");
  }

  const matches = await bcrypt.compare(currentPassword, currentUser.passwordHash);
  if (!matches) {
    throw new HttpError(400, "Password saat ini salah");
  }

  const nextHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: nextHash },
  });

  const sessionWhere: any = {
    userId: currentUser.id,
    revokedAt: null,
  };
  if (req.sessionId) {
    sessionWhere.NOT = { id: req.sessionId };
  }

  await prisma.session.updateMany({
    where: sessionWhere,
    data: { revokedAt: new Date() },
  });

  return res.json({ ok: true });
});
