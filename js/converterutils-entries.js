"use strict";

const LAST_KEY_ALLOWLIST = new Set([
	"entries",
	"entry",
	"items",
	"entriesHigherLevel",
	"rows",
	"row",
	"fluff",
]);

class TagJsons {
	static async pInit ({spells}) {
		TagCondition.init();
		SpellTag.init(spells);
		await ItemTag.pInit();
		await FeatTag.pInit();
		await AdventureBookTag.pInit();
	}

	static mutTagObject (json, {keySet, isOptimistic = true, creaturesToTag = null} = {}) {
		TagJsons.OPTIMISTIC = isOptimistic;

		const fnCreatureTagSpecific = CreatureTag.getFnTryRunSpecific(creaturesToTag);

		Object.keys(json)
			.forEach(k => {
				if (keySet != null && !keySet.has(k)) return;

				json[k] = TagJsons.WALKER.walk(
					{_: json[k]},
					{
						object: (obj, lastKey) => {
							if (lastKey != null && !LAST_KEY_ALLOWLIST.has(lastKey)) return obj;

							obj = TagCondition.tryRunBasic(obj);
							obj = SkillTag.tryRun(obj);
							obj = ActionTag.tryRun(obj);
							obj = SenseTag.tryRun(obj);
							obj = SpellTag.tryRun(obj);
							obj = ItemTag.tryRun(obj);
							obj = TableTag.tryRun(obj);
							obj = TrapTag.tryRun(obj);
							obj = HazardTag.tryRun(obj);
							obj = ChanceTag.tryRun(obj);
							obj = DiceConvert.getTaggedEntry(obj);
							obj = QuickrefTag.tryRun(obj);
							obj = FeatTag.tryRun(obj);
							obj = AdventureBookTag.tryRun(obj);

							if (fnCreatureTagSpecific) obj = fnCreatureTagSpecific(obj);

							return obj;
						},
					},
				)._;
			});

		WeightMeasureTag.tryRun(json);
	}
}

TagJsons.OPTIMISTIC = true;

TagJsons._BLOCKLIST_FILE_PREFIXES = null;

TagJsons.WALKER_KEY_BLOCKLIST = new Set([
	...MiscUtil.GENERIC_WALKER_ENTRIES_KEY_BLOCKLIST,
]);

TagJsons.WALKER = MiscUtil.getWalker({
	keyBlocklist: TagJsons.WALKER_KEY_BLOCKLIST,
});

globalThis.TagJsons = TagJsons;

class SpellTag {
	static _NON_STANDARD = new Set([
		// Skip "Divination" to avoid tagging occurrences of the school
		"Divination",
		// Skip spells we specifically handle
		"Antimagic Field",
		"Dispel Magic",
	].map(it => it.toLowerCase()));

	static init (spells) {
		spells
			.forEach(sp => SpellTag._SPELL_NAMES[sp.name.toLowerCase()] = {name: sp.name, source: sp.source});

		const spellNamesFiltered = Object.keys(SpellTag._SPELL_NAMES)
			.filter(n => !SpellTag._NON_STANDARD.has(n));

		SpellTag._SPELL_NAME_REGEX = new RegExp(`\\b(${spellNamesFiltered.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
		SpellTag._SPELL_NAME_REGEX_SPELL = new RegExp(`\\b(${spellNamesFiltered.map(it => it.escapeRegexp()).join("|")}) (spell|cantrip)`, "gi");
		SpellTag._SPELL_NAME_REGEX_AND = new RegExp(`\\b(${spellNamesFiltered.map(it => it.escapeRegexp()).join("|")}) (and {@spell)`, "gi");
		SpellTag._SPELL_NAME_REGEX_CAST = new RegExp(`(?<prefix>casts?(?: the(?: spell)?)? )(?<spell>${spellNamesFiltered.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
	}

	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@spell"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		if (TagJsons.OPTIMISTIC) {
			strMod = strMod
				.replace(SpellTag._SPELL_NAME_REGEX_SPELL, (...m) => {
					const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
					return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
				});
		}

		// Tag common spells which often don't have e.g. the word "spell" nearby
		strMod = strMod
			.replace(/\b(antimagic field|dispel magic)\b/gi, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
				return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			});

		strMod
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			});

