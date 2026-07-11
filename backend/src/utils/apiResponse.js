function ok(res, message, data = null, meta = null, status = 200) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function fail(res, message, error = null, status = 500) {
  return res.status(status).json({
    success: false,
    message,
    error: error && error.message ? error.message : error
  });
}

module.exports = { ok, fail };
