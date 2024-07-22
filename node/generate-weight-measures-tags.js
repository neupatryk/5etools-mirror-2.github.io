import fs from "fs";
import * as ut from "./util.js";
import "../js/parser.js";
import "../js/utils.js";

// todo parse x-foot case
// todo parse inches and weights
const generateWeightMeasuresForJson = (path) => {
	console.log("\tGenerating weight and measures tags", path);
	const fileContent = ut.readJson(path);

	const parseMatch = (unit) => {
		switch (unit) {
			case "ft.":
				return ["ft", ""];
			case "foot":
				return ["foot", "|s"];
			case "feet":
				return ["ft", "|p"];
			case "mi.":
				return ["mi", ""];
			case "mile":
				return ["mi", "|s"];
			case "miles":
				return ["mi", "|p"];
			default:
				throw new Error(`Unhandled weight and measure unit: ${unit}`);
		}
	};

	const prepareWeightMeasuresTags = (value) => {
		const unitGetter = "(?<unit>ft\\.|mi\\.|foot\\b|mile\\b|feet\\b|miles\\b)";
		const numberGetter = "(?<value>(((\\d+,)*\\d+)(-|/))?((\\d+,)*\\d+))";

		const getWmTagsRegex = new RegExp(`${numberGetter}\\s${unitGetter}`, "gim");

		return value.replace(getWmTagsRegex, (...match) => {
			const { value } = match.last();
			const [unit, modifier] = parseMatch(match.last().unit);

			return `{@wm ${value}|${unit}${modifier}}`;
		});
	};

	const walker = MiscUtil.getWalker({
		keyBlocklist: new Set([...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST, "senses", "otherSources", "alignment", "traitTags", "senseTags", "actionTags", "languageTags", "damageTags", "miscTags", "damageTagsLegendary", "conditionInflict", "conditionInflictLegendary", "savingThrowForced", "savingThrowForcedLegendary", "hp"]),
		isAllowDeleteObjects: false,
		isAllowDeleteArrays: false,
	});

	walker.walk(fileContent, {
		string: prepareWeightMeasuresTags,
	});

	fs.writeFileSync(path, CleanUtil.getCleanJson(fileContent));
};

// todo handle for other data types
ut.listFiles({ dir: "./data/bestiary" })
	.filter((file) => file.endsWith(".json"))
	.forEach(generateWeightMeasuresForJson);
