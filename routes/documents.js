const router = require("express").Router();
const mongoose = require("mongoose");
const nodemailer = require("nodemailer");
const BusService = require("../models/BusService");

const transporter = nodemailer.createTransport({
  pool: true,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

router.post("/expired-email", async (req, res) => {
  try {
    const documents = Array.isArray(req.body?.documents)
      ? req.body.documents
      : [];

    if (documents.length === 0) {
      return res.status(400).json({ message: "No expired documents provided" });
    }

    const rows = documents
      .map((doc) => {
        const title = escapeHtml(doc.title || "Dokument");
        const category = escapeHtml(doc.category || "Dokumente");
        const validUntil = escapeHtml(doc.valid_until || "");
        const owner = escapeHtml(doc.owner || "");
        const link = escapeHtml(doc.link || "");

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb">${category}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb"><strong>${title}</strong><br><span style="color:#6b7280">${owner}</span></td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb;color:#dc2626">${validUntil}</td>
            <td style="padding:10px;border-bottom:1px solid #e5e7eb"><a href="${link}" target="_blank" style="color:#1d4ed8">Hape dokumentin</a></td>
          </tr>
        `;
      })
      .join("");

    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: "info@idotours.com.mk",
      subject: `Dokument i skaduar - ${documents.length} njoftim${documents.length === 1 ? "" : "e"}`,
      html: `
        <div style="font-family:Arial,sans-serif;color:#111827;max-width:720px;margin:0 auto">
          <h2 style="margin:0 0 12px">Njoftim per dokumente te skaduara</h2>
          <p style="margin:0 0 18px;color:#374151">Dokumentet me poshte kane skaduar. Ju lutemi hapni linkun dhe perditesoni dokumentin sa me shpejt.</p>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb">
            <thead>
              <tr style="background:#f9fafb">
                <th style="padding:10px;text-align:left">Kategoria</th>
                <th style="padding:10px;text-align:left">Dokumenti</th>
                <th style="padding:10px;text-align:left">Valid deri</th>
                <th style="padding:10px;text-align:left">Linku</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:18px;color:#6b7280;font-size:12px">Ky eshte njoftim automatik nga paneli IdoTours.</p>
        </div>
      `,
    });

    return res.status(200).json({ message: "Expired document email sent" });
  } catch (error) {
    console.error("Expired document email failed:", error);
    return res.status(500).json({ message: error.message || "Email failed" });
  }
});

router.get("/services", async (req, res) => {
  try {
    const { operator_id } = req.query;
    if (!mongoose.Types.ObjectId.isValid(operator_id)) {
      return res.status(400).json({ message: "Invalid operator id", data: [] });
    }

    const services = await BusService.find({ operator_id })
      .sort({ service_date: -1, createdAt: -1 })
      .lean();

    return res.status(200).json({ message: "Bus services", data: services });
  } catch (error) {
    return res.status(500).json({ message: error.message, data: [] });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { operator_id, bus_plates, service_date, description } = req.body;
    if (!mongoose.Types.ObjectId.isValid(operator_id)) {
      return res.status(400).json({ message: "Invalid operator id", data: null });
    }
    if (!bus_plates || !service_date || !description) {
      return res.status(400).json({ message: "Missing required fields", data: null });
    }

    const service = await BusService.create(req.body);
    return res.status(201).json({ message: "Bus service created", data: service });
  } catch (error) {
    return res.status(500).json({ message: error.message, data: null });
  }
});

router.put("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid service id", data: null });
    }

    const service = await BusService.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true },
    );
    if (!service) {
      return res.status(404).json({ message: "Bus service not found", data: null });
    }

    return res.status(200).json({ message: "Bus service updated", data: service });
  } catch (error) {
    return res.status(500).json({ message: error.message, data: null });
  }
});

router.delete("/services/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid service id", data: null });
    }

    await BusService.findByIdAndDelete(id);
    return res.status(200).json({ message: "Bus service deleted", data: null });
  } catch (error) {
    return res.status(500).json({ message: error.message, data: null });
  }
});

module.exports = router;
