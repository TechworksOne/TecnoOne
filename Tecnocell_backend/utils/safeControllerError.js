'use strict';

function clientStatus(error) {
  const status = Number(error?.statusCode || error?.status);
  return status >= 400 && status < 500 ? status : null;
}

function sendSafeControllerError(res, error, fallbackMessage, extra = {}) {
  const status = clientStatus(error);
  const payload = {
    ...extra,
    message: status ? error.message : fallbackMessage,
  };

  if (status && error.code) payload.code = error.code;
  return res.status(status || 500).json(payload);
}

function safeErrorMessage(error, fallbackMessage) {
  return clientStatus(error) ? error.message : fallbackMessage;
}

function safeErrorDetails(error) {
  return clientStatus(error) ? error.message : undefined;
}

module.exports = { clientStatus, sendSafeControllerError, safeErrorMessage, safeErrorDetails };
