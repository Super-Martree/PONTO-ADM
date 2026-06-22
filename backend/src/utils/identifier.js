const allowedIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;

function sqlIdentifier(value, fallback) {
  const candidate = String(value || fallback || "").trim();

  if (!allowedIdentifier.test(candidate)) {
    throw new Error(`Identificador SQL invalido: ${candidate}`);
  }

  return `[${candidate.replace(/]/g, "]]")}]`;
}

module.exports = {
  sqlIdentifier,
};
