import fs from "fs";
import * as ut from "./util.js";
import "../js/parser.js";
import "../js/utils.js";

// todo parse x-foot case
// it will not parse values under these keys
const keyBlocklist = new Set([...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST, "senses", "otherSources", "alignment", "traitTags", "senseTags", "actionTags", "languageTags", "damageTags", "miscTags", "damageTagsLegendary", "conditionInflict", "conditionInflictLegendary", "savingThrowForced", "savingThrowForcedLegendary", "hp"]);

// match 1 5 30 120 3000 1,200 300/1,200 50-90
const numberGetter = "(?<value>(((\\d+,)*\\d+)(-|/))?((\\d+,)*\\d+))";
// match " " or -
const delimiterGetter = "(?<delimiter>[\\s-])";
// match unit only of it is whole word
const unitGetter = "(?<unit>ft\\.|mi\\.|foot\\b|mile\\b|feet\\b|miles\\b)";
// will exclude matches that are inside other tags
const tagOmit = "(?![^{]*})";

// todo parse inches and weights
const generateWeightMeasuresForJson = (path) => {
	console.log("\tGenerating weight and measures tags", path);
	const fileContent = ut.readJson(path);

	const parseMatch = (unit, isValueOne) => {
		switch (unit) {
			case "ft.":
				return ["", ""];
			case "foot":
				if (!isValueOne) return ["", "vs"];
				return ["", "v"];
			case "feet":
				return ["", "v"];
			case "mi.":
				return ["mi", ""];
			case "mile":
				if (!isValueOne) return ["mi", "vs"];
				return ["mi", "v"];
			case "miles":
				return ["mi", "v"];
			default:
				throw new Error(`Unhandled weight and measure unit: ${unit}`);
		}
	};

	/**
	 * Flags info:
	 * v = will extend unit to full name // ft = feet|foot
	 * d = will add dash between value and unit // 10-feet
	 * s = will force single form of unit even when value is not equal to 1 // 10 foot
	 */
	const prepareWeightMeasuresTags = (value) => {
		const getWmTagsRegex = new RegExp(`${numberGetter}${delimiterGetter}${unitGetter}${tagOmit}`, "gim");

		return value.replace(getWmTagsRegex, (...match) => {
			const { value, delimiter } = match.last();
			const isValueOne = value === "1";

			const [unit, unitFlags] = parseMatch(match.last().unit, isValueOne);
			let flags = unitFlags;

			if (delimiter !== " ") flags += "d";

			let tagStack = `{@wm ${value}`;
			if (unit.length || flags.length) tagStack += "|";
			tagStack += `${unit}`;
			if (flags.length) tagStack += `|${flags}`;
			return `${tagStack}}`;
		});
	};

	MiscUtil.getWalker({
		keyBlocklist,
		isAllowDeleteObjects: false,
		isAllowDeleteArrays: false,
	}).walk(fileContent, {
		string: prepareWeightMeasuresTags,
	});

	fs.writeFileSync(path, CleanUtil.getCleanJson(fileContent));
};

// todo handle for other data types
ut.listFiles({ dir: "./data/bestiary" })
	.filter((file) => file.endsWith(".json"))
	.forEach(generateWeightMeasuresForJson);
