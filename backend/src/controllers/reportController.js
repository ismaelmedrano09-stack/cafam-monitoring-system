const { buildPdf, buildExcel, getConfig } = require('../reports/reportBuilder');
const { logAudit } = require('../services/auditService');

function reportStamp() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'America/Bogota', hour12: false }).replace(' ', '_').replaceAll(':', '-');
}

async function pdf(req, res) {
  const type = req.params.type || 'daily';
  const buffer = await buildPdf({ type, user: req.user });
  await logAudit({ userId: req.user.id, action: 'generate_report', entity: 'reports', description: `Reporte PDF ${type}`, ipAddress: req.ip });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=cafam-${getConfig(type).file}-${reportStamp()}.pdf`);
  return res.send(buffer);
}

async function excel(req, res) {
  const type = req.params.type || 'daily';
  const buffer = await buildExcel({ type, user: req.user });
  await logAudit({ userId: req.user.id, action: 'generate_report', entity: 'reports', description: `Reporte Excel ${type}`, ipAddress: req.ip });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=cafam-${getConfig(type).file}-${reportStamp()}.xlsx`);
  return res.send(buffer);
}

module.exports = { pdf, excel };
