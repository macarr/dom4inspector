//namespace scope
(function( DMI, $, undefined ){
		
var MSpell = DMI.MSpell = DMI.MSpell || {};
var MUnit = DMI.MUnit = DMI.MUnit || {};

var Format = DMI.Format;
var Utils = DMI.Utils;
var modctx = DMI.modctx;
var modconstants = DMI.modconstants;


//////////////////////////////////////////////////////////////////////////
// PREPARE DATA
//////////////////////////////////////////////////////////////////////////

MSpell.initSpell = function(o) {
	o.nations = [];
}

MSpell.nationList = function (o) {
	o.nations = [];
	
	for (var oi=0, attr; attr = modctx.attributes_by_spell[oi];  oi++) {
		if (attr.spell_number == o.id) {
			var attribute = modctx.attributes_lookup[parseInt(attr.attribute_record_id)];
			if (attribute.attribute_number == "278") {
				o.nations.push(parseInt(modctx.restrict_to_nations_by_attribute_lookup[parseInt(attr.attribute_record_id)].nation_number));
			}
		}
	}

	return o.nations;
}

MSpell.prepareData_PreMod = function() {
	for (var oi=0, o;  o= modctx.spelldata[oi];  oi++) {
		
		o.path1  = modconstants[16][o.path1];
		o.path2  = modconstants[16][o.path2];

		o.nations = MSpell.nationList(o);
		
		o.nextspell = o.next_spell;
		
	}
}


MSpell.prepareData_PostMod = function() {
	for (var oi=0, o;  o= modctx.spelldata[oi];  oi++) {
		//shift nation data to nations (who will shift it back in another form)
		for (var ni=0, nid, n; nid= o.nations[ni]; ni++) {
			if (!(n= modctx.nationlookup[nid])) {
				console.log('nation '+nid+ ' not found (spell '+o.id+')');
				continue;
			}
			n.spells.push(o);
		}
		delete o.nations;
		
		o.renderOverlay = MSpell.renderOverlay;
		o.matchProperty = MSpell.matchProperty;
		
		//convert to numbers (for column ordering)
		//doesn't seem to cause any further problems..
		o.id = parseInt(o.id);
		o.fatiguecost = parseInt(o.fatiguecost);
		
		//serachable string
		o.searchable = o.name.toLowerCase();
		
		//flip 'works underwater' bit and suchlike
//		o.spec_original = o.spec;
//		o.spec = MSpell.updateSpecialBitfield(o.spec);		
				
		//lookup effect 2
		if (o.nextspell == '0') {
			delete o.nextspell;
		} else if (o.nextspell) {
			var e2;
			if (e2 = modctx.spelllookup[o.nextspell])
				o.nextspell = e2;
			else {
				console.log('spell '+o.nextspell+' not found (nextspell on spell '+o.id+')');
				delete o.nextspell;
			}
		}
		
		// Modded description
		if (o.descr) {
			o.description = o.descr;
		}

		//path: E1D1
		if (!o.path1 || o.pathlevel1=='0') {
			delete o.path1;
			delete o.pathlevel1;
		}
		if (!o.path2 || o.pathlevel2=='0') {
			delete o.path2;
			delete o.pathlevel2;
		}
		o.mpath = (o.path1 || "") + (o.pathlevel1 || "") + (o.path2 || "") + (o.pathlevel2 || "");

		//research: Alteration 10
		o.research = modconstants[15][o.school];
		o.sortschool = o.school
		if (o.school != -1 && o.school != 7) {
			o.research += ' ' + o.researchlevel;
			o.sortschool += '.' + o.researchlevel;
		}
		
		if (o.nreff) {
			o.effects_count = o.nreff;
		}
		var effects = MSpell.getEffect(o);
		if (effects) {
			if (effects.ritual == "1") {
				o.type = 'Ritual';
			} else {
				o.type = 'Combat';
			}
			o.rng_bat = effects.range_base;
			if (effects.range_per_level != "0") {
				o.rng_bat = parseInt(o.rng_bat) + (parseInt(o.pathlevel1) * parseInt(effects.range_per_level));
				o.rng_bat = o.rng_bat + "+ [" + effects.range_per_level + "/lvl]";
			}
			if (o.rng_bat == "0") {
				delete o.rng_bat;
			}

			if (effects.area_base) {
				o.aoe_s = effects.area_base;
				var area_per_level = parseInt(effects.area_per_level)%10;
				if (area_per_level != 0) {
					o.aoe_s = parseInt(o.aoe_s) + (parseInt(o.pathlevel1) * parseInt(area_per_level));
					o.aoe_s = o.aoe_s + "+ [" + area_per_level + "/lvl]";
				}
				if (o.aoe_s == "0") {
					if (o.effects_count == "1" && effects.ritual == "0") {
						if (effects.range_base == "0") {
							o.aoe_s = "Caster";
						} else {
							o.aoe_s = "One person";
						}
					} else {
						delete o.aoe_s;
					}
				}
			}
			if (parseInt(o.effects_count) > 1) {
				o.nreff = o.effects_count;
			}
			if (effects.area_battlefield_pct) {
				o.aoe_s = effects.area_battlefield_pct + "% of battlefield";
			}
			if (effects.duration) {
				o.duration = effects.duration;
			}
		}

		//combat fatiguecost
		if (o.type == 'Ritual'){
			if (!o.gemcost) {
				o.gemcost = parseInt(o.fatiguecost) / 100;
			}
			delete o.fatiguecost;
			o.fatiguecostsort = -1;
		} else {
			if (parseInt(o.gemcost) > 0) {
				o.fatiguecost = parseInt(o.gemcost) * 100;
			}
			o.fatiguecostsort = parseInt(o.fatiguecost);
		}
		if (o.gemcost && parseInt(o.gemcost) > 0) {
			o.gemcostsort = parseInt(o.gemcost);
			o.gemcost = o.gemcost + o.path1;
		} else {
			o.gemcostsort = -1;
			delete o.gemcost;
		}	
	
		// Attributes
		for (var oj=0, attr; attr = modctx.attributes_by_spell[oj];  oj++) {
			if (attr.spell_number == o.id) {
				var attribute = modctx.attributes_lookup[parseInt(attr.attribute_record_id)];
				if (attribute.attribute_number == "700") {
					o.provrange = attribute.raw_value;
				}
			}
		}

		//associate summons with this spell (and vice  versa)
		var _o = o;
		var _effects = effects;
		while (_o && _effects) {
			//get summons data for this spell
			if (_effects.effect_number == "1" ||
				_effects.effect_number == "21" ||
				_effects.effect_number == "26" ||
				_effects.effect_number == "31" ||
				_effects.effect_number == "37" ||
				_effects.effect_number == "38" ||
				_effects.effect_number == "43" ||
				_effects.effect_number == "50" ||
				_effects.effect_number == "93" ||
				_effects.effect_number == "119") {
				
				var uid = _effects.raw_argument;

				var u = modctx.unitlookup[uid];
				if (!u) {
					console.log('Unit '+uid+' not found (Spell '+_o.id+')');
					break;
				}

				//add to list of summoned units (to be attached to nations later)
				o.summonsunits = o.summonsunits || [];
				o.summonsunits.push(u);

				//attach spell to unit
				u.summonedby = u.summonedby || [];
				u.summonedby.push( o );
				
				if (!u.type) {
					if (_effects.effect_number == "1") {
						u.type = 'unit (Summon)';
						u.sorttype = MUnit.unitSortableTypes[u.type];
					} else if (_effects.effect_number == "21") {
						u.type = 'cmdr (Summon)';
						u.sorttype = MUnit.unitSortableTypes[u.type];
					}
				}
			} else if (_effects.effect_number == "76" || 
				_effects.effect_number == "89" || 
				_effects.effect_number == "100" || 
				_effects.effect_number == "114") {
				
				var arr;
				if (_effects.effect_number == "76") {
					arr = MSpell.tartarianGate;
				} else if (_effects.effect_number == "89") {
					arr = MSpell.uniqueSummon[_effects.raw_argument];
				} else if (_effects.effect_number == "100") {
					arr = MSpell.terrainSummon[_effects.raw_argument];
				} else if (_effects.effect_number == "114") {
					arr = MSpell.uniqueSummon[_effects.raw_argument];
				}
				if (!arr) {
					arr = [o.damage];
				}
				for (var i=0, uid;  uid= arr[i];  i++) {
					var u = modctx.unitlookup[uid];
					//add to list of summoned units (to be attached to nations later)
					o.summonsunits = o.summonsunits || [];
					o.summonsunits.push(u);

					//attach spell to unit
					u.summonedby = u.summonedby || [];
					u.summonedby.push( o );					
				}
			}
			if (_o == _o.nextspell) break;
			_o = modctx.spelllookup[_o.nextspell];
			if (_o) {
				_effects = MSpell.getEffect(_o);
			}
		}
		if (effects) {
			Utils.addFlags(o, MSpell.bitfieldValues(effects.modifiers_mask, modctx.effect_modifier_bits_lookup), ignorekeys );
		}
	}
}

	
//////////////////////////////////////////////////////////////////////////
// DEFINE GRID
//////////////////////////////////////////////////////////////////////////

function spellNameFormatter(row, cell, value, columnDef, dataContext) {
	if (dataContext.nations)
		return '<div class="national-spell">'+value+'</div>';	
	return value;
}

function fatigueFormatter(row, cell, value, columnDef, dataContext) {
	if (value) {
		if (value < 1000 && dataContext.type!='Ritual') {
	       		return String(value)+'-';
		}
	}
	return '';
}
function spellCostFormatter(row, cell, value, columnDef, dataContext) {
	return Format.Gems(dataContext.gemcost)
}
function spellTypeFormatter(row, cell, value, columnDef, dataContext) {
	return (value == 'combat spell') ? 'combat' : value
}

MSpell.CGrid = DMI.Utils.Class( DMI.CGrid, function() {		
	//grid columns
	var columns = [
		{ id: "name",     width: 120, name: "Spell Name", field: "name", sortable: true, formatter: spellNameFormatter },
		{ id: "type",      width: 40, name: "Type", field: "type", sortable: true, formatter: spellTypeFormatter },
		{ id: "research",      width: 60, name: "School", field: "sortschool", sortable: true, formatter: function(_,__,v,___,o){ return o.research; } },
		{ id: "mpath",    width: 40, name: "Path req", field: "mpath", sortable: true, formatter: DMI.GridFormat.Paths },
		{ id: "gemcost",    width: 30, name: "Cost", field: "gemcostsort", sortable: true, formatter: spellCostFormatter },
		{ id: "fatiguecost",     width: 30, name: "Fat", field: "fatiguecostsort", sortable: true, formatter: fatigueFormatter }
	];
	
	this.superClass.call(this, 'spell', modctx.spelldata, columns); //superconstructor

	//closure scope
	var that = this;
	
	//+ and - keys increment effect no
	$(that.domselp+" input.effect").keypress( function(e) {
			if (e.which == 43 || e.which == 61) {
				$(this).val( parseInt($(this).val()) +1); 
				e.preventDefault();	
			}
			if (e.which == 45) {
				$(this).val( parseInt($(this).val()) -1); 
				e.preventDefault();	
			}			
	});
	//+ and - keys double/half bitmask search values
	$(that.domselp+" input.effect-mask, "+ that.domselp+" input.special-mask").keypress( function(e) {
			if (e.which == 43 || e.which == 61) {
				$(this).val( parseInt($(this).val()) * 2); 
				e.preventDefault();	
			}
			if (e.which == 45) {
				$(this).val( parseInt($(this).val()) / 2); 
				e.preventDefault();	
			}			
	});

	//selecting national/generic deselects the other
	$(that.domselp+" input.national").bind('change click', function(e) {
		if ($(this).prop('checked')) 
			$(that.domselp+" input.generic").prop('checked', false).saveState();
	});
	$(that.domselp+" input.generic").bind('change click', function(e) {
		if ($(this).prop('checked')) 
			$(that.domselp+" input.national").prop('checked', false).saveState();
	});
	
	
	//reads search boxes
	this.getSearchArgs = function(domsel) {
		var args = Utils.merge(this.getPropertyMatchArgs(), {
			str: $(that.domselp+" input.search-box").val().toLowerCase(),
			nation: $(that.domselp+" select.nation").val(),
			
			type: $(that.domselp+" select.type").val(),
			schools: Utils.splitToLookup( $(that.domselp+" select.school").val(), ','),
			generic: $(that.domselp+" input.generic:checked").val(),
			national: $(that.domselp+" input.national:checked").val(),
			
			effect: parseInt($(that.domselp+" input.spell-effect-number").val()),
			effect_mask: parseInt($(that.domselp+" input.effect-mask").val()),
			special_mask: parseInt($(that.domselp+" input.special-mask").val()),
			
			aquatic: $(that.domselp+" select.aquatic").val(),

			mpaths: ''
		});
		if ($.isEmptyObject(args.schools)) delete args.schools;
		
		//whole era
		if (args.nation == 'EA' || args.nation == 'MA' || args.nation == 'LA') {
			args.eracode = args.nation;
			delete args.nation;
		}
		else args.nation = modctx.nationlookup[ args.nation ];
				
		//create string of mpaths from checkboxes
		$(that.domselp+' .toggle-path:checked').each(function() {
			args.mpaths += this.value;
		});
		return args;
	}
	
	//apply search
	this.searchFilter =  function(o, args) {
		//type in id to ignore filters
		if (args.str && args.str == String(o.id)) return true;
		
		//check effect no (and recurring attached effects)
		skip:
		if (args.effect) {
			var oo = o;
			//check recurring nextspell
			while(oo) {
				if (oo.effect == String(args.effect) || oo.effect == String(10000 + args.effect)) {
					//check masks on damage
					if (!args.effect_mask || parseInt(oo.damage) & args.effect_mask)
						//return true;
						break skip;
				}					
				oo = oo.nextspell;
				if (oo == o) break; //avoid infinite loop
			}
			return false;
		}
		
		//check special mask (including child effeccts)
		skip:
		if (args.special_mask) {
			var oo = o;
			//check recurring nextspell
			while(oo) {
				if (parseInt(oo.spec_original) & args.special_mask)
					//return true;
					break skip;
				oo = oo.nextspell;
				if (oo == o) break; //avoid infinite loop
			}
			return false;
		}
		
		//type		
		if (args.type && o.type != args.type)
			return false;
		
		//school		
		if (args.schools && !args.schools[o.school])
			return false;
		
		
		//national (national spells only)
		if (args.national && !o.nations)
			return false;
		//generic (generic spells only)
		if (args.generic && o.nations)
			return false;
		
		//era
		if (args.eracode && o.eracodes) {
			if (!o.eracodes[args.eracode])
				return false;			
		}
		//nation
		if (args.nation && o.nations) {
			if (!o.nations[args.nation.id])
				return false;
		}
		
		//aquatic
		if (args.aquatic) {
			if (args.aquatic == 'uw' && !DMI.MSpell.worksUnderwater(o))
				return false;
			if (args.aquatic == 'land' && !DMI.MSpell.worksOnDryLand(o))
				return false;
		}		
		
		//search string
		if (args.str && o.searchable.indexOf(args.str) == -1)
			return false;
		
		//magic paths
		if (args.mpaths) {
			if (args.mpaths.indexOf(o.path1) == -1)
				return false;
			if (o.path2 && args.mpaths.indexOf(o.path2) == -1)
				return false;
		}
		
		//key =~ val
		if (args.key) {
			var r = o.matchProperty(o, args.key, args.comp, args.val);
			if (args.not  ?  r  :  !r)
				return false;
		}
		return true;
	}
	
	//customise initial search
	this.initialSortTrigger = this.domsel+" div.slick-header-column[title=School]";
	
	this.defaultSortCmp = function(r1,r2) {
		if (r2.mpath < r1.mpath) return 1;
		if (r2.mpath > r1.mpath) return -1;
		return 0;
	}
	
	this.init();
});

//MSpell.matchProperty = DMI.matchProperty;
MSpell.matchProperty = function(o, key, comp, val) {
	if (DMI.matchProperty(o, key, comp, val))
		return true;

	//nextspell..
	if (o.nextspell)
		return DMI.MSpell.matchProperty(o.nextspell, key, comp, val);
}

MSpell.formatAoe = function(v,o) {
	return o.aoeplus ? v+'+' : v; 
}

//////////////////////////////////////////////////////////////////////////
// OVERLAY RENDERING
//////////////////////////////////////////////////////////////////////////

var aliases = {};
var formats = {};
var hiddenkeys = Utils.cutDisplayOrder(aliases, formats,
[
	'id', 		'spell id'
]);
var moddingkeys = Utils.cutDisplayOrder(aliases, formats,
[
	'effect',	'effect',	function(v,o){ return v + ' (damage:'+o.damage+')'; },
	'nextspell',	'nextspell',	function(v,o){ return v.id; },
	'spec_original',	'special'
]);
var displayorder = Utils.cutDisplayOrder(aliases, formats,
[
	'rng_bat',	'range', 		function(v,o){ return o.rngplus ? v+'+' : v; },
	'provrange',	'range', 		function(v,o){ return o.provrange == 1 ? v+' province' : v+' provinces' },
	'aoe_s',	'area of effect', 	MSpell.formatAoe,
	'nreff', 	'number of effects',	function(v,o){ return o.effplus ? v+'+' : v; },
	'fatiguecost',	'fatigue cost',		function(v){ return v+'-'; },
	'precision',	'precision',	{0: '0 '},	
	'duration',	'duration',	function(v,o){ return o.duration == 1 ? v+' round' : v+' rounds' },
	'gemcost',	'gems required',	Format.Gems,
	'onlyowndst', 'target own province', {0:'false', 1:'true'},
	'onlygeosrc', 'source terrain', function(v,o){ return Utils.renderFlags(MSpell.bitfieldValues(o.onlygeosrc, modctx.map_terrain_types_lookup), 1) },
	'onlygeodst', 'destination terrain', function(v,o){ return Utils.renderFlags(MSpell.bitfieldValues(o.onlygeodst, modctx.map_terrain_types_lookup), 1) },
	'onlyfriendlydst', 'target allied provinces', {0:'false', 1:'true'},
	'nowatertrace', 'cannot trace through water', {0:'false', 1:'true'},
	'nolandtrace', 'cannot trace over land', {0:'false', 1:'true'},
	'walkable', 'trace along a walkable path', {0:'false', 1:'true'}
]);
var ignorekeys = {
	modded:1,
	path1:1, pathlevel1:1, path2:1, pathlevel2:1, 
	school:1,
	researchlevel:1,research:1,sortschool:1,

	damage:1,
	damagemon:1,
	spec:1,
	descr:1,
	type:1,		
	mpath:1,
	fatiguecost:1,gemcost:1,
	fatiguecostsort:1,gemcostsort:1,
	next_spell:1,
	effect_record_id:1,
	effects_count:1,
	range:1,
	aoe:1,

	summonsunits:1,	nations:1, eracodes:1, nationname:1,
	
	//common fields
	name:1,description:1,
	searchable:1, renderOverlay:1, matchProperty:1
};		

MSpell.renderOverlay = function(o) {
	//template
	var h=''
	h+='<div class="spell overlay-contents"> ';
	
	//header
	h+='	<div class="overlay-header" title="spell id: '+o.id+'"> ';
	h+=' 		<input class="overlay-pin" type="image" src="images/PinPageTrns.png" title="unpin" />';
	h+='		<p style="float:right;">'+o.research+'</p>';
	h+='		<h2>'+o.name+'</h2> ';
	
	//nation info
	if (o.nations) {
		var nname = o.nationname,  ntitle='', num=0;
		for (var k in o.nations) {
			num++;
			ntitle += ntitle ? ', &nbsp;\n' : '';
			ntitle += Utils.nationRef( o.nations[k].id, o.nations[k].shortname );			
		}
		h+='	<p>'+ntitle+'</p> ';
		
		//vanilla spells have 3 nations max.3 shortnames will fit nicely
		// if (num <= 3) 
		// 	h+='	<p>'+ntitle+'</p> ';
		// else
		// 	h+='	<p title="'+ntitle+'">'+nname+'</p> ';
	}
	
	
	//body
	h+='	</div>';
	h+='	<div class="overlay-main" style="position:relative;">';
	
	//type & path requirements
	h+='		<div style="float:right; clear:right;">'+o.type+'</div>';
	h+='		<div style="float:right; clear:right;">'+Format.Paths(o.mpath)+'</div>';
	
	//spell details & secondary effects
	h+=		MSpell.renderSpellTable(o);
	
	//special flags; casting requirements (cannot be cast underwater etc..)
//	var specflags = Utils.renderFlags( MSpell.landValues(o) );
//	if (specflags)
//		h+=	'<p>'+specflags+'</p>';	

	
	//wikilink
	h+='		<div class="overlay-wiki-link non-content">';
	// h+='			<a class="select-text-button hidden-inline" href="javascript:void(0);">[text]</a>';
	h+='			<a href="http://dom3.servegame.com/wiki/'+o.name.replace(/ /g, '_')+'">[wiki]</a>';
	h+='		</div>';
	
	//footer
	h+='	</div>';
	h+='	<div class="overlay-footer">';
	
	//descr
	//var uid = 'c'+(Math.random());
	//uid = uid.replace('.','');
	//h+='		<div class="overlay-descr pane-extension '+uid+'">&nbsp;</div>';
	
	if (o.description)
	//		Utils.insertContent( '<p>'+o.description+'</p>', 'div.'+uid );
	h+='		<div class="overlay-descr pane-extension"><p>'+o.description.replace(/\"/g, '')+'</p></div>';
//	else if (o.research != 'unresearchable') {
//			 var url = descrpath + Utils.descrFilename(o.name);
//			 Utils.loadContent( url, 'div.'+uid );
//	}

	h+='	</div> ';
	h+='</div> ';
	return h;	
}

//spell table. +recursive secondary effects
MSpell.renderSpellTable = function(o, original_effect) {
	
	//so irrelevant rows can be hidden by css (eg: aoe for rituals)
	// if (o.type == 'ritual') cssclasses += ' ritual';
	// if (original_effect) cssclasses +=  ' nextspell';
	
	var cssclasses = original_effect ? ' hidden-block' : '';
	
	//template
	var h='';
	h+='		<table class="overlay-table spell-table' + cssclasses + '"> ';
	h+= 			Utils.renderDetailsRows(o, hiddenkeys, aliases, formats, 'hidden-row');
	h+= 			Utils.renderDetailsRows(o, moddingkeys, aliases, formats, 'modding-row');
	h+= 			Utils.renderDetailsRows(o, displayorder, aliases, formats);
	h+= 			Utils.renderStrangeDetailsRows(o, ignorekeys, aliases, 'strange');
	h+='		</table> ';

	//mysterious?
	// if (o.spec & 536870912 || (original_effect && (original_effect.spec & 536870912)))
	// 	cssclasses += ' hidden-block';

	
	cssclasses = original_effect ? ' nextspell' : '';
	
	//hide the whole effect if its restore fatigue +0 (it does nothing)
	// (used as gfx effects placeholder in cbm)
	if (o.damage == '0' && MSpell.format.effect(o.effect) == 8)
		cssclasses += 	' hidden-block'
	
	var effects = MSpell.getEffect(o);
	if (effects) {
		//effect
		h+='		<table class="overlay-table spell-effect '+cssclasses+'"> ';
		h+=			renderEffect(o, effects);

		// Attributes
		for (var oi=0, attr; attr = modctx.attributes_by_spell[oi];  oi++) {
			if (attr.spell_number == o.id) {
				var attribute = modctx.attributes_lookup[parseInt(attr.attribute_record_id)];
				if (attribute.attribute_number != "278" &&
						attribute.attribute_number != "700" &&
						attribute.attribute_number != "703") {
					var specflags = modctx.attribute_keys_lookup[attribute.attribute_number].name;
					
					var val;
					if (attribute.attribute_number == '702') {
						val = Utils.renderFlags(MSpell.bitfieldValues(attribute.raw_value, modctx.map_terrain_types_lookup), 1);
					} else {
						val = attribute.raw_value;
					}
					
					h+= '<tr class="'+attribute.attribute_number+'"><th>'+modctx.attribute_keys_lookup[attribute.attribute_number].name.replace(/{(.*?)}|<|>/g, "")+':</th><td>'+val+'</td></tr>'
				}
			}
		}

		//special
		var specflags = Utils.renderFlags( MSpell.bitfieldValues(effects.modifiers_mask, modctx.effect_modifier_bits_lookup) );
		if (specflags)
			h+=		'<tr><td class="widecell" colspan="2">&nbsp;</td></tr><tr><td class="widecell" colspan="2">'+specflags+'</td></tr></div>';
		}

	if (o.modded) {
		h+='	<tr class="modded hidden-row"><td colspan="2">Modded<span class="internal-inline"> [modded]</span>:<br />';
		h+=		o.modded.replace('ERROR:', '<span style="color:red;font-weight:bold;">ERROR:</span>');
		h+='	</td></tr>';
	}
	h+=' 		</table> ';

	//h+= Utils.renderModded(o);
	
	//attached effect
	if (o.nextspell) {
		h+=' <h4 class="hidden-block nextspell">'+o.nextspell.name+'</h4>';
		//detect recursion
		if (o.nextspell == o)
			throw 'Error, spell 2nd effect as itself: '+o.id+': '+o.name; 
		else {
			h+= MSpell.renderSpellTable(o.nextspell, original_effect || o);
		}
	} 	
	return h;	
}

MSpell.bitfieldValues = function(bitfield, masks_dict) {
	var newValues=[];
	if (!bitfield) {
		return newValues;
	}
	var values = bitfields.bitfieldValues(bitfield, masks_dict);
	for (var value in values) {
		var flag = "none";
		var flagIndex = values[value].indexOf("Wpn: #");
		if (flagIndex != -1) {
			flag = values[value].substring(flagIndex+6, values[value].length-2)
		}
		value = values[value].replace(/{(.*?)}/g, "");
		newValues.push([value, flag]);
	}
	return newValues;
}

function renderEffect(o, effects) {
	var res = MSpell.effectlookup[effects.effect_number] || MSpell.effectlookup['unknown'];
	//if its a function then run it
	if (typeof(res) == 'function')	res = res(o, effects);
	return '<tr><th width="10px">'+modctx.effects_info_lookup[effects.effect_number].name.replace(/{(.*?)}/g, "").trim()+':</th><td>'+res+'</td></tr>'
}

MSpell.worksUnderwater = function(spell) {
	var effects = MSpell.getEffect(spell);
	if (effects) {
		if ((effects.modifiers_mask & 8388608) ||
			(effects.modifiers_mask & 33554432)) {
			return true;
		}
	}
	return false; 
}

MSpell.worksOnDryLand = function(spell) { 
	var effects = MSpell.getEffect(spell);
	if (effects) {
		if (!(effects.modifiers_mask & 33554432)) {
			return true;
		}
	}
	return false; 
}

MSpell.getEffect = function(spell) {
	var effect = {};
	if (spell.effect_record_id) {
		effect = modctx.effects_lookup[spell.effect_record_id];
	}
	
	if (spell.copyspell) {
		var otherspell = DMI.modctx.spelllookup[spell.copyspell];
		effect = modctx.effects_lookup[otherspell.effect_record_id];
	}
	if (spell.effect) {
		if (parseInt(spell.effect) > 1000) {
			effect.effect_number = parseInt(spell.effect) - 10000;
			effect.ritual = 1;
		} else {
			effect.effect_number = parseInt(spell.effect);
			effect.ritual = 0;
		}
	}
	if (effect.effect_number == "1" ||
		effect.effect_number == "21" ||
		effect.effect_number == "26" ||
		effect.effect_number == "31" ||
		effect.effect_number == "37" ||
		effect.effect_number == "38" ||
		effect.effect_number == "43" ||
		effect.effect_number == "50" ||
		effect.effect_number == "81" ||
		effect.effect_number == "93" ||
		effect.effect_number == "119") {
		if (spell.damagemon) {
			effect.raw_argument = spell.damagemon.toLowerCase();
		} else if (spell.damage) {
			effect.raw_argument = spell.damage;
		}
	}
	
	if (spell.spec) {
		effect.modifiers_mask = spell.spec; 
	} else if (!effect.modifiers_mask) {
		effect.modifiers_mask = 0; 
	}
	
	if (spell.range) {
		effect.range_base = parseInt(spell.range) % 1000;
		if (parseInt(spell.range) > 999) {
			effect.range_per_level = Math.round(parseInt(spell.range) / 1000);
		}
	} else if (!effect.range_base) {
		effect.range_base = '0';
		effect.range_per_level = '0';
	}
	
	if (spell.aoe) {
		effect.area_base = parseInt(spell.aoe) % 1000
		effect.area_per_level = parseInt(spell.aoe) / 1000;
		if (parseInt(spell.aoe) > 999) {
			effect.area_per_level = Math.round(parseInt(spell.aoe) / 1000);
		}
	}
	
	return effect;

//  effect.duration INTEGER,
//	effect.range_strength_divisor INTEGER, 
//	effect.area_battlefield_pct INTEGER, 
//	effect.sound_number INTEGER, 
//	effect.flight_sprite_number INTEGER, 
//	effect.flight_sprite_length INTEGER, 
//	effect.explosion_sprite_number INTEGER, 
//	effect.explosion_sprite_length INTEGER, 
}

//namespace args
}( window.DMI = window.DMI || {}, jQuery ));