import fs from "fs";
import * as ut from "./util.js";
import { prettifyFile, FILE_BLOCKLIST } from "./prettify-data/util-prettify-data.js";

// todo parse x-foot case
// todo parse inches and weights
const generateImperialForJson = (path) => {
	console.log("\tGenerating imperial tags", path);
	const fileContent = JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));

	const prepareImperialTags = (value) => {
		const cleanTags = /{@imperial\s(\S+\s[^}]+)}/gim;
		const matchGroups = /(?<=\s|^)((?:(?:(?:\d+,)*\d+)(?:-|\\|\/))?(?:(?:\d+,)*\d+))\s(foot\b|feet\b|mile\b|miles\b|ft\.)/gim;

		const cleanedValue = value.replace(cleanTags, (_, strippedContent) => strippedContent);
		return cleanedValue.replace(matchGroups, (_, value, unit) => `{@imperial ${value} ${unit}}`);
	};

	const parseValue = (value) => {
		if (Array.isArray(value)) {
			return value.map(parseValue);
		} else if (typeof value === "object" && value !== null) {
			return Object.entries(value).reduce(reduceObject, {});
		} else if (typeof value === "string") {
			return prepareImperialTags(value);
		} else {
			return value;
		}
	};

	const reduceObject = (currentObject, [key, value]) => {
		return { ...currentObject, [key]: parseValue(value) };
	};

	const preparedObject = Object.entries(fileContent).reduce(reduceObject, {});

	fs.writeFileSync(path, JSON.stringify(preparedObject), "utf-8");
	prettifyFile(path);
};

// todo handle for other data types
ut.listFiles({ dir: "./data/bestiary" }).filter((file) => file.endsWith(".json") && !FILE_BLOCKLIST.has(file.split("/").last())).forEach(generateImperialForJson);