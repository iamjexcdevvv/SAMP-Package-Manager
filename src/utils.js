function isValidPackageFormat(package) {
	const regex = /^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/;
	return regex.test(package);
}

function formatJSON(obj, indent, replacer = null) {
	return JSON.stringify(obj, replacer, indent);
}

module.exports = { isValidPackageFormat, formatJSON };