		return strMod
			.replace(SpellTag._SPELL_NAME_REGEX_AND, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m[1].toLowerCase()];
				return `{@spell ${m[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}} ${m[2]}`;
			})
			.replace(/(spells(?:|[^.!?:{]*): )([^.!?]+)/gi, (...m) => {
				const spellPart = m[2].replace(SpellTag._SPELL_NAME_REGEX, (...n) => {
					const spellMeta = SpellTag._SPELL_NAMES[n[1].toLowerCase()];
					return `{@spell ${n[1]}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
				});
				return `${m[1]}${spellPart}`;
			})
			.replace(SpellTag._SPELL_NAME_REGEX_CAST, (...m) => {
				const spellMeta = SpellTag._SPELL_NAMES[m.last().spell.toLowerCase()];
				return `${m.last().prefix}{@spell ${m.last().spell}${spellMeta.source !== Parser.SRC_PHB ? `|${spellMeta.source}` : ""}}`;
			})
		;
	}
}
SpellTag._SPELL_NAMES = {};
SpellTag._SPELL_NAME_REGEX = null;
SpellTag._SPELL_NAME_REGEX_SPELL = null;
SpellTag._SPELL_NAME_REGEX_AND = null;
SpellTag._SPELL_NAME_REGEX_CAST = null;

globalThis.SpellTag = SpellTag;

class ItemTag {
	static _ITEM_NAMES = {};
	static _ITEM_NAMES_REGEX_TOOLS = null;
	static _ITEM_NAMES_REGEX_OTHER = null;
	static _ITEM_NAMES_REGEX_EQUIPMENT = null;

	static _WALKER = MiscUtil.getWalker({
		keyBlocklist: new Set([
			...TagJsons.WALKER_KEY_BLOCKLIST,
			"packContents", // Avoid tagging item pack contents
			"items", // Avoid tagging item group item lists
		]),
	});

	static async pInit () {
		const itemArr = await Renderer.item.pBuildList();

		const standardItems = itemArr.filter(it => !SourceUtil.isNonstandardSource(it.source));

		// region Tools
		const toolTypes = new Set(["AT", "GS", "INS", "T"]);
		const tools = standardItems.filter(it => toolTypes.has(it.type) && it.name !== "Horn");
		tools.forEach(tool => {
			this._ITEM_NAMES[tool.name.toLowerCase()] = {name: tool.name, source: tool.source};
		});

		this._ITEM_NAMES_REGEX_TOOLS = new RegExp(`\\b(${tools.map(it => it.name.escapeRegexp()).join("|")})\\b`, "gi");
		// endregion

		// region Other items
		const otherItems = standardItems
			.filter(it => {
				if (toolTypes.has(it.type)) return false;
				// Disallow specific items
				if (it.name === "Wave" && it.source === Parser.SRC_DMG) return false;
				// Allow all non-specific-variant DMG items
				if (it.source === Parser.SRC_DMG && !Renderer.item.isMundane(it) && it._category !== "Specific Variant") return true;
				// Allow "sufficiently complex name" items
				return it.name.split(" ").length > 2;
			})
			// Prefer specific variants first, as they have longer names
			.sort((itemA, itemB) => Number(itemB._category === "Specific Variant") - Number(itemA._category === "Specific Variant") || SortUtil.ascSortLower(itemA.name, itemB.name))
		;
		otherItems.forEach(it => {
			this._ITEM_NAMES[it.name.toLowerCase()] = {name: it.name, source: it.source};
		});

		this._ITEM_NAMES_REGEX_OTHER = new RegExp(`\\b(${otherItems.map(it => it.name.escapeRegexp()).join("|")})\\b`, "gi");
		// endregion

		// region Basic equipment
		// (Has some overlap with others)
		const itemsEquipment = itemArr
			.filter(itm => itm.source === "PHB" && !["M", "R", "LA", "MA", "HA", "S"].includes(itm.type));
		this._ITEM_NAMES_REGEX_EQUIPMENT = new RegExp(`\\b(${itemsEquipment.map(it => it.name.escapeRegexp()).join("|")})\\b`, "gi");
		itemsEquipment.forEach(itm => this._ITEM_NAMES[itm.name.toLowerCase()] = {name: itm.name, source: itm.source});
		// endregion
	}

	/* -------------------------------------------- */

	static tryRun (it) {
		return this._WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@item"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(this._ITEM_NAMES_REGEX_TOOLS, (...m) => {
				const itemMeta = this._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== Parser.SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
			.replace(this._ITEM_NAMES_REGEX_OTHER, (...m) => {
				const itemMeta = this._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== Parser.SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
		;
	}

	/* -------------------------------------------- */

	static tryRunBasicEquipment (it) {
		return this._WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@item"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTagBasicEquipment.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTagBasicEquipment (strMod) {
		return strMod
			.replace(ItemTag._ITEM_NAMES_REGEX_EQUIPMENT, (...m) => {
				const itemMeta = ItemTag._ITEM_NAMES[m[1].toLowerCase()];
				return `{@item ${m[1]}${itemMeta.source !== Parser.SRC_DMG ? `|${itemMeta.source}` : ""}}`;
			})
		;
	}
}

globalThis.ItemTag = ItemTag;

class TableTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@table"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(/Wild Magic Surge table/g, `{@table Wild Magic Surge|PHB} table`)
		;
	}
}

class TrapTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@trap"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(TrapTag._RE_TRAP_SEE, (...m) => `{@trap ${m[1]}}${m[2]}`)
		;
	}
}
TrapTag._RE_TRAP_SEE = /\b(Fire-Breathing Statue|Sphere of Annihilation|Collapsing Roof|Falling Net|Pits|Poison Darts|Poison Needle|Rolling Sphere)( \(see)/gi;

class HazardTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@hazard"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(HazardTag._RE_HAZARD_SEE, (...m) => `{@hazard ${m[1]}}${m[2]}`)
		;
	}
}
HazardTag._RE_HAZARD_SEE = /\b(High Altitude|Brown Mold|Green Slime|Webs|Yellow Mold|Extreme Cold|Extreme Heat|Heavy Precipitation|Strong Wind|Desecrated Ground|Frigid Water|Quicksand|Razorvine|Slippery Ice|Thin Ice)( \(see)/gi;

class WeightMeasureTag {
	static _WALKER = MiscUtil.getWalker({
		keyBlocklist: new Set([...TagJsons.WALKER_KEY_BLOCKLIST,
			"senses", "otherSources", "alignment", "traitTags", "senseTags", "actionTags", "languageTags",
			"damageTags", "miscTags", "damageTagsLegendary", "conditionInflict", "conditionInflictLegendary",
			"savingThrowForced", "savingThrowForcedLegendary", "hp"]),
	});

	/**
	 * Flags info:
	 * v = will extend unit to full name // ft = feet|foot
	 * d = will add dash between value and unit // 10-feet
	 * s = will force single form of unit even when value is not equal to 1 // 10 foot
	 */
	static tryRun (it) {
		const keyStack = [];

		return this._WALKER.walk(it, {
			preObject: (_, key) => keyStack.push(key),
			postObject: () => keyStack.pop(),
			preArray: (_, key) => keyStack.push(key),
			posArray: () => keyStack.pop(),

			string: (str) => {
				// item group in the item array should not be parsed as they are linked to real item names
				if (keyStack.at(-2) === "itemGroup" && keyStack.at(-1) === "items") return str;

				const ptrStack = { _: "" };
				TaggerUtils.walkerStringHandler(["@wm"], ptrStack, 0, 0, str, {
					fnTag: this._fnTag,
				});
				return ptrStack._;
			},
		});
	}

	static _fnTag (strMod) {
		// match 1 5 30 120 3000 1,200 300/1,200 50-90 1 or 2 1 to 2 1 and 2
		const RE_NUMBER_SEE = "(?<value>(((\\d+,)*\\d+)(-|/|\\s(and|or|to)\\s))?((\\d+,)*\\d+))";
		// match " " or -
		const RE_DELIMITER_SEE = "(?<delimiter>[\\s-])";
		// match unit only of it is whole word
		const RE_UNIT_SEE = "(?<unit>ft\\.|mi\\.|lb(?=[\\.s])|foot\\b|feet\\b|mile[s]?\\b|pound[s]?\\b)";

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
				case "lb":
					return ["lb", ""];
				case "pound":
				case "pounds":
					return ["lb", "v"];
				default:
					throw new Error(`Unhandled weight and measure unit: ${unit}`);
			}
		};

		const getWmTagsRegex = new RegExp(`${RE_NUMBER_SEE}${RE_DELIMITER_SEE}${RE_UNIT_SEE}`, "gim");

		return strMod.replace(getWmTagsRegex, (...match) => {
			const { value, delimiter } = match.last();
			const isValueOne = value === "1";

			const [unit, unitFlags] = parseMatch(match.last().unit, isValueOne);

			// todo handle cases like 1/4 pound
			// they are not two numbers after slash but fraction of one
			if ((unit === "lb" || unit === "mi") && value.includes("/")) return match[0];

			let flags = unitFlags;

			if (delimiter !== " ") flags += "d";

			let tagStack = `{@wm ${value}`;
			if (unit.length || flags.length) tagStack += "|";
			tagStack += `${unit}`;
			if (flags.length) tagStack += `|${flags}`;
			return `${tagStack}}`;
		});
	}
}

class CreatureTag {
	/**
	 * Dynamically create a walker which can be re-used.
	 */
	static getFnTryRunSpecific (creaturesToTag) {
		if (!creaturesToTag?.length) return null;

		// region Create a regular expression per source
		const bySource = {};
		creaturesToTag.forEach(({name, source}) => {
			(bySource[source] = bySource[source] || []).push(name);
		});
		const res = Object.entries(bySource)
			.mergeMap(([source, names]) => {
				const re = new RegExp(`\\b(${names.map(it => it.escapeRegexp()).join("|")})\\b`, "gi");
				return {[source]: re};
			});
		// endregion

		const fnTag = strMod => {
			Object.entries(res)
				.forEach(([source, re]) => {
					strMod = strMod.replace(re, (...m) => `{@creature ${m[0]}${source !== Parser.SRC_DMG ? `|${source}` : ""}}`);
				});
			return strMod;
		};

		return (it) => {
			return TagJsons.WALKER.walk(
				it,
				{
					string: (str) => {
						const ptrStack = {_: ""};
						TaggerUtils.walkerStringHandler(
							["@creature"],
							ptrStack,
							0,
							0,
							str,
							{
								fnTag,
							},
						);
						return ptrStack._;
					},
				},
			);
		};
	}
}

class ChanceTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@chance"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag,
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(/\b(\d+)( percent)( chance)/g, (...m) => `{@chance ${m[1]}|${m[1]}${m[2]}}${m[3]}`)
		;
	}
}

class QuickrefTag {
	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@quickref"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(QuickrefTag._RE_BASIC, (...m) => `{@quickref ${QuickrefTag._LOOKUP_BASIC[m[0].toLowerCase()]}}`)
			.replace(QuickrefTag._RE_VISION, (...m) => `{@quickref ${QuickrefTag._LOOKUP_VISION[m[0].toLowerCase()]}||${m[0]}}`)
		;
	}
}
QuickrefTag._RE_BASIC = /\b([Dd]ifficult [Tt]errain|Vision and Light)\b/g;
QuickrefTag._RE_VISION = /\b(dim light|bright light|lightly obscured|heavily obscured)\b/gi;
QuickrefTag._LOOKUP_BASIC = {
	"difficult terrain": "difficult terrain||3",
	"vision and light": "Vision and Light||2",
};
QuickrefTag._LOOKUP_VISION = {
	"bright light": "Vision and Light||2",
	"dim light": "Vision and Light||2",
	"lightly obscured": "Vision and Light||2",
	"heavily obscured": "Vision and Light||2",
};

class FeatTag {
	static _FEAT_LOOKUP = [];

	static async pInit () {
		const featData = await DataUtil.feat.loadJSON();
		const [featsNonStandard, feats] = [...featData.feat]
			.sort((a, b) => SortUtil.ascSortDateString(Parser.sourceJsonToDate(a.source), Parser.sourceJsonToDate(b.source)) || SortUtil.ascSortLower(a.name, b.name) || SortUtil.ascSortLower(a.source, b.source))
			.segregate(feat => SourceUtil.isNonstandardSource(feat.source));
		this._FEAT_LOOKUP = [
			...feats,
			...featsNonStandard,
		]
			.map(feat => ({searchName: feat.name.toLowerCase(), feat}));
	}

	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@feat"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		return strMod
			.replace(/(?<pre>\bgain the )(?<name>.*)(?<post> feat\b)/, (...m) => {
				const {pre, post, name} = m.at(-1);
				const feat = this._getFeat(name);
				if (!feat) return m[0];
				const uid = DataUtil.proxy.getUid("feat", feat, {isMaintainCase: true});
				const [uidName, ...uidRest] = uid.split("|");

				// Tag display name not expected
				if (name.toLowerCase() !== uidName.toLowerCase()) throw new Error(`Unimplemented!`);

				const uidFinal = [
					name,
					...uidRest,
				]
					.join("|");
				return `${pre}{@feat ${uidFinal}}${post}`;
			})
		;
	}

	static _getFeat (name) {
		const searchName = name.toLowerCase().trim();
		const featMeta = this._FEAT_LOOKUP.find(it => it.searchName === searchName);
		if (!featMeta) return null;
		return featMeta.feat;
	}
}

class AdventureBookTag {
	static _ADVENTURE_RES = [];
	static _BOOK_RES = [];

	static async pInit () {
		for (const meta of [
			{
				propRes: "_ADVENTURE_RES",
				propData: "adventure",
				tag: "adventure",
				contentsUrl: `${Renderer.get().baseUrl}data/adventures.json`,
			},
			{
				propRes: "_BOOK_RES",
				propData: "book",
				tag: "book",
				contentsUrl: `${Renderer.get().baseUrl}data/books.json`,
			},
		]) {
			const contents = await DataUtil.loadJSON(meta.contentsUrl);

			this[meta.propRes] = contents[meta.propData]
				.map(({name, id}) => {
					const re = new RegExp(`\\b${name.escapeRegexp()}\\b`, "g");
					return str => str.replace(re, (...m) => `{@${meta.tag} ${m[0]}|${id}}`);
				});
		}
	}

	static tryRun (it) {
		return TagJsons.WALKER.walk(
			it,
			{
				string: (str) => {
					const ptrStack = {_: ""};
					TaggerUtils.walkerStringHandler(
						["@adventure", "@book"],
						ptrStack,
						0,
						0,
						str,
						{
							fnTag: this._fnTag.bind(this),
						},
					);
					return ptrStack._;
				},
			},
		);
	}

	static _fnTag (strMod) {
		for (const arr of [this._ADVENTURE_RES, this._BOOK_RES]) {
			strMod = arr.reduce((str, fn) => fn(str), strMod);
		}
		return strMod;
	}
}
