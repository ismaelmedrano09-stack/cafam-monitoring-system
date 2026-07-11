const { fail } = require('../utils/apiResponse');

module.exports = function errorHandler(err, req, res, next) {
  console.error(err);
  if (err.code === 'ER_DUP_ENTRY') {
    return fail(res, 'El código ingresado ya está registrado.', 'DUPLICATE_ENTRY', 409);
  }
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return fail(res, 'La sede o el registro relacionado no existe.', 'INVALID_REFERENCE', 400);
  }
  const status = err.status || 500;
  const message = status < 500 ? err.message : 'Ocurrió un error interno. Intente nuevamente.';
  return fail(res, message, status < 500 ? err.code || 'REQUEST_ERROR' : 'INTERNAL_ERROR', status);
};
