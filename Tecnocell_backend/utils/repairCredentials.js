const DEVICE_CREDENTIAL_FIELDS = [
  'patron_contrasena',
  'acceso_valor',
  'pin',
  'password',
  'contrasena',
  'patron',
];

function withoutDeviceCredentials(repair) {
  const safe = { ...repair };
  for (const field of DEVICE_CREDENTIAL_FIELDS) delete safe[field];
  return safe;
}

module.exports = { DEVICE_CREDENTIAL_FIELDS, withoutDeviceCredentials };
